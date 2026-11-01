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
    // 1. Settings from config.js or localStorage
    if (typeof NOURII_CONFIG !== 'undefined' && NOURII_CONFIG.googleScriptUrl) {
      ADMIN_STATE.settings.googleScriptUrl = NOURII_CONFIG.googleScriptUrl;
    }
    const savedScriptUrl = localStorage.getItem('nourii_google_script_url');
    if (savedScriptUrl) {
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

    // 5. Categories
    if (typeof CATEGORIES !== 'undefined') {
      ADMIN_STATE.categories = CATEGORIES;
    }

    // If Google Drive URL is active, fetch live data from Google Drive as PRIMARY source
    if (ADMIN_STATE.settings.googleScriptUrl) {
      syncSilentlyFromGoogleDrive();
      if (ADMIN_STATE.currentUser) {
        verifySessionWithDrive();
        if (ADMIN_STATE.currentUser.role === 'admin') fetchLiveUsersFromGoogleDrive();
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
  if (user.role === 'admin') fetchLiveUsersFromGoogleDrive();
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

// Editors manage products only; the users tab is for admins
function applyRoleVisibility() {
  const isAdmin = ADMIN_STATE.currentUser && ADMIN_STATE.currentUser.role === 'admin';
  const usersTabBtn = document.getElementById('tab-btn-users');
  if (usersTabBtn) usersTabBtn.classList.toggle('hidden', !isAdmin);
  if (!isAdmin && ADMIN_STATE.activeTab === 'users') switchTab('overview');
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

  const tabs = ['overview', 'products', 'users', 'sync'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (el) el.classList.toggle('hidden', t !== tabId);
    if (btn) btn.classList.toggle('active', t !== tabId);
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
  } else if (tabId === 'users') {
    titleEl.innerText = 'إدارة المستخدمين والمشرفين';
    subEl.innerText = 'التحكم في صلاحيات الوصول وإنشاء كلمات المرور';
    renderUsersTable();
    fetchLiveUsersFromGoogleDrive(false);
  } else if (tabId === 'sync') {
    titleEl.innerText = 'إعدادات Google Drive & GitHub';
    subEl.innerText = 'ربط قاعدة بيانات Google Sheets كمصدر رئيسي ومزامنة المستودع';
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
  if (totalProdEl) totalProdEl.innerText = ADMIN_STATE.products.length;
  if (totalUsersEl) totalUsersEl.innerText = ADMIN_STATE.users.length;
}

function populateCategorySelectors() {
  const filterSelect = document.getElementById('admin-category-filter');
  const formSelect = document.getElementById('prod-category');

  if (filterSelect) {
    let opts = '<option value="all">جميع الأقسام (10)</option>';
    ADMIN_STATE.categories.forEach(c => {
      opts += `<option value="${c.id}">${c.nameAr} (${c.nameEn})</option>`;
    });
    filterSelect.innerHTML = opts;
  }

  if (formSelect) {
    let opts = '';
    ADMIN_STATE.categories.forEach(c => {
      opts += `<option value="${c.id}">${c.nameAr}</option>`;
    });
    formSelect.innerHTML = opts;
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

    return `
      <tr>
        <td class="w-16">
          <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.nameAr)}" class="w-12 h-12 rounded-xl object-cover border border-stone-200 dark:border-stone-700 bg-stone-100">
        </td>
        <td>
          <div class="font-bold text-sm text-stone-900 dark:text-stone-100">${escapeHtml(p.nameAr)}</div>
          <div class="text-[11px] text-stone-400 font-mono">${escapeHtml(p.nameEn)}</div>
        </td>
        <td>
          <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300">
            ${escapeHtml(catName)}
          </span>
        </td>
        <td>
          <div class="font-black text-sm text-pink-600">${p.price} ج.م</div>
          ${p.originalPrice ? `<span class="text-xs text-stone-400 line-through">${p.originalPrice} ج.م</span>` : ''}
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

  const productObj = {
    id: id,
    categoryId: document.getElementById('prod-category').value,
    nameAr: document.getElementById('prod-name-ar').value.trim(),
    nameEn: document.getElementById('prod-name-en').value.trim(),
    price: Number(document.getElementById('prod-price').value) || 0,
    originalPrice: Number(document.getElementById('prod-original-price').value) || 0,
    image: document.getElementById('prod-image-url').value.trim(),
    badgeAr: document.getElementById('prod-badge-ar').value.trim(),
    badgeEn: document.getElementById('prod-badge-en').value.trim(),
    rating: 5.0,
    reviewsCount: 1,
    isCustomizable: document.getElementById('prod-customizable').checked,
    customFieldLabelAr: document.getElementById('prod-custom-label-ar').value.trim(),
    descriptionAr: document.getElementById('prod-desc-ar').value.trim(),
    descriptionEn: ''
  };

  if (isEditing) {
    const idx = ADMIN_STATE.products.findIndex(p => p.id === id);
    if (idx > -1) ADMIN_STATE.products[idx] = { ...ADMIN_STATE.products[idx], ...productObj };
  } else {
    ADMIN_STATE.products.unshift(productObj);
  }

  saveProductsToStorage();
  closeProductFormModal();
  renderProductsTable();
  updateStatCards();

  showAdminToast(isEditing ? 'تم حفظ التعديل! ✨' : 'تمت إضافة المنتج بنجاح! 🎉', 'success');

  // مزامنة فورية مع Google Drive إذا كان مربوطاً كقاعدة بيانات
  if (ADMIN_STATE.settings.googleScriptUrl) {
    syncProductToGoogleDrive(productObj);
  }
}

function deleteProduct(id) {
  const prod = ADMIN_STATE.products.find(p => p.id === id);
  const name = prod ? prod.nameAr : '';

  if (confirm(`هل أنت متأكد من حذف المنتج: "${name}"؟`)) {
    ADMIN_STATE.products = ADMIN_STATE.products.filter(p => p.id !== id);
    saveProductsToStorage();
    renderProductsTable();
    updateStatCards();
    showAdminToast('تم حذف المنتج بنجاح.', 'info');

    if (ADMIN_STATE.settings.googleScriptUrl) {
      deleteProductFromGoogleDrive(id);
    }
  }
}

function saveProductsToStorage() {
  localStorage.setItem('nourii_admin_products', JSON.stringify(ADMIN_STATE.products));
  localStorage.setItem('nourii_live_products', JSON.stringify(ADMIN_STATE.products));
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

function syncProductToGoogleDrive(product) {
  if (!ADMIN_STATE.settings.googleScriptUrl) return;

  driveRequest({ action: 'saveProduct', product: product })
    .then(d => {
      if (d.status !== 'success') showAdminToast(`لم يُحفظ المنتج في Google Drive: ${d.message || 'خطأ'}`, 'error');
    })
    .catch(e => {
      console.warn('Drive sync background err:', e);
      showAdminToast('تعذر حفظ المنتج في Google Drive (مشكلة اتصال).', 'error');
    });
}

function deleteProductFromGoogleDrive(id) {
  if (!ADMIN_STATE.settings.googleScriptUrl) return;

  driveRequest({ action: 'deleteProduct', id: id })
    .then(d => {
      if (d.status !== 'success') showAdminToast(`لم يُحذف المنتج من Google Drive: ${d.message || 'خطأ'}`, 'error');
    })
    .catch(e => {
      console.warn('Drive delete background err:', e);
      showAdminToast('تعذر حذف المنتج من Google Drive (مشكلة اتصال).', 'error');
    });
}

function handleImageFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const url = ADMIN_STATE.settings.googleScriptUrl;
  if (!url) {
    showAdminToast('لرفع الصور إلى Drive، يرجى ربط رابط Google Apps Script أولاً في تبويب المزامنة.', 'error');
    return;
  }

  showAdminToast('جاري رفع الصورة إلى مجلد Google Drive...', 'info');

  const reader = new FileReader();
  reader.onload = function(evt) {
    const base64Data = evt.target.result;

    driveRequest({
      action: 'uploadImage',
      base64Data: base64Data,
      filename: file.name,
      mimeType: file.type
    })
    .then(res => {
      if (res.status === 'success' && res.imageUrl) {
        document.getElementById('prod-image-url').value = res.imageUrl;
        showAdminToast('تم رفع الصورة بنجاح إلى Google Drive! 🖼️', 'success');
      } else {
        showAdminToast('فشل رفع الصورة: ' + (res.message || 'خطأ'), 'error');
      }
    })
    .catch(err => {
      console.error(err);
      showAdminToast('حدث خطأ أثناء رفع الصورة لـ Drive.', 'error');
    });
  };

  reader.readAsDataURL(file);
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
