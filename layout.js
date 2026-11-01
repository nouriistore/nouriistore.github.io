// ========================================================
// NOURII STORE - SHARED PAGE LAYOUT (الهيدر والفوتر والسلة)
// ========================================================
// Renders the parts every storefront page shares into placeholders:
//   <div id="site-header"></div>, <div id="site-footer"></div>, <div id="site-overlays"></div>
// Runs immediately (scripts sit at the end of <body>), before app.js initialises.

function isCatalogPage() {
  return !!document.getElementById('products-grid');
}

// Every menu item is its own page:
//   home → index.html, all products → shop.html, a category → shop.html?cat=<id>,
//   giveaways builder → giveaways.html
function shopUrl(catId) {
  return catId && catId !== 'all' ? `shop.html?cat=${encodeURIComponent(catId)}` : 'shop.html';
}

// Which menu item is the page we are on
function currentNavKey() {
  const page = document.body.dataset.page;
  if (page === 'shop') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('q') || params.get('fav')) return null;
    return params.get('cat') || 'all';
  }
  if (page === 'product' && typeof PRODUCTS !== 'undefined') {
    const id = new URLSearchParams(window.location.search).get('id');
    return PRODUCTS.find(p => p.id === id)?.categoryId || null;
  }
  return page === 'home' ? 'home' : page === 'giveaways' ? 'giveaways' : null;
}

function renderHeaderNav() {
  const nav = document.getElementById('header-category-nav');
  if (!nav || typeof CATEGORIES === 'undefined') return;

  const isAr = typeof APP_STATE === 'undefined' || APP_STATE.lang === 'ar';
  const current = currentNavKey();
  const link = (key, href, label, extra = '') => `
    <a href="${href}" class="header-nav-link ${current === key ? 'is-active' : ''} ${extra}">${label}</a>`;

  nav.innerHTML = [
    link('home', 'index.html', isAr ? 'الرئيسية' : 'Home'),
    link('all', shopUrl('all'), isAr ? 'جميع المنتجات' : 'All Products'),
    ...CATEGORIES.map(c => link(c.id, shopUrl(c.id), isAr ? c.nameAr : c.nameEn)),
    link('giveaways', 'giveaways.html', isAr ? 'صانع التوزيعات' : 'Giveaways Builder', 'text-brand-600'),
  ].join('');

  // On phones the menu scrolls sideways; bring the current page's link into view
  nav.querySelector('.is-active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function toggleHeaderSearch(force) {
  const panel = document.getElementById('header-search-panel');
  if (!panel) return;
  const show = typeof force === 'boolean' ? force : panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !show);
  if (show) document.getElementById('header-search-input')?.focus();
}

function submitHeaderSearch(event) {
  event.preventDefault();
  const q = (document.getElementById('header-search-input')?.value || '').trim();
  window.location.href = q ? `shop.html?q=${encodeURIComponent(q)}` : 'shop.html';
  return false;
}

function openFavorites() {
  window.location.href = 'shop.html?fav=1';
}

function renderSiteHeader() {
  const el = document.getElementById('site-header');
  if (!el) return;
  el.innerHTML = `
    <!-- Announcement bar -->
    <div class="announcement-bar">
      <span>✨ خصم 10% على جميع الطلبات بكود <strong>NOURII10</strong></span>
      <span class="hidden sm:inline opacity-60">•</span>
      <span class="hidden sm:inline">شحن لجميع المحافظات 📦</span>
    </div>

    <header class="site-header sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Top row: tools · logo · icons -->
        <div class="h-16 sm:h-[72px] grid grid-cols-3 items-center">
          <div class="flex items-center gap-1">
            <button onclick="toggleLanguage()" class="header-icon-btn text-xs font-bold w-auto px-3" title="Language">
              <span id="lang-toggle-text">English</span>
            </button>
            <button onclick="toggleTheme()" class="header-icon-btn" title="تغيير المظهر">
              <i id="theme-toggle-icon" class="fa-solid fa-moon"></i>
            </button>
          </div>

          <a href="index.html" class="justify-self-center text-center leading-none">
            <span class="font-display text-3xl sm:text-[34px] font-bold text-brand-500">Nourii</span>
            <span class="block text-[10px] sm:text-[11px] font-bold text-stone-400 mt-1">نوري • للفنون والهدايا</span>
          </a>

          <div class="flex items-center gap-1 justify-self-end">
            <button onclick="toggleHeaderSearch()" class="header-icon-btn" title="بحث">
              <i class="fa-solid fa-magnifying-glass"></i>
            </button>
            <button onclick="openFavorites()" class="header-icon-btn relative" title="المفضلة">
              <i class="fa-regular fa-heart"></i>
              <span id="fav-count-badge" class="header-badge hidden">0</span>
            </button>
            <button id="nav-cart-btn" onclick="toggleCartDrawer()" class="header-icon-btn relative" title="السلة">
              <i class="fa-solid fa-bag-shopping"></i>
              <span class="cart-badge-count header-badge">0</span>
            </button>
          </div>
        </div>

        <!-- Search panel -->
        <div id="header-search-panel" class="hidden pb-3">
          <form onsubmit="return submitHeaderSearch(event)" class="relative max-w-xl mx-auto">
            <i class="fa-solid fa-magnifying-glass absolute top-1/2 -translate-y-1/2 start-4 text-stone-400 text-sm"></i>
            <input id="header-search-input" type="search" placeholder="ابحث عن منتج..." autocomplete="off"
              class="w-full ps-11 pe-4 py-3 rounded-full border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
          </form>
        </div>

        <!-- Category menu -->
        <nav id="header-category-nav" class="header-category-nav no-scrollbar"></nav>
      </div>
    </header>
  `;
  renderHeaderNav();
}

function renderSiteFooter() {
  const el = document.getElementById('site-footer');
  if (!el || typeof CATEGORIES === 'undefined') return;
  const half = Math.ceil(CATEGORIES.length / 2);
  const catLinks = list => list.map(c =>
    `<li><a href="${shopUrl(c.id)}" class="hover:text-brand-500 transition-colors">${c.nameAr}</a></li>`
  ).join('');

  el.innerHTML = `
    <footer class="bg-stone-50 dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800 pt-14 pb-10 mt-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          <div class="lg:col-span-2">
            <span class="font-display text-3xl font-bold text-brand-500">Nourii</span>
            <p class="text-stone-500 dark:text-stone-400 text-sm leading-relaxed max-w-sm mt-3 mb-5">
              متجر Nourii (نوري) - نصنع بحب أدوات الفنون اليدوية، مجسمات الكونكريت للأطفال، توزيعات المناسبات، والمفكرات المخصصة بالأسماء في مصر.
            </p>
            <div class="flex items-center gap-2.5">
              <a href="https://instagram.com" target="_blank" rel="noopener" class="footer-social"><i class="fa-brands fa-instagram"></i></a>
              <a href="https://facebook.com" target="_blank" rel="noopener" class="footer-social"><i class="fa-brands fa-facebook-f"></i></a>
              <a href="https://tiktok.com" target="_blank" rel="noopener" class="footer-social"><i class="fa-brands fa-tiktok"></i></a>
              <a href="https://wa.me/201000000000" target="_blank" rel="noopener" class="footer-social js-whatsapp-link"><i class="fa-brands fa-whatsapp"></i></a>
            </div>
          </div>

          <div>
            <h4 class="font-display font-bold text-base mb-4">الأقسام</h4>
            <ul class="space-y-2 text-sm text-stone-600 dark:text-stone-400">${catLinks(CATEGORIES.slice(0, half))}</ul>
          </div>
          <div>
            <h4 class="font-display font-bold text-base mb-4 invisible lg:visible">المزيد</h4>
            <ul class="space-y-2 text-sm text-stone-600 dark:text-stone-400">${catLinks(CATEGORIES.slice(half))}</ul>
          </div>

          <div>
            <h4 class="font-display font-bold text-base mb-4">خدمة العملاء</h4>
            <ul class="space-y-3 text-sm text-stone-600 dark:text-stone-400">
              <li class="flex items-center gap-2"><i class="fa-solid fa-clock text-brand-500"></i><span>الرد يومياً من 10 ص حتى 11 م</span></li>
              <li class="flex items-center gap-2"><i class="fa-solid fa-location-dot text-brand-500"></i><span>مصر - شحن لجميع المحافظات</span></li>
              <li class="flex items-center gap-2"><i class="fa-brands fa-whatsapp text-brand-500"></i><span>الطلب والتأكيد عبر واتساب</span></li>
            </ul>
          </div>
        </div>

        <div class="pt-6 border-t border-stone-200 dark:border-stone-800 text-xs text-stone-400 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© 2026 Nourii - جميع الحقوق محفوظة</span>
          <div class="flex items-center gap-4">
            <button onclick="openSettingsModal()" class="hover:text-brand-500 transition-colors flex items-center gap-1.5">
              <i class="fa-solid fa-gear text-[11px]"></i><span>إعدادات المتجر</span>
            </button>
            <a href="admin.html" class="hover:text-brand-500 transition-colors flex items-center gap-1.5">
              <i class="fa-solid fa-lock text-[11px]"></i><span>لوحة الإدارة</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  `;
}

function renderSiteOverlays() {
  const el = document.getElementById('site-overlays');
  if (!el) return;
  const input = 'w-full px-4 py-3 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 focus:ring-2 focus:ring-brand-300 focus:outline-none';
  const label = 'block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5';

  el.innerHTML = `
    <!-- Floating WhatsApp -->
    <a href="https://wa.me/201000000000" target="_blank" rel="noopener" class="floating-whatsapp-btn js-whatsapp-link" title="تواصل عبر واتساب">
      <i class="fa-brands fa-whatsapp"></i>
    </a>

    <!-- Cart drawer -->
    <div id="cart-drawer" class="fixed inset-0 z-50 modal-backdrop hidden" onclick="if (event.target === this) toggleCartDrawer()">
      <div class="absolute inset-y-0 end-0 max-w-md w-full bg-white dark:bg-stone-900 shadow-2xl flex flex-col drawer-slide">
        <div class="px-6 py-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <div>
            <h3 class="font-display font-bold text-xl">سلة المشتريات</h3>
            <span class="text-xs text-stone-400"><span class="cart-badge-count">0</span> منتج</span>
          </div>
          <button onclick="toggleCartDrawer()" class="w-9 h-9 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 flex items-center justify-center">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div id="cart-items-container" class="p-6 overflow-y-auto flex-1 space-y-4"></div>

        <div class="p-6 border-t border-stone-100 dark:border-stone-800">
          <div class="flex gap-2 mb-4">
            <input type="text" id="promo-input" placeholder="كود الخصم (جرب NOURII10)"
              class="flex-1 px-4 py-2.5 text-xs rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 uppercase focus:outline-none focus:ring-2 focus:ring-brand-300">
            <button onclick="applyPromoCode()" class="btn-outline px-5 py-2.5 text-xs">تطبيق</button>
          </div>

          <div class="space-y-2 text-sm mb-5">
            <div class="flex justify-between text-stone-500">
              <span>المجموع الفرعي</span>
              <span id="cart-subtotal" class="font-bold text-stone-800 dark:text-stone-200">0 ج.م</span>
            </div>
            <div class="flex justify-between text-emerald-600">
              <span>الخصم</span>
              <span id="cart-discount" class="font-bold">0 ج.م</span>
            </div>
            <div class="flex justify-between text-lg font-bold pt-2 border-t border-stone-100 dark:border-stone-800">
              <span class="font-display">الإجمالي</span>
              <span id="cart-total" class="text-brand-500">0 ج.م</span>
            </div>
          </div>

          <button onclick="openCheckoutModal()" class="btn-primary w-full h-[50px] text-base flex items-center justify-center gap-2">
            <i class="fa-brands fa-whatsapp text-lg"></i>
            <span>إتمام الطلب عبر واتساب</span>
          </button>
          <button onclick="clearCart()" class="w-full pt-3 text-center text-xs text-stone-400 hover:text-red-500 transition-colors">
            تفريغ السلة
          </button>
        </div>
      </div>
    </div>

    <!-- Checkout modal -->
    <div id="checkout-modal" class="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4 hidden">
      <div class="bg-white dark:bg-stone-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        <button onclick="closeCheckoutModal()" class="absolute top-4 end-4 w-9 h-9 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 flex items-center justify-center">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <div class="text-center mb-6">
          <h3 class="font-display text-2xl font-bold">بيانات التوصيل</h3>
          <p class="text-xs text-stone-500 mt-1">سنجهز رسالة طلبك لإرسالها إلى واتساب Nourii</p>
        </div>
        <div class="space-y-4 mb-6">
          <div><label class="${label}">الاسم بالكامل *</label><input type="text" id="order-cust-name" placeholder="مثال: نورهان أحمد" class="${input}"></div>
          <div><label class="${label}">رقم الهاتف (واتساب) *</label><input type="tel" id="order-cust-phone" placeholder="مثال: 01012345678" class="${input}"></div>
          <div><label class="${label}">المحافظة / المدينة</label><input type="text" id="order-cust-city" placeholder="مثال: القاهرة - مدينة نصر" class="${input}"></div>
          <div><label class="${label}">العنوان التفصيلي</label><input type="text" id="order-cust-address" placeholder="الشارع، رقم العمارة..." class="${input}"></div>
          <div><label class="${label}">ملاحظات على الطلب</label><textarea id="order-cust-notes" rows="2" placeholder="أي تفاصيل خاصة بالألوان أو موعد التسليم..." class="${input}"></textarea></div>
        </div>
        <button onclick="executeWhatsAppOrder()" class="btn-primary w-full h-[50px] text-base flex items-center justify-center gap-2">
          <i class="fa-brands fa-whatsapp text-lg"></i>
          <span>إرسال الطلب إلى واتساب</span>
        </button>
      </div>
    </div>

    <!-- Store settings modal -->
    <div id="settings-modal" class="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4 hidden">
      <div class="bg-white dark:bg-stone-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
        <button onclick="closeSettingsModal()" class="absolute top-4 end-4 w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 flex items-center justify-center">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <h3 class="font-display font-bold text-xl mb-1">إعدادات المتجر</h3>
        <p class="text-xs text-stone-500 mb-4">رقم واتساب استقبال الطلبات</p>
        <input type="text" id="set-whatsapp-phone" placeholder="مثال: 201012345678" class="${input}">
        <p class="text-[11px] text-stone-400 mt-1.5 mb-5">اكتب الرقم بكود الدولة وبدون علامة +</p>
        <div class="flex gap-2">
          <button onclick="saveStoreSettings()" class="btn-primary flex-1 py-2.5 text-sm">حفظ</button>
          <button onclick="closeSettingsModal()" class="btn-outline px-5 py-2.5 text-sm">إلغاء</button>
        </div>
      </div>
    </div>
  `;
}

renderSiteHeader();
renderSiteFooter();
renderSiteOverlays();
