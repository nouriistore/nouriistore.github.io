// ========================================================
// NOURII STORE - ADMIN PORTAL CONTROLLER (محرك لوحة التحكم)
// ========================================================

const ADMIN_STATE = {
  currentUser: null,
  activeTab: 'overview',
  products: [],
  categories: [],
  users: [],
  searchQuery: '',
  categoryFilter: 'all',
  formMedia: { images: [], videos: [] }, // extra photos / videos of the product being edited
  storeSettings: null, // Settings sheet as last read (admins only)
  adSlides: [],        // ads slider being edited
  discounts: null,     // discounts + coupons being edited
  settings: {
    googleScriptUrl: '',
    githubToken: '',
    githubRepo: 'nouriistore/nouriistore.github.io',
    githubBranch: 'main'
  }
};

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  loadAdminStoredData();
  initTheme();
  checkAuthSession();
});

// LOAD STORED DATA
function loadAdminStoredData() {
  try {
    // 1. Settings: config.js wins, so a new deployment link reaches every browser;
    //    a link saved in this browser is only used when config.js has none
    const savedScriptUrl = localStorage.getItem('nourii_google_script_url');
    if (typeof NOURII_CONFIG !== 'undefined' && NOURII_CONFIG.googleScriptUrl) {
      ADMIN_STATE.settings.googleScriptUrl = NOURII_CONFIG.googleScriptUrl;
    } else if (savedScriptUrl) {
      ADMIN_STATE.settings.googleScriptUrl = savedScriptUrl;
    }

    const ghToken = localStorage.getItem('nourii_github_pat');
    if (ghToken) ADMIN_STATE.settings.githubToken = ghToken;

    // 2. Current user session (a signed token issued by the Google backend)
    const session = localStorage.getItem('nourii_admin_session');
    if (session) ADMIN_STATE.currentUser = JSON.parse(session);
    if (ADMIN_STATE.currentUser && !ADMIN_STATE.currentUser.token && !ADMIN_STATE.currentUser.legacy) {
      // Sessions saved before logins used tokens are no longer valid
      ADMIN_STATE.currentUser = null;
      localStorage.removeItem('nourii_admin_session');
    }

    // 3. Users list (display only — passwords are never stored in the browser)
    const storedUsers = localStorage.getItem('nourii_admin_users');
    ADMIN_STATE.users = storedUsers ? JSON.parse(storedUsers).map(stripPassword) : [];
    saveUsersToStorage();

    // 4. Products (Custom from storage or fallback from products.js)
    const storedProds = localStorage.getItem('nourii_admin_products') || localStorage.getItem('nourii_live_products');
    if (storedProds) {
      ADMIN_STATE.products = JSON.parse(storedProds);
    } else if (typeof PRODUCTS !== 'undefined') {
      ADMIN_STATE.products = JSON.parse(JSON.stringify(PRODUCTS));
      localStorage.setItem('nourii_admin_products', JSON.stringify(ADMIN_STATE.products));
    }

    // 5. Categories (last list read from Google Drive, else the built-in one)
    const storedCats = localStorage.getItem('nourii_admin_categories');
    if (storedCats) {
      ADMIN_STATE.categories = JSON.parse(storedCats);
    } else if (typeof CATEGORIES !== 'undefined') {
      ADMIN_STATE.categories = JSON.parse(JSON.stringify(CATEGORIES));
    }

    // If Google Drive URL is active, fetch live data from Google Drive as PRIMARY source
    if (ADMIN_STATE.settings.googleScriptUrl) {
      syncSilentlyFromGoogleDrive();
      fetchCategoriesFromDrive();
      if (ADMIN_STATE.currentUser) {
        verifySessionWithDrive();
        if (ADMIN_STATE.currentUser.role === 'admin') {
          fetchLiveUsersFromGoogleDrive();
          loadStoreSettings();
        }
      }
    }

  } catch (e) {
    console.error('Error loading admin state:', e);
  }
}

function stripPassword(user) {
  const { password, ...rest } = user || {};
  return rest;
}

function saveUsersToStorage() {
  localStorage.setItem('nourii_admin_users', JSON.stringify(ADMIN_STATE.users.map(stripPassword)));
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Every change goes through here so it carries the session token.
// If the backend rejects the session (expired, user deleted/disabled, password changed) we log out.
function driveRequest(payload) {
  const url = ADMIN_STATE.settings.googleScriptUrl;
  if (!url) return Promise.reject(new Error('Google Drive is not connected'));
  const token = ADMIN_STATE.currentUser && ADMIN_STATE.currentUser.token;
  return fetch(url, {
    method: 'POST',
    body: JSON.stringify(token ? { ...payload, token } : payload)
  })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (data && data.code === 'unauthorized' && ADMIN_STATE.currentUser) {
        endSession(data.message || 'انتهت الجلسة، يرجى تسجيل الدخول مجدداً.');
      }
      return data;
    });
}

function endSession(message) {
  ADMIN_STATE.currentUser = null;
  ADMIN_STATE.pendingLogin = null;
  localStorage.removeItem('nourii_admin_session');
  showAdminToast(message, 'error');
  checkAuthSession();
}

// AUTHENTICATION & SESSION MANAGEMENT
function checkAuthSession() {
  const loginScreen = document.getElementById('login-screen');
  const firstTimeScreen = document.getElementById('first-time-setup-screen');
  const dashboardLayout = document.getElementById('dashboard-layout');

  if (ADMIN_STATE.currentUser) {
    if (loginScreen) loginScreen.classList.add('hidden');
    if (firstTimeScreen) firstTimeScreen.classList.add('hidden');
    if (dashboardLayout) dashboardLayout.classList.remove('hidden');
    updateUserProfileDisplay();
    populateCategorySelectors();
    refreshAllData();
  } else {
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (firstTimeScreen) firstTimeScreen.classList.add('hidden');
    if (dashboardLayout) dashboardLayout.classList.add('hidden');
  }
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');

  const username = usernameInput ? usernameInput.value.trim().toLowerCase() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';

  // التحقق يتم من Google Drive فقط (المصدر الوحيد للمستخدمين وكلمات المرور)
  if (!ADMIN_STATE.settings.googleScriptUrl) {
    showLoginError('لا يمكن تسجيل الدخول: رابط Google Apps Script غير مضبوط في config.js.');
    return;
  }
  checkLoginWithGoogleDrive(username, password);
}

// Confirms with Google Drive that the saved session is still valid (user exists, active, same password)
function verifySessionWithDrive() {
  if (!ADMIN_STATE.currentUser || !ADMIN_STATE.currentUser.token) return;
  driveRequest({ action: 'getSession' })
    .then(res => {
      if (res.status === 'success' && res.user) {
        ADMIN_STATE.currentUser = { ...ADMIN_STATE.currentUser, fullName: res.user.fullName, role: res.user.role };
        localStorage.setItem('nourii_admin_session', JSON.stringify(ADMIN_STATE.currentUser));
        updateUserProfileDisplay();
        applyRoleVisibility();
      }
    })
    .catch(err => console.warn('Session check failed (offline?):', err));
}

function completeUserLogin(user, token) {
  ADMIN_STATE.currentUser = {
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    token: token || null,
    // Older backend versions don't issue tokens; remember that so the session isn't discarded
    legacy: !token
  };
  ADMIN_STATE.pendingLogin = null;

  localStorage.setItem('nourii_admin_session', JSON.stringify(ADMIN_STATE.currentUser));
  const errorMsg = document.getElementById('login-error-msg');
  if (errorMsg) errorMsg.classList.add('hidden');

  showAdminToast(`مرحباً بك مجدداً، ${user.fullName || user.username} 👋`, 'success');
  checkAuthSession();
  if (user.role === 'admin') {
    fetchLiveUsersFromGoogleDrive();
    loadStoreSettings(true);
  }
}

function checkLoginWithGoogleDrive(username, password) {
  showAdminToast('جاري التحقق من الحساب عبر Google Drive...', 'info');

  fetch(ADMIN_STATE.settings.googleScriptUrl, {
    method: 'POST',
    body: JSON.stringify({
      action: 'login',
      username: username,
      password: password
    })
  })
  .then(res => {
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('رابط Google Apps Script غير صالح أو تم تغييره (خطأ 404). يرجى نسخ رابط النشر الحالي من Apps Script.');
      }
      throw new Error(`تعذر الاتصال بخادم Google (${res.status})`);
    }
    return res.json();
  })
  .then(res => {
    if (res.status === 'success' && res.user) {
      const passwordInput = document.getElementById('login-password');
      if (passwordInput) passwordInput.value = '';

      if (res.user.mustChangePassword) {
        // Keep the temporary password in memory only, to confirm the change
        ADMIN_STATE.pendingLogin = { user: res.user, token: res.token || null, password };
        showFirstTimePasswordScreen(res.user);
      } else {
        completeUserLogin(res.user, res.token);
      }
    } else {
      showLoginError(res.message || 'اسم المستخدم أو كلمة المرور غير صحيحة.');
    }
  })
  .catch(err => {
    console.error(err);
    const msg = (err && err.message && err.message.includes('404'))
      ? err.message
      : 'تعذر الاتصال بـ Google Drive للتحقق من الحساب. تأكد من أن رابط النشر سليم ومضبوط على Anyone.';
    showLoginError(msg);
  });
}

function showLoginError(msg) {
  const errorMsg = document.getElementById('login-error-msg');
  if (errorMsg) {
    errorMsg.innerText = msg;
    errorMsg.classList.remove('hidden');
  }
}

function handleLogout() {
  ADMIN_STATE.currentUser = null;
  ADMIN_STATE.pendingLogin = null;
  localStorage.removeItem('nourii_admin_session');
  checkAuthSession();
  showAdminToast('تم تسجيل الخروج بنجاح.', 'info');
}

function togglePasswordVisibility(id) {
  const input = document.getElementById(id);
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
}

function updateUserProfileDisplay() {
  const nameEl = document.getElementById('current-user-name');
  const roleEl = document.getElementById('current-user-role');
  if (nameEl && ADMIN_STATE.currentUser) {
    nameEl.innerText = ADMIN_STATE.currentUser.fullName || ADMIN_STATE.currentUser.username;
  }
  if (roleEl && ADMIN_STATE.currentUser) {
    roleEl.innerText = ADMIN_STATE.currentUser.role === 'admin' ? 'Super Admin' : 'Editor';
  }
  applyRoleVisibility();
}

// Editors manage products only; everything else is for admins
const ADMIN_ONLY_TABS = ['categories', 'discounts', 'appearance', 'store', 'users'];

function applyRoleVisibility() {
  const isAdmin = ADMIN_STATE.currentUser && ADMIN_STATE.currentUser.role === 'admin';
  ADMIN_ONLY_TABS.forEach(tab => {
    const btn = document.getElementById(`tab-btn-${tab}`);
    if (btn) btn.classList.toggle('hidden', !isAdmin);
  });
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));
  if (!isAdmin && ADMIN_ONLY_TABS.includes(ADMIN_STATE.activeTab)) switchTab('overview');
}

const PASSWORD_MIN_LENGTH = 8;

// ========================================================
// 2. FIRST-TIME PASSWORD SETUP (إنشاء كلمة مرور أول مرة)
// ========================================================
function showFirstTimePasswordScreen(user) {
  const loginScreen = document.getElementById('login-screen');
  const firstTimeScreen = document.getElementById('first-time-setup-screen');
  const targetInput = document.getElementById('first-time-user-target');
  const nameDisplay = document.getElementById('first-time-username-display');

  if (loginScreen) loginScreen.classList.add('hidden');
  if (firstTimeScreen) firstTimeScreen.classList.remove('hidden');

  if (targetInput) targetInput.value = user.username;
  if (nameDisplay) nameDisplay.innerText = user.fullName || user.username;
}

function handleFirstTimePasswordSubmit(e) {
  e.preventDefault();
  const newPass = document.getElementById('first-time-new-pass').value.trim();
  const confirmPass = document.getElementById('first-time-confirm-pass').value.trim();
  const pending = ADMIN_STATE.pendingLogin;

  if (!pending) {
    showFirstTimeError('انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.');
    return;
  }
  if (newPass.length < PASSWORD_MIN_LENGTH) {
    showFirstTimeError(`يجب أن لا تقل كلمة المرور عن ${PASSWORD_MIN_LENGTH} خانات.`);
    return;
  }
  if (newPass !== confirmPass) {
    showFirstTimeError('كلمتا المرور غير متطابقتين! يرجى إعادة التأكيد.');
    return;
  }
  if (newPass === pending.password) {
    showFirstTimeError('اختر كلمة مرور مختلفة عن كلمة المرور المؤقتة.');
    return;
  }

  // Temporarily act as this user so the request carries the login token
  ADMIN_STATE.currentUser = { ...pending.user, token: pending.token };
  driveRequest({
    action: 'changePassword',
    username: pending.user.username,
    currentPassword: pending.password,
    newPassword: newPass
  })
    .then(res => {
      if (res.status === 'success') {
        showAdminToast('تم إنشاء كلمة المرور الخاصة بك بنجاح! 🎉', 'success');
        completeUserLogin({ ...pending.user, mustChangePassword: false }, res.token || pending.token);
      } else {
        ADMIN_STATE.currentUser = null;
        showFirstTimeError(res.message || 'تعذر حفظ كلمة المرور.');
      }
    })
    .catch(() => {
      ADMIN_STATE.currentUser = null;
      showFirstTimeError('تعذر الاتصال بـ Google Drive. حاول مرة أخرى.');
    });
}

function showFirstTimeError(msg) {
  const errorBox = document.getElementById('first-time-error-msg');
  if (errorBox) {
    errorBox.innerText = msg;
    errorBox.classList.remove('hidden');
  }
}

// ========================================================
// 1. CHANGE CURRENT USER'S PASSWORD (تغيير كلمة المرور الشخصية)
// ========================================================
function openChangePasswordModal() {
  const modal = document.getElementById('change-password-modal');
  const form = document.getElementById('change-password-form');
  const errorBox = document.getElementById('chg-pass-error');
  if (form) form.reset();
  if (errorBox) errorBox.classList.add('hidden');
  if (modal) modal.classList.remove('hidden');
}

function closeChangePasswordModal() {
  const modal = document.getElementById('change-password-modal');
  if (modal) modal.classList.add('hidden');
}

function handleChangePasswordSubmit(e) {
  e.preventDefault();
  if (!ADMIN_STATE.currentUser) return;

  const currentPass = document.getElementById('chg-current-pass').value.trim();
  const newPass = document.getElementById('chg-new-pass').value.trim();
  const confirmPass = document.getElementById('chg-confirm-pass').value.trim();
  const errorBox = document.getElementById('chg-pass-error');
  const showError = msg => {
    if (errorBox) {
      errorBox.innerText = msg;
      errorBox.classList.remove('hidden');
    }
  };

  if (newPass.length < PASSWORD_MIN_LENGTH) {
    showError(`كلمة المرور الجديدة يجب أن لا تقل عن ${PASSWORD_MIN_LENGTH} خانات.`);
    return;
  }
  if (newPass !== confirmPass) {
    showError('كلمتا المرور الجديدتان غير متطابقتين!');
    return;
  }

  // The backend checks the current password before changing it
  driveRequest({
    action: 'changePassword',
    username: ADMIN_STATE.currentUser.username,
    currentPassword: currentPass,
    newPassword: newPass
  })
    .then(res => {
      if (res.status === 'success') {
        if (res.token) {
          ADMIN_STATE.currentUser.token = res.token;
          localStorage.setItem('nourii_admin_session', JSON.stringify(ADMIN_STATE.currentUser));
        }
        closeChangePasswordModal();
        showAdminToast('تم تغيير كلمة المرور بنجاح! 🔒', 'success');
      } else {
        showError(res.message || 'تعذر تغيير كلمة المرور.');
      }
    })
    .catch(() => showError('تعذر الاتصال بـ Google Drive. حاول مرة أخرى.'));
}

// ========================================================
// 1. EDIT EXISTING USERS (تعديل المستخدمين وصلاحياتهم)
// ========================================================
function openEditUserModal(username) {
  const user = ADMIN_STATE.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return;

  const modal = document.getElementById('edit-user-modal');
  document.getElementById('edit-user-username').value = user.username;
  document.getElementById('edit-user-fullname').value = user.fullName || '';
  document.getElementById('edit-user-role').value = user.role || 'editor';
  document.getElementById('edit-user-status').value = user.isActive !== false ? 'active' : 'disabled';
  document.getElementById('edit-user-new-password').value = '';
  document.getElementById('edit-user-must-change-pass').checked = Boolean(user.mustChangePassword);

  if (modal) modal.classList.remove('hidden');
}

function closeEditUserModal() {
  const modal = document.getElementById('edit-user-modal');
  if (modal) modal.classList.add('hidden');
}

function handleEditUserFormSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('edit-user-username').value;
  const fullName = document.getElementById('edit-user-fullname').value.trim();
  const role = document.getElementById('edit-user-role').value;
  const isActive = document.getElementById('edit-user-status').value === 'active';
  const newPass = document.getElementById('edit-user-new-password').value.trim();
  const mustChange = document.getElementById('edit-user-must-change-pass').checked;

  if (newPass && newPass.length < PASSWORD_MIN_LENGTH) {
    showAdminToast(`كلمة المرور يجب أن لا تقل عن ${PASSWORD_MIN_LENGTH} خانات.`, 'error');
    return;
  }

  const user = { username, fullName, role, isActive, mustChangePassword: mustChange };
  if (newPass) user.password = newPass;

  saveUserToGoogleDrive(user).then(ok => {
    if (!ok) return;
    closeEditUserModal();
    showAdminToast(`تم تحديث بيانات المستخدم "${fullName}" بنجاح! ✨`, 'success');
  });
}

// ========================================================
// TAB SWITCHING & OVERVIEW
// ========================================================
function switchTab(tabId) {
  ADMIN_STATE.activeTab = tabId;

  const tabs = ['overview', 'products', 'categories', 'discounts', 'appearance', 'store', 'users', 'sync'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (el) el.classList.toggle('hidden', t !== tabId);
    if (btn) btn.classList.toggle('active', t === tabId);
  });

  const titleEl = document.getElementById('page-title');
  const subEl = document.getElementById('page-subtitle');

  if (tabId === 'overview') {
    titleEl.innerText = 'نظرة عامة';
    subEl.innerText = 'ملخص إحصائيات المتجر والمنتجات الحالية';
  } else if (tabId === 'products') {
    titleEl.innerText = 'إدارة المنتجات والكتالوج';
    subEl.innerText = 'إضافة، تعديل الأسعار، تغيير الصور، وتخصيص المنتجات';
    renderProductsTable();
  } else if (tabId === 'categories') {
    titleEl.innerText = 'الأقسام';
    subEl.innerText = 'إضافة أقسام جديدة وترتيبها وإخفاؤها';
    renderCategoriesTable();
    fetchCategoriesFromDrive();
  } else if (tabId === 'discounts') {
    titleEl.innerText = 'الخصومات وأكواد الخصم';
    subEl.innerText = 'خصم على كل المتجر أو قسم أو منتج، وأكواد يكتبها العميل في السلة';
    renderDiscountsEditor();
    loadStoreSettings();
  } else if (tabId === 'appearance') {
    titleEl.innerText = 'الإعلانات والواجهة';
    subEl.innerText = 'إعلانات أعلى الصفحة الرئيسية، شريط الإعلان، وبانر الصفحة الرئيسية';
    renderAdsList();
    loadStoreSettings();
  } else if (tabId === 'store') {
    titleEl.innerText = 'واتساب وروابط المتجر';
    subEl.innerText = 'رقم استقبال الطلبات وروابط السوشيال ميديا';
    loadStoreSettings();
  } else if (tabId === 'users') {
    titleEl.innerText = 'إدارة المستخدمين والمشرفين';
    subEl.innerText = 'التحكم في صلاحيات الوصول وإنشاء كلمات المرور';
    renderUsersTable();
    fetchLiveUsersFromGoogleDrive(false);
  } else if (tabId === 'sync') {
    titleEl.innerText = 'متقدم: Google Drive و GitHub';
    subEl.innerText = 'رابط قاعدة البيانات، ونسخة products.js الاحتياطية على GitHub';
    loadSyncSettingsInputs();
  }
}

function refreshAllData() {
  updateStatCards();
  renderProductsTable();
  renderUsersTable();
  loadSyncSettingsInputs();
}

function updateStatCards() {
  const totalProdEl = document.getElementById('stat-total-products');
  const totalUsersEl = document.getElementById('stat-total-users');
  const totalCatsEl = document.getElementById('stat-total-categories');
  if (totalProdEl) totalProdEl.innerText = ADMIN_STATE.products.length;
  if (totalCatsEl) totalCatsEl.innerText = ADMIN_STATE.categories.length;
  if (totalUsersEl) totalUsersEl.innerText = ADMIN_STATE.users.length;

  const waEl = document.getElementById('stat-whatsapp');
  if (waEl) {
    const number = ADMIN_STATE.storeSettings && ADMIN_STATE.storeSettings.whatsappNumber;
    const known = ADMIN_STATE.storeSettings !== null;
    waEl.textContent = number ? `+${number}` : known ? 'غير مضبوط! اضغط للضبط' : '...';
    waEl.classList.toggle('text-red-600', known && !number);
    waEl.classList.toggle('text-emerald-600', !known || Boolean(number));
  }
}

function populateCategorySelectors() {
  const filterSelect = document.getElementById('admin-category-filter');
  const formSelect = document.getElementById('prod-category');

  const hiddenNote = c => (c.isActive === false ? ' (مخفي)' : '');

  if (filterSelect) {
    let opts = `<option value="all">جميع الأقسام (${ADMIN_STATE.categories.length})</option>`;
    ADMIN_STATE.categories.forEach(c => {
      opts += `<option value="${escapeHtml(c.id)}">${escapeHtml(c.nameAr)}${c.nameEn ? ` (${escapeHtml(c.nameEn)})` : ''}${hiddenNote(c)}</option>`;
    });
    filterSelect.innerHTML = opts;
    filterSelect.value = ADMIN_STATE.categories.some(c => c.id === ADMIN_STATE.categoryFilter) ? ADMIN_STATE.categoryFilter : 'all';
  }

  if (formSelect) {
    const selected = formSelect.value;
    let opts = '';
    ADMIN_STATE.categories.forEach(c => {
      opts += `<option value="${escapeHtml(c.id)}">${escapeHtml(c.nameAr)}${hiddenNote(c)}</option>`;
    });
    formSelect.innerHTML = opts;
    if (selected) formSelect.value = selected;
  }
}

// ========================================================
// PRODUCTS MANAGEMENT
// ========================================================
function renderProductsTable() {
  const tbody = document.getElementById('admin-products-table-body');
  if (!tbody) return;

  let filtered = ADMIN_STATE.products.filter(p => {
    if (ADMIN_STATE.categoryFilter !== 'all' && p.categoryId !== ADMIN_STATE.categoryFilter) {
      return false;
    }
    if (ADMIN_STATE.searchQuery.trim() !== '') {
      const q = ADMIN_STATE.searchQuery.toLowerCase().trim();
      const matchAr = p.nameAr && p.nameAr.toLowerCase().includes(q);
      const matchEn = p.nameEn && p.nameEn.toLowerCase().includes(q);
      const matchCat = p.categoryId && p.categoryId.toLowerCase().includes(q);
      if (!matchAr && !matchEn && !matchCat) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-12 text-stone-400">
          <i class="fa-solid fa-box-open text-3xl mb-2 block text-stone-300"></i>
          لا توجد منتجات مطابقة للبحث أو القسم المحدد.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const cat = ADMIN_STATE.categories.find(c => c.id === p.categoryId);
    const catName = cat ? cat.nameAr : p.categoryId;
    const mediaCount = { images: parseMediaList(p.images).length, videos: parseMediaList(p.videos).length };

    return `
      <tr>
        <td class="w-16">
          <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.nameAr)}" class="w-12 h-12 rounded-xl object-cover border border-stone-200 dark:border-stone-700 bg-stone-100">
        </td>
        <td>
          <div class="font-bold text-sm text-stone-900 dark:text-stone-100">${escapeHtml(p.nameAr)}</div>
          <div class="text-[11px] text-stone-400 font-mono">${escapeHtml(p.nameEn)}</div>
          ${mediaCount.images || mediaCount.videos ? `
            <div class="text-[11px] text-stone-500 flex items-center gap-3 mt-0.5">
              ${mediaCount.images ? `<span><i class="fa-regular fa-images text-pink-500"></i> +${mediaCount.images}</span>` : ''}
              ${mediaCount.videos ? `<span><i class="fa-solid fa-video text-pink-500"></i> ${mediaCount.videos}</span>` : ''}
            </div>` : ''}
        </td>
        <td>
          <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300">
            ${escapeHtml(catName)}
          </span>
        </td>
        <td>
          <div class="font-black text-sm text-pink-600">${p.price} ج.م</div>
          ${p.originalPrice ? `<span class="text-xs text-stone-400 line-through">${p.originalPrice} ج.م</span>` : ''}
          ${productDiscountPercent(p) ? `<span class="block text-[11px] font-bold text-amber-700">خصم ${productDiscountPercent(p)}% ← ${Math.round(p.price * (100 - productDiscountPercent(p)) / 100)} ج.م</span>` : ''}
        </td>
        <td>
          ${p.badgeAr ? `
            <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              ${escapeHtml(p.badgeAr)}
            </span>
          ` : '<span class="text-xs text-stone-400">-</span>'}
        </td>
        <td>
          ${p.isCustomizable ? `
            <span class="text-xs text-emerald-600 font-bold flex items-center gap-1">
              <i class="fa-solid fa-check"></i> متاح بالاسم
            </span>
          ` : '<span class="text-xs text-stone-400">لا</span>'}
        </td>
        <td class="text-center">
          <div class="flex items-center justify-center gap-2">
            <button onclick="openEditProductModal('${escapeHtml(p.id)}')" class="p-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 transition-colors" title="تعديل">
              <i class="fa-solid fa-pen-to-square text-xs"></i>
            </button>
            <button onclick="deleteProduct('${escapeHtml(p.id)}')" class="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors" title="حذف">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function handleProductSearch(val) {
  ADMIN_STATE.searchQuery = val;
  renderProductsTable();
}

function handleCategoryFilter(val) {
  ADMIN_STATE.categoryFilter = val;
  renderProductsTable();
}

function openAddProductModal() {
  const modal = document.getElementById('product-form-modal');
  const title = document.getElementById('product-modal-title');
  const form = document.getElementById('product-form');

  if (title) title.innerText = 'إضافة منتج جديد';
  if (form) form.reset();

  document.getElementById('prod-form-id').value = '';
  ADMIN_STATE.formMedia = { images: [], videos: [] };
  renderFormMediaLists();
  modal.classList.remove('hidden');
}

function openEditProductModal(id) {
  const prod = ADMIN_STATE.products.find(p => p.id === id);
  if (!prod) return;

  const modal = document.getElementById('product-form-modal');
  const title = document.getElementById('product-modal-title');

  if (title) title.innerText = 'تعديل بيانات المنتج';

  document.getElementById('prod-form-id').value = prod.id;
  document.getElementById('prod-name-ar').value = prod.nameAr || '';
  document.getElementById('prod-name-en').value = prod.nameEn || '';
  document.getElementById('prod-category').value = prod.categoryId || 'others';
  document.getElementById('prod-price').value = prod.price || '';
  document.getElementById('prod-original-price').value = prod.originalPrice || '';
  document.getElementById('prod-image-url').value = prod.image || '';
  document.getElementById('prod-badge-ar').value = prod.badgeAr || '';
  document.getElementById('prod-badge-en').value = prod.badgeEn || '';
  document.getElementById('prod-customizable').checked = Boolean(prod.isCustomizable);
  document.getElementById('prod-custom-label-ar').value = prod.customFieldLabelAr || '';
  document.getElementById('prod-desc-ar').value = prod.descriptionAr || '';
  ADMIN_STATE.formMedia = { images: parseMediaList(prod.images), videos: parseMediaList(prod.videos) };
  renderFormMediaLists();

  modal.classList.remove('hidden');
}

function closeProductFormModal() {
  const modal = document.getElementById('product-form-modal');
  if (modal) modal.classList.add('hidden');
}

function handleProductFormSubmit(e) {
  e.preventDefault();

  const idInput = document.getElementById('prod-form-id').value;
  const isEditing = Boolean(idInput);
  const id = isEditing ? idInput : `prod-${Date.now()}`;
  // Editing keeps what the form doesn't show (English description, rating...)
  const existing = isEditing ? ADMIN_STATE.products.find(p => p.id === id) || {} : { rating: 5.0, reviewsCount: 1, descriptionEn: '' };

  const productObj = {
    ...existing,
    id: id,
    categoryId: document.getElementById('prod-category').value,
    nameAr: document.getElementById('prod-name-ar').value.trim(),
    nameEn: document.getElementById('prod-name-en').value.trim(),
    price: Number(document.getElementById('prod-price').value) || 0,
    originalPrice: Number(document.getElementById('prod-original-price').value) || 0,
    image: document.getElementById('prod-image-url').value.trim(),
    images: [...ADMIN_STATE.formMedia.images],
    videos: [...ADMIN_STATE.formMedia.videos],
    badgeAr: document.getElementById('prod-badge-ar').value.trim(),
    badgeEn: document.getElementById('prod-badge-en').value.trim(),
    isCustomizable: document.getElementById('prod-customizable').checked,
    customFieldLabelAr: document.getElementById('prod-custom-label-ar').value.trim(),
    descriptionAr: document.getElementById('prod-desc-ar').value.trim()
  };

  const applyLocally = () => {
    if (isEditing) {
      const idx = ADMIN_STATE.products.findIndex(p => p.id === id);
      if (idx > -1) ADMIN_STATE.products[idx] = productObj;
    } else {
      ADMIN_STATE.products.unshift(productObj);
    }
    saveProductsToStorage();
    closeProductFormModal();
    renderProductsTable();
    updateStatCards();
  };

  if (!ADMIN_STATE.settings.googleScriptUrl) {
    applyLocally();
    showAdminToast(isEditing ? 'تم حفظ التعديل على هذا الجهاز فقط.' : 'تمت إضافة المنتج على هذا الجهاز فقط.', 'info');
    return;
  }

  const button = e.submitter || document.querySelector('#product-form [type="submit"]');
  saveWithProgress(isEditing ? `حفظ "${productObj.nameAr}"` : `إضافة "${productObj.nameAr}"`, { action: 'saveProduct', product: productObj }, {
    button,
    doneMessage: 'تم الحفظ ✓ يظهر في الموقع خلال دقائق'
  }).then(res => { if (res) applyLocally(); });
}

function deleteProduct(id) {
  const prod = ADMIN_STATE.products.find(p => p.id === id);
  const name = prod ? prod.nameAr : '';
  if (!confirm(`هل أنت متأكد من حذف المنتج: "${name}"؟`)) return;

  const removeLocally = () => {
    ADMIN_STATE.products = ADMIN_STATE.products.filter(p => p.id !== id);
    saveProductsToStorage();
    renderProductsTable();
    updateStatCards();
  };
  if (!ADMIN_STATE.settings.googleScriptUrl) return removeLocally();
  saveWithProgress(`حذف "${name}"`, { action: 'deleteProduct', id }, { doneMessage: 'تم الحذف ✓' })
    .then(res => { if (res) removeLocally(); });
}

function saveProductsToStorage() {
  localStorage.setItem('nourii_admin_products', JSON.stringify(ADMIN_STATE.products));
  localStorage.setItem('nourii_live_products', JSON.stringify(ADMIN_STATE.products));
  markStoreChanged();
}

// ========================================================
// USERS MANAGEMENT
// ========================================================
function renderUsersTable() {
  const tbody = document.getElementById('admin-users-table-body');
  if (!tbody) return;

  tbody.innerHTML = ADMIN_STATE.users.map((u, i) => {
    const isSuperAdmin = u.username.toLowerCase() === 'admin';
    const isSelfUser = ADMIN_STATE.currentUser && ADMIN_STATE.currentUser.username.toLowerCase() === u.username.toLowerCase();

    return `
      <tr>
        <td class="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <i class="fa-solid fa-user-circle text-stone-400 text-lg"></i>
          <span>${escapeHtml(u.username)}</span>
          ${isSelfUser ? '<span class="text-[10px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded font-bold">أنت</span>' : ''}
        </td>
        <td class="text-sm">${escapeHtml(u.fullName)}</td>
        <td>
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${
            u.role === 'admin' ? 'badge-role-admin' : 'badge-role-editor'
          }">
            ${u.role === 'admin' ? 'مشرف رئيسي (Admin)' : 'محرر (Editor)'}
          </span>
        </td>
        <td class="text-xs text-stone-400">${escapeHtml(u.createdAt ? String(u.createdAt).slice(0, 10) : '-')}</td>
        <td>
          ${u.isActive !== false ? `
            <span class="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span> نشط
            </span>
          ` : `
            <span class="text-xs font-bold text-red-500 flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-red-400"></span> معطل
            </span>
          `}
          ${u.mustChangePassword ? `
            <span class="text-[10px] text-amber-600 block mt-0.5">⚠️ بانتظار تعيين كلمة مرور</span>
          ` : ''}
        </td>
        <td class="text-center">
          <div class="flex items-center justify-center gap-2">
            <!-- Edit User Button -->
            <button onclick="openEditUserModal('${escapeHtml(u.username)}')" class="p-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 transition-colors" title="تعديل المستخدم">
              <i class="fa-solid fa-pen-to-square text-xs"></i>
            </button>

            ${isSuperAdmin || isSelfUser ? '' : `
              <button onclick="deleteUser('${escapeHtml(u.username)}')" class="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors" title="حذف المستخدم">
                <i class="fa-solid fa-trash-can text-xs"></i>
              </button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddUserModal() {
  const modal = document.getElementById('user-form-modal');
  const form = document.getElementById('user-form');
  if (form) form.reset();
  const mustChangeBox = document.getElementById('user-must-change-pass');
  if (mustChangeBox) mustChangeBox.checked = true;
  if (modal) modal.classList.remove('hidden');
}

function closeUserFormModal() {
  const modal = document.getElementById('user-form-modal');
  if (modal) modal.classList.add('hidden');
}

function handleUserFormSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('user-username').value.trim().toLowerCase();
  const fullName = document.getElementById('user-fullname').value.trim();
  const password = document.getElementById('user-password').value.trim();
  const role = document.getElementById('user-role').value;
  const mustChange = document.getElementById('user-must-change-pass').checked;

  if (ADMIN_STATE.users.some(u => u.username.toLowerCase() === username)) {
    showAdminToast('اسم المستخدم مسجل بالفعل!', 'error');
    return;
  }
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    showAdminToast('اسم المستخدم يجب أن يكون 3-30 حرفاً إنجليزياً أو أرقام بدون مسافات.', 'error');
    return;
  }
  if (password && password.length < PASSWORD_MIN_LENGTH) {
    showAdminToast(`كلمة المرور يجب أن لا تقل عن ${PASSWORD_MIN_LENGTH} خانات.`, 'error');
    return;
  }

  const newUser = { username, fullName, password, role, isActive: true, mustChangePassword: mustChange };

  saveUserToGoogleDrive(newUser).then(ok => {
    if (!ok) return;
    closeUserFormModal();
    showAdminToast(`تمت إضافة المستخدم "${fullName}" بنجاح! سيُطلب منه تعيين كلمة مروره الخاصة عند أول دخول. 🔐`, 'success');
  });
}

function deleteUser(username) {
  if (!confirm(`هل أنت متأكد من حذف المستخدم "${username}"؟`)) return;

  driveRequest({ action: 'deleteUser', username: username })
    .then(data => {
      if (data.status === 'success') {
        showAdminToast(`تم حذف المستخدم "${username}" نهائياً من Google Drive! 🗑️`, 'info');
        fetchLiveUsersFromGoogleDrive(false);
      } else {
        showAdminToast(`تعذر حذف المستخدم: ${data.message || 'خطأ'}`, 'error');
      }
    })
    .catch(e => {
      console.warn('Drive user delete err:', e);
      showAdminToast('تعذر الاتصال بـ Google Drive لحذف المستخدم.', 'error');
    });
}

// Users live only in Google Drive; resolves true when saved
function saveUserToGoogleDrive(user) {
  return driveRequest({ action: 'saveUser', user: user })
    .then(data => {
      if (data.status !== 'success') {
        showAdminToast(`تعذر حفظ المستخدم: ${data.message || 'خطأ'}`, 'error');
        return false;
      }
      if (data.tempPassword) {
        // Shown once to the admin, who passes it to the new user
        alert(`كلمة المرور المؤقتة للمستخدم "${user.username}":\n\n${data.tempPassword}\n\nأرسلها له، وسيُطلب منه تغييرها عند أول دخول.`);
      }
      fetchLiveUsersFromGoogleDrive(false);
      return true;
    })
    .catch(e => {
      console.warn('Drive user sync err:', e);
      showAdminToast('تعذر الاتصال بـ Google Drive. لم يتم حفظ المستخدم.', 'error');
      return false;
    });
}

function fetchLiveUsersFromGoogleDrive(notify = false) {
  if (!ADMIN_STATE.settings.googleScriptUrl) {
    if (notify) showAdminToast('يرجى ربط رابط Google Apps Script أولاً.', 'error');
    return;
  }
  if (!ADMIN_STATE.currentUser || ADMIN_STATE.currentUser.role !== 'admin') return;

  if (notify) showAdminToast('جاري سحب وتحديث قائمة المستخدمين من Google Drive...', 'info');

  driveRequest({ action: 'getUsers' })
    .then(res => {
      if (res.status === 'success' && Array.isArray(res.data)) {
        // قاعدة بيانات Google Drive هي المصدر الوحيد للمستخدمين
        ADMIN_STATE.users = res.data.map(stripPassword);
        saveUsersToStorage();
        renderUsersTable();
        updateStatCards();
        if (notify) showAdminToast('تمت مزامنة المستخدمين بنجاح مع Google Drive! 👥', 'success');
      } else if (notify) {
        showAdminToast(res.message || 'تعذر جلب المستخدمين.', 'error');
      }
    })
    .catch(err => {
      console.warn('Fetch live users error:', err);
      if (notify) showAdminToast('تعذر الاتصال بـ Google Drive لجلب المستخدمين. تأكد من صحة الرابط.', 'error');
    });
}

// ========================================================
// 3. GOOGLE DRIVE AS PRIMARY DATABASE (قاعدة البيانات الرئيسية)
// ========================================================
function loadSyncSettingsInputs() {
  const scriptInput = document.getElementById('google-script-url');
  const patInput = document.getElementById('github-pat-token');
  if (scriptInput) scriptInput.value = ADMIN_STATE.settings.googleScriptUrl || '';
  if (patInput) patInput.value = ADMIN_STATE.settings.githubToken || '';
}

function saveAndTestGoogleDrive() {
  const input = document.getElementById('google-script-url');
  if (!input) return;

  const url = input.value.trim();
  if (!url) {
    showAdminToast('يرجى إدخال رابط Google Apps Script Web App', 'error');
    return;
  }

  ADMIN_STATE.settings.googleScriptUrl = url;
  localStorage.setItem('nourii_google_script_url', url);
  showAdminToast('جاري الاتصال بـ Google Drive وتفعيله كقاعدة بيانات رئيسية...', 'info');

  fetch(`${url}?action=ping`)
    .then(res => res.json())
    .then(data => {
      if (data.status === 'success') {
        showAdminToast('تم ربط وتفعيل Google Drive كقاعدة بيانات رئيسية بنجاح! 🟢', 'success');
        updateSyncStatusIndicator('Google Drive متصل (المصدر الرئيسي)', 'ok');
        // جلب المنتجات فوراً
        syncFromGoogleDrive();
      } else {
        showAdminToast('فشل التحقق: ' + (data.message || 'خطأ غير معروف'), 'error');
      }
    })
    .catch(err => {
      console.warn('Ping error:', err);
      showAdminToast('تم حفظ الرابط بنجاح! 🟢', 'success');
    });
}

function syncSilentlyFromGoogleDrive() {
  const url = ADMIN_STATE.settings.googleScriptUrl;
  if (!url) return;

  fetch(`${url}?action=getProducts`)
    .then(res => res.json())
    .then(res => {
      if (res.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
        ADMIN_STATE.products = res.data;
        saveProductsToStorage();
        renderProductsTable();
        updateStatCards();
        updateSyncStatusIndicator('Google Drive متصل (المصدر الرئيسي)', 'ok');
      }
    })
    .catch(err => console.warn('Silent drive sync:', err));
}

function syncFromGoogleDrive() {
  const url = ADMIN_STATE.settings.googleScriptUrl;
  if (!url) {
    showAdminToast('يرجى ربط رابط Google Apps Script أولاً', 'error');
    return;
  }

  showAdminToast('جاري سحب أحدث المنتجات من Google Sheets...', 'info');

  fetch(`${url}?action=getProducts`)
    .then(res => res.json())
    .then(res => {
      if (res.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
        ADMIN_STATE.products = res.data;
        saveProductsToStorage();
        renderProductsTable();
        updateStatCards();
        showAdminToast(`تم جلب ${res.data.length} منتج بنجاح من Google Drive! 📥`, 'success');
      } else {
        showAdminToast('تم الاتصال ولكن ورقة Products فارغة حالياً.', 'info');
      }
    })
    .catch(err => {
      console.error(err);
      showAdminToast('تعذر الاتصال بـ Google Apps Script، تأكد من نشر الرابط كـ Anyone.', 'error');
    });
}

function pushToGoogleDrive() {
  const url = ADMIN_STATE.settings.googleScriptUrl;
  if (!url) {
    showAdminToast('يرجى ربط رابط Google Apps Script أولاً', 'error');
    return;
  }

  if (!confirm(`سيتم مسح كل منتجات Google Sheet واستبدالها بالـ ${ADMIN_STATE.products.length} منتج الموجودين في هذا المتصفح. استخدمه فقط لاستعادة نسخة. متابعة؟`)) return;
  showAdminToast('جاري تصدير ومزامنة جميع المنتجات إلى Google Sheet...', 'info');

  const prods = ADMIN_STATE.products;

  // المحاولة الأولى: تصدير سريع دفعة واحدة Bulk Import
  driveRequest({
    action: 'bulkImportProducts',
    products: prods
  })
  .then(d => {
    if (d.status === 'success') {
      showAdminToast(`تم تصدير وحفظ كافة الـ ${prods.length} منتج بنجاح في Google Sheet! 📤✨`, 'success');
    } else {
      throw new Error(d.message || 'Bulk failed');
    }
  })
  .catch(err => {
    console.warn('Bulk import fallback to sequential:', err);
    let successCount = 0;
    const pushItem = (index) => {
      if (index >= prods.length) {
        if (successCount > 0) {
          showAdminToast(`تم تصدير ${successCount} منتج بنجاح إلى Google Drive! 📤`, 'success');
        } else {
          showAdminToast('تعذر التصدير. تأكد من تسجيل الدخول ومن ضبط إعداد النشر في Google Apps Script على Anyone (أي شخص).', 'error');
        }
        return;
      }

      driveRequest({
        action: 'saveProduct',
        product: prods[index]
      })
      .then(d => {
        if (d.status === 'success') successCount++;
        pushItem(index + 1);
      })
      .catch(() => pushItem(index + 1));
    };
    pushItem(0);
  });
}

// ========================================================
// PHOTOS & VIDEOS (product gallery, category and home page media)
// ========================================================
const MAX_UPLOAD_MB = { image: 5, video: 25 };

// Links kept one per line in the Sheet (or an array)
function parseMediaList(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[\n,|]+/);
  return list.map(s => String(s || '').trim()).filter(s => /^(https?:\/\/|assets\/)/i.test(s));
}

// The storefront plays these sites inside the page; other links become a "watch" button
function videoLinkLabel(url) {
  let host = '';
  try { host = new URL(url).hostname.replace(/^(www|m)\./, ''); } catch (err) { return 'رابط'; }
  if (host === 'youtu.be' || host.endsWith('youtube.com')) return 'YouTube';
  if (host.endsWith('instagram.com')) return 'Instagram';
  if (/^v[mt]\.tiktok\.com$/.test(host)) return 'TikTok (رابط مختصر)';
  if (host.endsWith('tiktok.com')) return 'TikTok';
  if (host.endsWith('facebook.com') || host === 'fb.watch') return 'Facebook';
  if (host === 'drive.google.com') return 'Google Drive';
  return 'رابط';
}

// Marks the store's cached data as old so this browser reloads it on the next store visit
function markStoreChanged() {
  localStorage.removeItem('nourii_live_store_at');
}

// Uploads one photo or video to the "Nourii Media" folder in Google Drive and resolves its link.
// The progress panel shows: reading the file (real %), sending it (browsers can't measure an
// upload to Apps Script, so the bar follows the time expected for its size), then done.
function uploadMediaFile(file, task) {
  const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : null;
  if (!ADMIN_STATE.settings.googleScriptUrl) {
    return Promise.reject(new Error('لرفع الملفات يرجى ربط رابط Google Apps Script أولاً في تبويب المزامنة.'));
  }
  if (!kind) return Promise.reject(new Error('يمكن رفع الصور أو الفيديو فقط.'));
  if (file.size > MAX_UPLOAD_MB[kind] * 1024 * 1024) {
    return Promise.reject(new Error(kind === 'video'
      ? 'الفيديو أكبر من 25 ميجا. ارفعه على يوتيوب أو انستجرام والصق الرابط بدلاً من ذلك.'
      : 'الصورة أكبر من 5 ميجا. صغّر حجمها ثم حاول مجدداً.'));
  }

  const sizeMB = file.size / (1024 * 1024);
  const sizeLabel = sizeMB >= 1 ? `${sizeMB.toFixed(1)} ميجا` : `${Math.max(1, Math.round(file.size / 1024))} كيلو`;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = evt => {
      if (task && evt.lengthComputable) {
        task.update(`الخطوة 1 من 2: تجهيز الملف (${Math.round(evt.loaded / evt.total * 100)}%)`, 0.1 * evt.loaded / evt.total);
      }
    };
    reader.onload = evt => resolve(evt.target.result);
    reader.onerror = () => reject(new Error('تعذر قراءة الملف.'));
    reader.readAsDataURL(file);
  })
    .then(base64Data => {
      const expectedSeconds = 3 + sizeMB * 2.5;
      const sentAt = Date.now();
      const step = () => {
        const elapsed = (Date.now() - sentAt) / 1000;
        const left = Math.max(1, Math.round(expectedSeconds - elapsed));
        task.update(
          elapsed < expectedSeconds
            ? `الخطوة 2 من 2: الرفع إلى Google Drive (${sizeLabel}) — متبقي حوالي ${left} ث`
            : `الخطوة 2 من 2: Google Drive يحفظ الملف (${sizeLabel})... لحظات`,
          0.1 + 0.85 * Math.min(0.97, elapsed / expectedSeconds)
        );
      };
      const timer = task ? (step(), setInterval(step, 400)) : null;
      return driveRequest({
        // Photos keep the older action name so they still upload before the backend is redeployed
        action: kind === 'video' ? 'uploadMedia' : 'uploadImage',
        base64Data,
        filename: file.name,
        mimeType: file.type
      }).finally(() => clearInterval(timer));
    })
    .then(res => {
      if (res.status === 'success' && (res.url || res.imageUrl)) return res.url || res.imageUrl;
      if (res.message === 'Unknown action') throw new Error('رفع الفيديو يحتاج تحديث كود Google Apps Script أولاً.');
      throw new Error(res.message || 'فشل الرفع.');
    });
}

function setUploadBusy(input, busy) {
  const label = input && input.closest('label');
  if (label) label.classList.toggle('is-busy', busy);
}

// Runs uploads one after another, each with its own progress line; calls onUploaded(url, file)
function uploadFilesWithProgress(input, files, onUploaded) {
  setUploadBusy(input, true);
  return files.reduce((chain, file) => chain.then(() => {
    const task = startTask(`رفع ${file.name}`);
    return uploadMediaFile(file, task)
      .then(url => {
        onUploaded(url, file);
        task.done(file.type.startsWith('video/')
          ? 'تم رفع الفيديو ✓ (يعمل على الموقع بعد دقائق قليلة) — لا تنسَ الحفظ'
          : 'تم رفع الصورة ✓ — لا تنسَ الحفظ');
      })
      .catch(err => task.fail(err.message));
  }), Promise.resolve())
    .finally(() => setUploadBusy(input, false));
}

// Upload button next to a single link field (main photo, category photo/video, home banner)
function uploadIntoField(event, fieldId) {
  const input = event.target;
  const files = [...input.files].slice(0, 1);
  input.value = '';
  if (!files.length) return;
  uploadFilesWithProgress(input, files, url => { document.getElementById(fieldId).value = url; });
}

// Upload buttons of the product's extra photos / videos lists (several files, one after another)
function uploadIntoList(event, kind) {
  const input = event.target;
  const files = [...input.files];
  input.value = '';
  if (!files.length) return;
  uploadFilesWithProgress(input, files, url => {
    ADMIN_STATE.formMedia[kind].push(url);
    renderFormMediaLists();
  });
}

function addMediaLink(kind) {
  const input = document.getElementById(`prod-${kind}-link`);
  const url = input.value.trim();
  if (!/^https?:\/\//i.test(url)) {
    showAdminToast('الصق رابطاً كاملاً يبدأ بـ https://', 'error');
    return;
  }
  if (kind === 'videos' && videoLinkLabel(url).includes('مختصر')) {
    showAdminToast('روابط تيك توك المختصرة تظهر كزر فقط. لعرض الفيديو داخل الموقع افتح الرابط وانسخ الرابط الكامل.', 'info');
  }
  if (!ADMIN_STATE.formMedia[kind].includes(url)) ADMIN_STATE.formMedia[kind].push(url);
  input.value = '';
  renderFormMediaLists();
}

function removeFormMedia(kind, index) {
  ADMIN_STATE.formMedia[kind].splice(index, 1);
  renderFormMediaLists();
}

function renderFormMediaLists() {
  const imagesEl = document.getElementById('prod-images-list');
  const videosEl = document.getElementById('prod-videos-list');
  const removeBtn = (kind, i) => `
    <button type="button" onclick="removeFormMedia('${kind}', ${i})" title="حذف"
      class="w-6 h-6 rounded-full bg-red-600 hover:bg-red-700 text-white text-[10px] flex items-center justify-center flex-shrink-0">
      <i class="fa-solid fa-xmark"></i>
    </button>`;

  if (imagesEl) {
    imagesEl.innerHTML = ADMIN_STATE.formMedia.images.map((src, i) => `
      <div class="relative">
        <img src="${escapeHtml(src)}" alt="" class="w-16 h-16 rounded-lg object-cover border border-stone-200 dark:border-stone-700 bg-stone-100">
        <div class="absolute -top-2 -end-2">${removeBtn('images', i)}</div>
      </div>`).join('') || '<span class="text-[11px] text-stone-400">لا توجد صور إضافية</span>';
  }
  if (videosEl) {
    videosEl.innerHTML = ADMIN_STATE.formMedia.videos.map((url, i) => `
      <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-800/60">
        <i class="fa-solid fa-circle-play text-pink-600"></i>
        <span class="text-[11px] font-bold whitespace-nowrap">${escapeHtml(videoLinkLabel(url))}</span>
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener" dir="ltr" class="flex-1 min-w-0 truncate text-[11px] text-stone-500 hover:text-pink-600">${escapeHtml(url)}</a>
        ${removeBtn('videos', i)}
      </div>`).join('') || '<span class="text-[11px] text-stone-400">لا توجد فيديوهات</span>';
  }
}

// ========================================================
// CATEGORIES (Categories sheet; the store menu follows it automatically)
// ========================================================
function categoryProductCount(id) {
  return ADMIN_STATE.products.filter(p => p.categoryId === id).length;
}

function fetchCategoriesFromDrive() {
  const url = ADMIN_STATE.settings.googleScriptUrl;
  if (!url) return Promise.resolve();
  return fetch(`${url}?action=getCategories`)
    .then(res => res.json())
    .then(res => {
      if (res.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
        ADMIN_STATE.categories = res.data;
        localStorage.setItem('nourii_admin_categories', JSON.stringify(res.data));
        populateCategorySelectors();
        renderCategoriesTable();
        renderProductsTable();
        renderDiscountsEditor();
        populateStorePagesList();
        updateStatCards();
      }
    })
    .catch(err => console.warn('Categories fetch:', err));
}

function renderCategoriesTable() {
  const tbody = document.getElementById('admin-categories-table-body');
  if (!tbody) return;
  const cats = ADMIN_STATE.categories;

  if (cats.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-12 text-stone-400">لا توجد أقسام بعد.</td></tr>`;
    return;
  }

  tbody.innerHTML = cats.map((c, i) => {
    const id = escapeHtml(c.id);
    const active = c.isActive !== false;
    const arrow = (dir, disabled) => `
      <button onclick="moveCategory('${id}', ${dir})" ${disabled ? 'disabled' : ''} title="${dir < 0 ? 'لأعلى' : 'لأسفل'}"
        class="w-7 h-6 rounded-md bg-stone-100 dark:bg-stone-800 hover:bg-pink-100 dark:hover:bg-stone-700 text-[10px] disabled:opacity-30 disabled:pointer-events-none">
        <i class="fa-solid fa-chevron-${dir < 0 ? 'up' : 'down'}"></i>
      </button>`;
    return `
      <tr class="${active ? '' : 'opacity-60'}">
        <td class="w-16"><div class="flex flex-col gap-1 items-center">${arrow(-1, i === 0)}${arrow(1, i === cats.length - 1)}</div></td>
        <td class="w-16">
          ${c.image
            ? `<img src="${escapeHtml(c.image)}" alt="" class="w-12 h-12 rounded-xl object-cover border border-stone-200 dark:border-stone-700 bg-stone-100">`
            : `<div class="w-12 h-12 rounded-xl bg-pink-50 dark:bg-stone-800 text-pink-400 flex items-center justify-center"><i class="fa-solid ${escapeHtml(c.icon || 'fa-tag')}"></i></div>`}
        </td>
        <td>
          <div class="font-bold text-sm text-stone-900 dark:text-stone-100">${escapeHtml(c.nameAr)}</div>
          <div class="text-[11px] text-stone-400 font-mono" dir="ltr">${escapeHtml(c.nameEn || '')} · ?cat=${id}</div>
        </td>
        <td><span class="font-black text-sm">${categoryProductCount(c.id)}</span></td>
        <td>${c.video ? '<i class="fa-solid fa-video text-pink-600" title="فيه فيديو"></i>' : '<span class="text-xs text-stone-400">-</span>'}</td>
        <td>
          ${active
            ? '<span class="text-xs text-emerald-600 font-bold flex items-center gap-1"><i class="fa-solid fa-eye"></i> ظاهر</span>'
            : '<span class="text-xs text-stone-500 font-bold flex items-center gap-1"><i class="fa-solid fa-eye-slash"></i> مخفي</span>'}
        </td>
        <td class="text-center">
          <div class="flex items-center justify-center gap-2">
            <a href="shop.html?cat=${encodeURIComponent(c.id)}" target="_blank" class="p-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300" title="فتح صفحة القسم">
              <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
            </a>
            <button onclick="openCategoryModal('${id}')" class="p-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300" title="تعديل">
              <i class="fa-solid fa-pen-to-square text-xs"></i>
            </button>
            <button onclick="toggleCategoryVisibility('${id}')" class="p-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300" title="${active ? 'إخفاء من المتجر' : 'إظهار في المتجر'}">
              <i class="fa-solid ${active ? 'fa-eye-slash' : 'fa-eye'} text-xs"></i>
            </button>
            <button onclick="deleteCategory('${id}')" class="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600" title="حذف">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// Turns an English name into a page link id, e.g. "Wooden Toys" → "wooden-toys"
function slugifyCategoryId(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function suggestCategoryId() {
  const idInput = document.getElementById('cat-id');
  if (idInput.readOnly || idInput.dataset.touched) return;
  idInput.value = slugifyCategoryId(document.getElementById('cat-name-en').value);
}

function openCategoryModal(id) {
  const cat = id ? ADMIN_STATE.categories.find(c => c.id === id) : null;
  const idInput = document.getElementById('cat-id');

  document.getElementById('category-form').reset();
  document.getElementById('category-modal-title').innerText = cat ? 'تعديل القسم' : 'إضافة قسم جديد';
  document.getElementById('cat-form-editing').value = cat ? cat.id : '';
  idInput.readOnly = Boolean(cat);
  delete idInput.dataset.touched;
  idInput.oninput = () => { idInput.dataset.touched = '1'; };

  if (cat) {
    document.getElementById('cat-name-ar').value = cat.nameAr || '';
    document.getElementById('cat-name-en').value = cat.nameEn || '';
    idInput.value = cat.id;
    document.getElementById('cat-image-url').value = cat.image || '';
    document.getElementById('cat-video-url').value = cat.video || '';
    document.getElementById('cat-desc-ar').value = cat.descriptionAr || '';
    document.getElementById('cat-desc-en').value = cat.descriptionEn || '';
    document.getElementById('cat-active').checked = cat.isActive !== false;
  }
  document.getElementById('category-form-modal').classList.remove('hidden');
}

function closeCategoryModal() {
  document.getElementById('category-form-modal').classList.add('hidden');
}

// Sends one category to Google Drive; resolves true when saved
function saveCategoryToDrive(category, isNew, button) {
  const title = isNew ? `إضافة قسم "${category.nameAr}"` : `حفظ قسم "${category.nameAr}"`;
  return saveWithProgress(title, { action: 'saveCategory', category: { ...category, isNew } }, {
    button,
    doneMessage: 'تم الحفظ ✓ يظهر في قائمة الموقع خلال دقائق'
  }).then(res => (res ? fetchCategoriesFromDrive().then(() => true) : false));
}

function handleCategoryFormSubmit(e) {
  e.preventDefault();
  const editingId = document.getElementById('cat-form-editing').value;
  const nameEn = document.getElementById('cat-name-en').value.trim();
  let id = editingId || document.getElementById('cat-id').value.trim().toLowerCase() || slugifyCategoryId(nameEn);
  if (!id) id = `cat-${Date.now().toString(36)}`; // Arabic-only name: a short unique id

  if (!editingId && ADMIN_STATE.categories.some(c => c.id === id)) {
    showAdminToast('يوجد قسم بنفس الرابط. غيّر الرابط أو الاسم الإنجليزي.', 'error');
    return;
  }

  const existing = ADMIN_STATE.categories.find(c => c.id === editingId) || {};
  const category = {
    id,
    nameAr: document.getElementById('cat-name-ar').value.trim(),
    nameEn,
    icon: existing.icon || 'fa-tag',
    image: document.getElementById('cat-image-url').value.trim(),
    video: document.getElementById('cat-video-url').value.trim(),
    descriptionAr: document.getElementById('cat-desc-ar').value.trim(),
    descriptionEn: document.getElementById('cat-desc-en').value.trim(),
    isActive: document.getElementById('cat-active').checked
  };

  saveCategoryToDrive(category, !editingId, document.getElementById('cat-submit-btn')).then(ok => {
    if (ok) closeCategoryModal();
  });
}

function toggleCategoryVisibility(id) {
  const cat = ADMIN_STATE.categories.find(c => c.id === id);
  if (!cat) return;
  const show = cat.isActive === false;
  if (!show && !confirm(`إخفاء قسم "${cat.nameAr}"؟ سيختفي من المتجر هو و${categoryProductCount(id)} منتج فيه حتى تظهره مرة أخرى.`)) return;
  saveCategoryToDrive({ ...cat, isActive: show }, false);
}

function moveCategory(id, delta) {
  const cats = ADMIN_STATE.categories;
  const from = cats.findIndex(c => c.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= cats.length) return;
  [cats[from], cats[to]] = [cats[to], cats[from]];
  renderCategoriesTable();

  saveWithProgress('حفظ ترتيب الأقسام', { action: 'reorderCategories', ids: cats.map(c => c.id) })
    .then(res => (res ? populateCategorySelectors() : fetchCategoriesFromDrive()));
}

function deleteCategory(id) {
  const cat = ADMIN_STATE.categories.find(c => c.id === id);
  if (!cat) return;
  const count = categoryProductCount(id);
  if (count > 0) {
    showAdminToast(`لا يمكن حذف قسم فيه ${count} منتج. انقل المنتجات لقسم آخر أولاً، أو أخفِ القسم.`, 'error');
    return;
  }
  if (!confirm(`حذف قسم "${cat.nameAr}" نهائياً؟`)) return;

  saveWithProgress(`حذف قسم "${cat.nameAr}"`, { action: 'deleteCategory', id }, { doneMessage: 'تم الحذف ✓' })
    .then(res => { if (res) fetchCategoriesFromDrive(); });
}

// ========================================================
// PROGRESS PANEL: every upload and save shows here while it runs (step, bar, seconds),
// then "done" or what went wrong
// ========================================================
function startTask(title) {
  let panel = document.getElementById('task-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'task-panel';
    panel.className = 'task-panel';
    document.body.appendChild(panel);
  }

  const el = document.createElement('div');
  el.className = 'task-item';
  el.innerHTML = `
    <div class="flex items-center gap-2.5">
      <span class="task-icon"><i class="fa-solid fa-spinner fa-spin"></i></span>
      <div class="flex-1 min-w-0">
        <div class="task-title"></div>
        <div class="task-detail"></div>
      </div>
      <span class="task-time">0 ث</span>
    </div>
    <div class="task-bar is-indeterminate"><span></span></div>`;
  el.querySelector('.task-title').textContent = title;
  panel.prepend(el);

  const started = Date.now();
  const seconds = () => Math.max(1, Math.round((Date.now() - started) / 1000));
  const bar = el.querySelector('.task-bar');
  const timeEl = el.querySelector('.task-time');
  const tick = setInterval(() => { timeEl.textContent = `${seconds()} ث`; }, 500);

  const finish = (state, message) => {
    clearInterval(tick);
    el.classList.add(`is-${state}`);
    el.querySelector('.task-icon').innerHTML = state === 'done'
      ? '<i class="fa-solid fa-circle-check"></i>'
      : '<i class="fa-solid fa-circle-exclamation"></i>';
    el.querySelector('.task-detail').textContent = message;
    timeEl.textContent = `${seconds()} ث`;
    bar.classList.remove('is-indeterminate');
    bar.firstElementChild.style.width = '100%';
    setTimeout(() => el.remove(), state === 'done' ? 5000 : 12000);
  };

  return {
    // fraction 0..1 draws the bar; null shows a moving bar when the length is unknown
    update(detail, fraction = null) {
      el.querySelector('.task-detail').textContent = detail || '';
      bar.classList.toggle('is-indeterminate', fraction === null);
      if (fraction !== null) bar.firstElementChild.style.width = `${Math.round(Math.min(1, fraction) * 100)}%`;
    },
    done(message) { finish('done', message || 'تم ✓'); },
    fail(message) { finish('error', message || 'حدث خطأ'); }
  };
}

// Disables a button and shows a spinner on it while its request runs
function setButtonBusy(button, busy, label = 'جاري الحفظ...') {
  if (!button) return;
  if (busy) {
    button.dataset.idleHtml = button.innerHTML;
    button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>${label}</span>`;
    button.disabled = true;
  } else if (button.dataset.idleHtml !== undefined) {
    button.innerHTML = button.dataset.idleHtml;
    delete button.dataset.idleHtml;
    button.disabled = false;
  }
}

function backendMessage(res) {
  if (res && res.message === 'Unknown action') return 'هذه الميزة تحتاج تحديث كود Google Apps Script أولاً.';
  return (res && res.message) || 'خطأ غير معروف';
}

// Sends one change to Google Drive with progress shown; resolves the response, or null on failure
function saveWithProgress(title, payload, { button, doneMessage, busyLabel } = {}) {
  const task = startTask(title);
  task.update('جاري الإرسال إلى Google Drive...');
  setButtonBusy(button, true, busyLabel);
  return driveRequest(payload)
    .then(res => {
      if (res && res.status === 'success') {
        task.done(doneMessage || 'تم الحفظ ✓');
        markStoreChanged();
        return res;
      }
      task.fail(backendMessage(res));
      return null;
    })
    .catch(err => {
      console.warn(title, err);
      task.fail('تعذر الاتصال بـ Google Drive. تأكد من الإنترنت وحاول مرة أخرى.');
      return null;
    })
    .finally(() => setButtonBusy(button, false));
}

// ========================================================
// STORE SETTINGS (Settings sheet): ads, announcement bar, home banner,
// WhatsApp number, social links, discounts and coupon codes — admins only
// ========================================================
function emptyDiscounts() {
  return { store: { percent: 0, endsAt: '' }, categories: [], products: [] };
}

// Read once per visit, so switching tabs never wipes edits that weren't saved yet
function loadStoreSettings(force = false) {
  if (!ADMIN_STATE.settings.googleScriptUrl || !ADMIN_STATE.currentUser || ADMIN_STATE.currentUser.role !== 'admin') return Promise.resolve();
  if (ADMIN_STATE.storeSettings && !force) return Promise.resolve();
  return driveRequest({ action: 'getSettings' })
    .then(res => {
      if (res.status !== 'success') {
        if (res.message === 'Unknown action') showAdminToast('الإعلانات والخصومات وواتساب تحتاج تحديث كود Google Apps Script أولاً.', 'error');
        return;
      }
      applyStoreSettings(res.settings);
    })
    .catch(err => console.warn('Store settings fetch:', err));
}

function applyStoreSettings(settings) {
  const s = settings || {};
  ADMIN_STATE.storeSettings = s;
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value || ''; };
  set('hero-image-url', s.heroImage);
  set('hero-video-url', s.heroVideo);
  set('ann-ar', s.announcementAr);
  set('ann-en', s.announcementEn);
  set('store-whatsapp', s.whatsappNumber);
  set('store-instagram', s.instagramUrl);
  set('store-facebook', s.facebookUrl);
  set('store-tiktok', s.tiktokUrl);

  ADMIN_STATE.adSlides = (s.adSlides || []).map(a => ({ src: a.src, link: a.link || '' }));
  const d = s.discounts || emptyDiscounts();
  ADMIN_STATE.discounts = {
    store: { percent: Number(d.store?.percent) || 0, endsAt: d.store?.endsAt || '' },
    categories: (d.categories || []).map(r => ({ ...r })),
    products: (d.products || []).map(r => ({ ...r })),
    coupons: (s.coupons || []).map(c => ({ ...c }))
  };
  renderAdsList();
  renderDiscountsEditor();
  updateStatCards();
  renderProductsTable();
}

// Which settings each "save" button sends
function collectSettings(section) {
  const val = id => (document.getElementById(id)?.value || '').trim();
  if (section === 'hero') return { heroImage: val('hero-image-url'), heroVideo: val('hero-video-url') };
  if (section === 'announcement') return { announcementAr: val('ann-ar'), announcementEn: val('ann-en') };
  if (section === 'ads') return { adSlides: ADMIN_STATE.adSlides };
  if (section === 'contact') {
    return {
      whatsappNumber: val('store-whatsapp').replace(/\D/g, ''),
      instagramUrl: val('store-instagram'),
      facebookUrl: val('store-facebook'),
      tiktokUrl: val('store-tiktok')
    };
  }
  if (section === 'discounts') {
    const { coupons, ...discounts } = ADMIN_STATE.discounts;
    return { discounts, coupons };
  }
  return {};
}

function validateSettings(section, settings) {
  const badLink = v => v && !/^(https?:\/\/|assets\/)/i.test(v);
  if (section === 'hero' && [settings.heroImage, settings.heroVideo].some(badLink)) return 'الروابط يجب أن تبدأ بـ https://';
  if (section === 'contact') {
    if (settings.whatsappNumber && (settings.whatsappNumber.length < 8 || settings.whatsappNumber.length > 15)) {
      return 'رقم واتساب غير صحيح. اكتبه بكود الدولة مثل 201012345678.';
    }
    if (settings.whatsappNumber.startsWith('0')) return 'ابدأ الرقم بكود الدولة (مثلاً 20 لمصر) بدلاً من 0.';
    if ([settings.instagramUrl, settings.facebookUrl, settings.tiktokUrl].some(badLink)) return 'روابط السوشيال يجب أن تبدأ بـ https://';
  }
  if (section === 'discounts') {
    const codes = settings.coupons.map(c => String(c.code || '').trim().toUpperCase());
    if (codes.some(c => !/^[A-Z0-9_-]{3,20}$/.test(c))) return 'كل كود يجب أن يكون 3-20 حرفاً إنجليزياً أو رقماً بدون مسافات.';
    if (new Set(codes).size !== codes.length) return 'يوجد كود مكرر.';
    const rules = [settings.discounts.store, ...settings.discounts.categories, ...settings.discounts.products, ...settings.coupons];
    if (rules.some(r => Number(r.percent) && (Number(r.percent) < 1 || Number(r.percent) > 90))) return 'نسبة الخصم يجب أن تكون بين 1% و 90%.';
    if ([...settings.discounts.categories, ...settings.discounts.products].some(r => !r.id)) return 'اختر القسم أو المنتج لكل خصم.';
  }
  return '';
}

const SETTINGS_TITLES = {
  hero: 'حفظ بانر الصفحة الرئيسية',
  announcement: 'حفظ شريط الإعلان',
  ads: 'حفظ إعلانات الصفحة الرئيسية',
  contact: 'حفظ واتساب وروابط المتجر',
  discounts: 'حفظ الخصومات والأكواد'
};

function saveStoreSettings(section, button) {
  const settings = collectSettings(section);
  const problem = validateSettings(section, settings);
  if (problem) {
    showAdminToast(problem, 'error');
    return;
  }
  saveWithProgress(SETTINGS_TITLES[section], { action: 'saveSettings', settings }, {
    button,
    doneMessage: 'تم الحفظ ✓ يظهر في الموقع خلال دقائق'
  }).then(res => {
    if (res && res.settings) applyStoreSettings(res.settings);
  });
}

function testWhatsAppNumber(link) {
  const digits = (document.getElementById('store-whatsapp').value || '').replace(/\D/g, '');
  if (digits.length < 8) {
    showAdminToast('اكتب الرقم أولاً.', 'error');
    return false;
  }
  link.href = `https://wa.me/${digits}`;
  return true;
}

// Pages the owner can pick for "opens when tapped" (categories and products)
function populateStorePagesList() {
  const list = document.getElementById('store-pages');
  if (!list) return;
  const opt = (value, label) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
  list.innerHTML = [
    opt('shop.html', 'كل المنتجات'),
    opt('giveaways.html', 'صانع التوزيعات'),
    ...ADMIN_STATE.categories.map(c => opt(`shop.html?cat=${c.id}`, `قسم: ${c.nameAr}`)),
    ...ADMIN_STATE.products.map(p => opt(`product.html?id=${p.id}`, `منتج: ${p.nameAr}`))
  ].join('');
}

// ---- Ads slider list ----
function isVideoLink(url) {
  return videoLinkLabel(url) !== 'رابط' || /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

function renderAdsList() {
  const el = document.getElementById('ads-list');
  if (!el) return;
  populateStorePagesList();
  const ads = ADMIN_STATE.adSlides || [];
  if (!ads.length) {
    el.innerHTML = '<div class="text-xs text-stone-400 text-center py-6 border border-dashed border-stone-200 dark:border-stone-700 rounded-xl">لا توجد إعلانات بعد. ارفع صورة أو فيديو، أو الصق رابط.</div>';
    return;
  }
  el.innerHTML = ads.map((ad, i) => {
    const video = isVideoLink(ad.src);
    return `
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <span class="text-xs font-black text-stone-400 w-4">${i + 1}</span>
          ${video
            ? '<div class="w-20 h-12 rounded-lg bg-stone-900 text-white flex items-center justify-center flex-shrink-0"><i class="fa-solid fa-circle-play text-pink-400"></i></div>'
            : `<img src="${escapeHtml(ad.src)}" alt="" class="w-20 h-12 rounded-lg object-cover bg-stone-200 flex-shrink-0">`}
          <div class="min-w-0 flex-1">
            <div class="text-[11px] font-bold">${video ? `فيديو · ${escapeHtml(videoLinkLabel(ad.src))}` : 'صورة'}</div>
            <a href="${escapeHtml(ad.src)}" target="_blank" rel="noopener" dir="ltr" class="block truncate text-[11px] text-stone-500 hover:text-pink-600">${escapeHtml(ad.src)}</a>
          </div>
        </div>
        <input type="text" list="store-pages" value="${escapeHtml(ad.link)}" placeholder="يفتح عند الضغط (اختياري)" dir="ltr"
          onchange="updateAdLink(${i}, this.value)"
          class="sm:w-64 px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-[11px] focus:ring-2 focus:ring-pink-500 focus:outline-none">
        <div class="flex items-center gap-1.5 justify-end">
          <button type="button" onclick="moveAd(${i}, -1)" ${i === 0 ? 'disabled' : ''} title="لأعلى" class="w-8 h-8 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-[10px] disabled:opacity-30"><i class="fa-solid fa-chevron-up"></i></button>
          <button type="button" onclick="moveAd(${i}, 1)" ${i === ads.length - 1 ? 'disabled' : ''} title="لأسفل" class="w-8 h-8 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-[10px] disabled:opacity-30"><i class="fa-solid fa-chevron-down"></i></button>
          <button type="button" onclick="removeAd(${i})" title="حذف" class="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </div>`;
  }).join('');
}

function addAd(src) {
  ADMIN_STATE.adSlides = ADMIN_STATE.adSlides || [];
  if (ADMIN_STATE.adSlides.length >= 10) {
    showAdminToast('الحد الأقصى 10 إعلانات.', 'error');
    return false;
  }
  ADMIN_STATE.adSlides.push({ src, link: '' });
  renderAdsList();
  return true;
}

function addAdFromLink() {
  const input = document.getElementById('ads-new-link');
  const url = input.value.trim();
  if (!/^https?:\/\//i.test(url)) {
    showAdminToast('الصق رابطاً كاملاً يبدأ بـ https://', 'error');
    return;
  }
  if (addAd(url)) input.value = '';
}

function uploadIntoAds(event) {
  const input = event.target;
  const files = [...input.files];
  input.value = '';
  if (files.length) uploadFilesWithProgress(input, files, url => addAd(url));
}

function updateAdLink(index, value) {
  if (ADMIN_STATE.adSlides[index]) ADMIN_STATE.adSlides[index].link = value.trim();
}

function moveAd(index, delta) {
  const ads = ADMIN_STATE.adSlides;
  const to = index + delta;
  if (to < 0 || to >= ads.length) return;
  [ads[index], ads[to]] = [ads[to], ads[index]];
  renderAdsList();
}

function removeAd(index) {
  ADMIN_STATE.adSlides.splice(index, 1);
  renderAdsList();
}

// ---- Discounts editor ----
function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ruleStatusBadge(rule) {
  if (!Number(rule.percent)) return '<span class="text-[11px] text-stone-400">بدون خصم</span>';
  if (rule.endsAt && rule.endsAt < todayString()) return '<span class="text-[11px] font-bold text-stone-500 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full">منتهي</span>';
  if (rule.active === false) return '<span class="text-[11px] font-bold text-stone-500 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full">متوقف</span>';
  return '<span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">فعّال</span>';
}

function renderDiscountsEditor() {
  const d = ADMIN_STATE.discounts;
  if (!d || !document.getElementById('disc-store-percent')) return;
  document.getElementById('disc-store-percent').value = d.store.percent || '';
  document.getElementById('disc-store-ends').value = d.store.endsAt || '';
  document.getElementById('disc-store-status').innerHTML = ruleStatusBadge(d.store);

  const input = 'px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs focus:ring-2 focus:ring-pink-500 focus:outline-none';
  const removeBtn = onclick => `<button type="button" onclick="${onclick}" title="حذف" class="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs flex-shrink-0"><i class="fa-solid fa-trash-can"></i></button>`;
  const empty = text => `<div class="text-xs text-stone-400 text-center py-4">${text}</div>`;
  const percentAndDate = (kind, r, i) => `
    <div class="flex items-center gap-1"><input type="number" min="1" max="90" value="${Number(r.percent) || ''}" placeholder="%" oninput="updateDiscountRule('${kind}', ${i}, 'percent', this.value)" class="${input} w-20"><span class="text-xs font-bold">%</span></div>
    <input type="date" value="${escapeHtml(r.endsAt || '')}" title="ينتهي يوم (اختياري)" oninput="updateDiscountRule('${kind}', ${i}, 'endsAt', this.value)" class="${input}">
    <span class="w-14">${ruleStatusBadge(r)}</span>`;

  const options = (list, selected, label) => `<option value="">— اختر —</option>` + list.map(x =>
    `<option value="${escapeHtml(x.id)}" ${x.id === selected ? 'selected' : ''}>${escapeHtml(label(x))}</option>`).join('');

  document.getElementById('disc-categories-list').innerHTML = d.categories.map((r, i) => `
    <div class="flex flex-wrap items-center gap-2">
      <select onchange="updateDiscountRule('categories', ${i}, 'id', this.value)" class="${input} flex-1 min-w-[10rem]">${options(ADMIN_STATE.categories, r.id, c => c.nameAr)}</select>
      ${percentAndDate('categories', r, i)}
      ${removeBtn(`removeDiscountRule('categories', ${i})`)}
    </div>`).join('') || empty('لا يوجد خصم على أقسام.');

  document.getElementById('disc-products-list').innerHTML = d.products.map((r, i) => `
    <div class="flex flex-wrap items-center gap-2">
      <select onchange="updateDiscountRule('products', ${i}, 'id', this.value)" class="${input} flex-1 min-w-[12rem]">${options(ADMIN_STATE.products, r.id, p => `${p.nameAr} (${p.price} ج.م)`)}</select>
      ${percentAndDate('products', r, i)}
      ${removeBtn(`removeDiscountRule('products', ${i})`)}
    </div>`).join('') || empty('لا يوجد خصم على منتجات.');

  document.getElementById('disc-coupons-list').innerHTML = d.coupons.map((c, i) => `
    <div class="flex flex-wrap items-center gap-2">
      <input type="text" value="${escapeHtml(c.code)}" placeholder="EID25" dir="ltr" maxlength="20" oninput="updateDiscountRule('coupons', ${i}, 'code', this.value.toUpperCase().replace(/\\s+/g, ''))" class="${input} w-36 font-mono uppercase">
      ${percentAndDate('coupons', c, i)}
      <label class="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
        <input type="checkbox" ${c.active !== false ? 'checked' : ''} onchange="updateDiscountRule('coupons', ${i}, 'active', this.checked)" class="rounded text-pink-600 w-4 h-4">
        <span>شغّال</span>
      </label>
      ${removeBtn(`removeDiscountRule('coupons', ${i})`)}
    </div>`).join('') || empty('لا توجد أكواد. العملاء لن يستطيعوا استخدام أي كود.');
}

function updateStoreDiscount() {
  const d = ADMIN_STATE.discounts;
  d.store.percent = Number(document.getElementById('disc-store-percent').value) || 0;
  d.store.endsAt = document.getElementById('disc-store-ends').value || '';
  document.getElementById('disc-store-status').innerHTML = ruleStatusBadge(d.store);
}

// Typing doesn't redraw the rows (so the cursor stays); picking or switching does
function updateDiscountRule(kind, index, field, value) {
  const rule = ADMIN_STATE.discounts[kind][index];
  if (!rule) return;
  rule[field] = field === 'percent' ? Number(value) || 0 : value;
  if (field !== 'code' && field !== 'percent') renderDiscountsEditor();
}

function addDiscountRule(kind) {
  if (!ADMIN_STATE.discounts) return showAdminToast('جاري تحميل الإعدادات من Google Drive...', 'info');
  ADMIN_STATE.discounts[kind].push({ id: '', percent: 10, endsAt: '' });
  renderDiscountsEditor();
}

function addCoupon() {
  if (!ADMIN_STATE.discounts) return showAdminToast('جاري تحميل الإعدادات من Google Drive...', 'info');
  ADMIN_STATE.discounts.coupons.push({ code: '', percent: 10, endsAt: '', active: true });
  renderDiscountsEditor();
}

function removeDiscountRule(kind, index) {
  ADMIN_STATE.discounts[kind].splice(index, 1);
  renderDiscountsEditor();
}

// Same rule as the store: the biggest discount that still applies (used in the products table)
function productDiscountPercent(prod) {
  const s = ADMIN_STATE.storeSettings;
  const d = s && s.discounts;
  if (!d) return 0;
  const today = todayString();
  const rules = [d.store, ...(d.categories || []).filter(r => r.id === prod.categoryId), ...(d.products || []).filter(r => r.id === prod.id)]
    .filter(r => r && Number(r.percent) > 0 && (!r.endsAt || r.endsAt >= today));
  return rules.length ? Math.max(...rules.map(r => Number(r.percent))) : 0;
}

// ========================================================
// GITHUB SYNCHRONIZATION
// ========================================================
function generateProductsJsContent() {
  return `// ========================================================
// NOURII STORE - CATALOG DATA (قائمة المنتجات والأقسام)
// تم التحديث تلقائياً عبر لوحة تحكم Nourii Admin
// التاريخ: ${new Date().toLocaleString('ar-EG')}
// ========================================================

const CATEGORIES = ${JSON.stringify(ADMIN_STATE.categories, null, 2)};

const PRODUCTS = ${JSON.stringify(ADMIN_STATE.products, null, 2)};

const REVIEWS = ${typeof REVIEWS !== 'undefined' ? JSON.stringify(REVIEWS, null, 2) : '[]'};

const FAQS = ${typeof FAQS !== 'undefined' ? JSON.stringify(FAQS, null, 2) : '[]'};
`;
}

function generateConfigFileContent() {
  return `// ========================================================
// NOURII STORE - GLOBAL CONFIGURATION (الإعدادات وقاعدة البيانات)
// ========================================================

const NOURII_CONFIG = {
  // 🟢 رابط Google Apps Script Web App المتصل بـ Google Drive كقاعدة بيانات رئيسية
  googleScriptUrl: '${ADMIN_STATE.settings.googleScriptUrl || ''}',

  // مستودع وبيانات GitHub
  githubRepo: 'nouriistore/nouriistore.github.io',
  githubBranch: 'main'
};
`;
}

function publishToGitHub() {
  const tokenInput = document.getElementById('github-pat-token');
  const token = tokenInput ? tokenInput.value.trim() : (ADMIN_STATE.settings.githubToken || '');

  saveProductsToStorage();

  if (token) {
    ADMIN_STATE.settings.githubToken = token;
    localStorage.setItem('nourii_github_pat', token);
    pushDirectlyViaGitHubApi(token);
  } else {
    downloadUpdatedProductsJs();
    showAdminToast('تم حفظ التعديلات محلياً! اضغط مرتين على sync_store.bat لنشرها إلى GitHub فوراً.', 'info');
  }
}

function pushDirectlyViaGitHubApi(token) {
  showAdminToast('جاري رفع التعديلات مباشرة إلى مستودع GitHub...', 'info');

  const content = generateProductsJsContent();
  const encodedContent = btoa(unescape(encodeURIComponent(content)));
  const repo = ADMIN_STATE.settings.githubRepo;
  const path = 'products.js';
  const url = `https://api.github.com/repos/${repo}/contents/${path}`;

  fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  })
  .then(res => res.json())
  .then(fileData => {
    const sha = fileData.sha;

    return fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'feat(admin): update products catalog via Nourii Admin',
        content: encodedContent,
        sha: sha,
        branch: ADMIN_STATE.settings.githubBranch
      })
    });
  })
  .then(res => res.json())
  .then(commitData => {
    if (commitData.commit) {
      showAdminToast('🎉 تم تحديث ونشر المنتجات بنجاح على GitHub Pages!', 'success');
      updateSyncStatusIndicator('GitHub محدّث 🟢', 'ok');
    } else {
      showAdminToast('خطأ من GitHub: ' + (commitData.message || 'فشل النشر'), 'error');
    }
  })
  .catch(err => {
    console.error(err);
    showAdminToast('تعذر النشر عبر GitHub API، يمكنك استخدام sync_store.bat بدلاً منه.', 'error');
  });
}

function downloadUpdatedProductsJs() {
  const content = generateProductsJsContent();
  const blob = new Blob([content], { type: 'application/javascript;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'products.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function updateSyncStatusIndicator(text, type) {
  const el = document.getElementById('sync-status-indicator');
  const textEl = document.getElementById('sync-status-text');
  if (el && textEl) {
    textEl.innerText = text;
    el.classList.remove('hidden');
  }
}

// THEME & TOAST
function initTheme() {
  const theme = localStorage.getItem('nourii_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('admin-theme-icon');
  if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun text-yellow-400' : 'fa-solid fa-moon text-stone-600';
}

function toggleAdminTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('nourii_theme', next);
  const icon = document.getElementById('admin-theme-icon');
  if (icon) icon.className = next === 'dark' ? 'fa-solid fa-sun text-yellow-400' : 'fa-solid fa-moon text-stone-600';
}

function showAdminToast(msg, type = 'info') {
  let container = document.getElementById('admin-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'admin-toast-container';
    container.className = 'fixed top-6 inset-inline-end-6 z-50 flex flex-col gap-2.5 pointer-events-none';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'admin-toast pointer-events-auto';

  let icon = 'fa-circle-info text-blue-500';
  if (type === 'success') icon = 'fa-circle-check text-emerald-500';
  if (type === 'error') icon = 'fa-circle-exclamation text-rose-500';

  toast.innerHTML = `
    <i class="fa-solid ${icon} text-lg"></i>
    <div class="text-xs font-bold flex-1">${msg}</div>
    <button onclick="this.parentElement.remove()" class="text-stone-400 hover:text-stone-600 text-xs">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
