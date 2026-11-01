// ========================================================
// NOURII STORE - APPLICATION CONTROLLER (المحرك البرمجي)
// ========================================================

const APP_STATE = {
  currentCategory: 'all',
  searchQuery: '',
  sortBy: 'popular',
  favoritesOnly: false,
  cart: [],
  favorites: [],
  lang: 'ar',
  theme: 'light',
  promoCode: null,
  discountRate: 0,
  settings: {
    whatsappNumber: '201000000000', // رقم الواتساب الافتراضي - يمكن تغييره من الإعدادات
    storeName: 'Nourii',
    currencyAr: 'ج.م',
    currencyEn: 'EGP',
    instagram: 'nourii_crafts',
    facebook: 'NouriiCrafts',
    tiktok: 'nourii_crafts'
  }
};

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  loadStoredData();
  applyUrlFilters();
  applyTheme(APP_STATE.theme);
  applyLanguage(APP_STATE.lang);
  renderReviews();
  renderFaqs();
  updateCartBadge();
  updateFavBadge();
  updateWhatsAppLinks();
  setupEventListeners();
  initGiveawaysEstimator();

  // 🟢 جلب المنتجات الحية مباشرة من Google Drive كمصدر رئيسي!
  fetchLiveProductsFromGoogleDrive();
});

// Shop page links like shop.html?cat=notebooks, ?q=..., ?fav=1 open the catalog pre-filtered
function applyUrlFilters() {
  const params = new URLSearchParams(window.location.search);
  // Older links pointed at index.html?cat=... — send them to the shop page
  if (document.body.dataset.page === 'home' && (params.get('cat') || params.get('q') || params.get('fav'))) {
    window.location.replace(`shop.html${window.location.search}`);
    return;
  }
  const cat = params.get('cat');
  if (cat && (cat === 'all' || CATEGORIES.some(c => c.id === cat))) APP_STATE.currentCategory = cat;
  if (params.get('q')) {
    APP_STATE.searchQuery = params.get('q');
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = APP_STATE.searchQuery;
  }
  if (params.get('fav') === '1') APP_STATE.favoritesOnly = true;
}

// Re-render everything that depends on the product list or the language
function renderStorefront() {
  if (typeof renderHeaderNav === 'function') renderHeaderNav();
  renderCategoryShowcase();
  renderFeaturedProducts();
  renderShopBanner();
  renderCategories();
  renderProducts();
  renderProductPage();
}

function updateWhatsAppLinks() {
  const cleanPhone = APP_STATE.settings.whatsappNumber.replace(/[^0-9]/g, '');
  document.querySelectorAll('.js-whatsapp-link').forEach(a => { a.href = `https://wa.me/${cleanPhone}`; });
}

function formatPrice(amount) {
  const currency = APP_STATE.lang === 'ar' ? APP_STATE.settings.currencyAr : APP_STATE.settings.currencyEn;
  return `${amount} ${currency}`;
}

function productUrl(id) {
  return `product.html?id=${encodeURIComponent(id)}`;
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// GOOGLE DRIVE PRIMARY SOURCE ENGINE
function fetchLiveProductsFromGoogleDrive() {
  const driveUrl = (typeof NOURII_CONFIG !== 'undefined' && NOURII_CONFIG.googleScriptUrl) 
    || localStorage.getItem('nourii_google_script_url');

  if (!driveUrl) {
    APP_STATE.liveLoadFinished = true;
    renderProductPage();
    return;
  }

  fetch(`${driveUrl}?action=getProducts`)
    .then(res => res.json())
    .then(res => {
      if (res.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
        PRODUCTS.length = 0;
        res.data.forEach(p => PRODUCTS.push(p));
        localStorage.setItem('nourii_live_products', JSON.stringify(res.data));
        renderStorefront();
        console.log(`[Nourii] Loaded ${res.data.length} products live from Google Drive database.`);
      }
    })
    .catch(err => {
      console.warn('[Nourii] Using offline/cached catalog:', err);
    })
    .finally(() => {
      // The product page waits for live data before declaring a product missing
      APP_STATE.liveLoadFinished = true;
      renderProductPage();
    });
}

// LOAD PERSISTENT DATA
function loadStoredData() {
  try {
    const savedCart = localStorage.getItem('nourii_cart');
    if (savedCart) APP_STATE.cart = JSON.parse(savedCart);

    const savedFavs = localStorage.getItem('nourii_favs');
    if (savedFavs) APP_STATE.favorites = JSON.parse(savedFavs);

    const savedTheme = localStorage.getItem('nourii_theme');
    if (savedTheme) APP_STATE.theme = savedTheme;

    const savedLang = localStorage.getItem('nourii_lang');
    if (savedLang) APP_STATE.lang = savedLang;

    const savedSettings = localStorage.getItem('nourii_settings');
    if (savedSettings) APP_STATE.settings = { ...APP_STATE.settings, ...JSON.parse(savedSettings) };

    // Live updated products from Admin / Google Drive
    const liveProds = localStorage.getItem('nourii_live_products') || localStorage.getItem('nourii_admin_products');
    if (liveProds) {
      try {
        const parsed = JSON.parse(liveProds);
        if (Array.isArray(parsed) && parsed.length > 0) {
          PRODUCTS.length = 0;
          parsed.forEach(p => PRODUCTS.push(p));
        }
      } catch (err) {
        console.warn('Error applying live products:', err);
      }
    }
  } catch (e) {
    console.error('Error loading stored data:', e);
  }
}

// SAVE DATA
function saveCart() {
  localStorage.setItem('nourii_cart', JSON.stringify(APP_STATE.cart));
  updateCartBadge();
}

function saveFavorites() {
  localStorage.setItem('nourii_favs', JSON.stringify(APP_STATE.favorites));
  updateFavBadge();
}

// THEME & LANGUAGE
function applyTheme(theme) {
  APP_STATE.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('nourii_theme', theme);

  const themeIcon = document.getElementById('theme-toggle-icon');
  if (themeIcon) {
    themeIcon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}

function toggleTheme() {
  applyTheme(APP_STATE.theme === 'dark' ? 'light' : 'dark');
  showToast(APP_STATE.lang === 'ar' ? 'تم تغيير المظهر بنجاح' : 'Theme updated', 'info');
}

function applyLanguage(lang) {
  APP_STATE.lang = lang;
  document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', lang);
  localStorage.setItem('nourii_lang', lang);

  // Update translatable texts
  document.querySelectorAll('[data-i18n-ar]').forEach(el => {
    const text = lang === 'ar' ? el.getAttribute('data-i18n-ar') : el.getAttribute('data-i18n-en');
    if (text) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = text;
      } else {
        el.innerText = text;
      }
    }
  });

  const langLabel = document.getElementById('lang-toggle-text');
  if (langLabel) langLabel.innerText = lang === 'ar' ? 'English' : 'عربي';

  renderStorefront();
}

function toggleLanguage() {
  applyLanguage(APP_STATE.lang === 'ar' ? 'en' : 'ar');
}

// CATEGORY SHOWCASE (home page: one tile per category)
function renderCategoryShowcase() {
  const container = document.getElementById('categories-showcase-grid');
  if (!container) return;
  const isAr = APP_STATE.lang === 'ar';

  container.innerHTML = CATEGORIES.map(cat => `
    <a href="${shopUrl(cat.id)}" class="group text-center">
      <div class="aspect-square rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 mb-2.5">
        <img src="${cat.image}" alt="${escapeHtml(isAr ? cat.nameAr : cat.nameEn)}" loading="lazy"
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
      </div>
      <span class="font-display font-bold text-sm sm:text-base group-hover:text-brand-500 transition-colors">${isAr ? cat.nameAr : cat.nameEn}</span>
    </a>
  `).join('');
}

// HOME PAGE: best sellers (badged / top-rated products first)
function renderFeaturedProducts() {
  const container = document.getElementById('featured-grid');
  if (!container) return;
  const featured = [...PRODUCTS]
    .sort((a, b) => (b.badgeAr ? 1 : 0) - (a.badgeAr ? 1 : 0) || (b.rating || 0) - (a.rating || 0))
    .slice(0, 8);
  container.innerHTML = featured.map(productCardHTML).join('');
}

// SHOP PAGE BANNER: breadcrumb + title/description of the category (or all products)
function renderShopBanner() {
  const banner = document.getElementById('shop-banner');
  if (!banner) return;

  const isAr = APP_STATE.lang === 'ar';
  const cat = CATEGORIES.find(c => c.id === APP_STATE.currentCategory);
  let title, desc;
  if (APP_STATE.favoritesOnly) {
    title = isAr ? 'المفضلة' : 'Wishlist';
    desc = isAr ? 'المنتجات التي أضفتها إلى المفضلة.' : 'Products you saved to your wishlist.';
  } else if (APP_STATE.searchQuery.trim()) {
    title = isAr ? `نتائج البحث: "${escapeHtml(APP_STATE.searchQuery)}"` : `Search: "${escapeHtml(APP_STATE.searchQuery)}"`;
    desc = '';
  } else if (cat) {
    title = isAr ? cat.nameAr : cat.nameEn;
    desc = isAr ? cat.descriptionAr : cat.descriptionEn;
  } else {
    title = isAr ? 'جميع المنتجات' : 'All Products';
    desc = isAr ? 'كل منتجات Nourii اليدوية في مكان واحد.' : 'Every handmade Nourii product in one place.';
  }

  document.title = `${title.replace(/&quot;/g, '"')} | Nourii`;
  const chevron = `<i class="fa-solid fa-chevron-${isAr ? 'left' : 'right'} text-[10px] opacity-60"></i>`;
  const crumbs = document.getElementById('shop-breadcrumb');
  if (crumbs) {
    crumbs.innerHTML = `
      <a href="index.html" class="hover:text-brand-500">${isAr ? 'الرئيسية' : 'Home'}</a>${chevron}
      ${cat || APP_STATE.favoritesOnly || APP_STATE.searchQuery.trim()
        ? `<a href="shop.html" class="hover:text-brand-500">${isAr ? 'جميع المنتجات' : 'All Products'}</a>${chevron}` : ''}
      <span class="text-stone-800 dark:text-stone-200">${title}</span>`;
  }

  banner.innerHTML = `
    <div class="flex flex-col sm:flex-row items-center gap-6 bg-brand-50 dark:bg-stone-900 rounded-[28px] p-6 sm:p-8">
      ${cat ? `<img src="${cat.image}" alt="${escapeHtml(title)}" class="w-full sm:w-48 h-40 sm:h-36 object-cover rounded-2xl">` : ''}
      <div class="text-center sm:text-start">
        <h1 class="text-3xl sm:text-4xl font-bold mb-2">${title}</h1>
        ${desc ? `<p class="text-stone-600 dark:text-stone-300 text-sm sm:text-base leading-relaxed max-w-2xl">${escapeHtml(desc)}</p>` : ''}
      </div>
    </div>`;
}

// SHOP PAGE CATEGORY CHIPS (each one opens that category's page)
function renderCategories() {
  const container = document.getElementById('categories-container');
  if (!container) return;

  const isAr = APP_STATE.lang === 'ar';
  const chip = (id, label, count) => {
    const isActive = APP_STATE.currentCategory === id && !APP_STATE.favoritesOnly;
    return `
      <a href="${shopUrl(id)}"
        class="category-chip px-4 py-2 rounded-full border text-sm font-bold flex items-center gap-2 ${
          isActive ? 'active' : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:border-brand-300 hover:text-brand-500'
        }">
        <span>${label}</span>
        <span class="text-xs opacity-70 font-normal">${count}</span>
      </a>`;
  };

  container.innerHTML = chip('all', isAr ? 'الكل' : 'All', PRODUCTS.length) +
    CATEGORIES.map(cat => chip(cat.id, isAr ? cat.nameAr : cat.nameEn, PRODUCTS.filter(p => p.categoryId === cat.id).length)).join('');

  container.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

// PRODUCT CARD (used by the catalog grid and "related products")
function productCardHTML(prod) {
  const isAr = APP_STATE.lang === 'ar';
  const isFav = APP_STATE.favorites.includes(prod.id);
  const name = escapeHtml(isAr ? prod.nameAr : prod.nameEn);
  const onSale = prod.originalPrice && Number(prod.originalPrice) > Number(prod.price);
  const salePercent = onSale ? Math.round((1 - prod.price / prod.originalPrice) * 100) : 0;

  return `
    <div class="product-card group flex flex-col">
      <a href="${productUrl(prod.id)}" class="product-card-img block">
        <img src="${prod.image}" alt="${name}" loading="lazy">
        ${onSale ? `<span class="sale-tag">${isAr ? `خصم ${salePercent}%` : `-${salePercent}%`}</span>` : ''}
        <button onclick="event.preventDefault(); event.stopPropagation(); toggleFavorite('${prod.id}')"
          class="absolute top-3 end-3 w-9 h-9 rounded-full bg-white/95 dark:bg-stone-900/90 flex items-center justify-center text-stone-500 hover:text-brand-500 transition-colors"
          title="${isAr ? 'المفضلة' : 'Wishlist'}">
          <i class="${isFav ? 'fa-solid fa-heart text-brand-500' : 'fa-regular fa-heart'} text-sm"></i>
        </button>
      </a>

      <div class="pt-3 flex-1 flex flex-col">
        <a href="${productUrl(prod.id)}" class="font-display font-bold text-[15px] sm:text-base leading-snug line-clamp-2 hover:text-brand-500 transition-colors mb-1.5">
          ${name}
        </a>
        <div class="flex items-baseline gap-2 mb-3">
          <span class="price-now text-base">${formatPrice(prod.price)}</span>
          ${onSale ? `<span class="price-old text-xs">${formatPrice(prod.originalPrice)}</span>` : ''}
        </div>
        <button onclick="quickAddToCart('${prod.id}')" class="btn-outline mt-auto h-10 text-sm w-full">
          ${prod.isCustomizable ? (isAr ? 'اختر التفاصيل' : 'Choose options') : (isAr ? 'أضف للسلة' : 'Add to cart')}
        </button>
      </div>
    </div>
  `;
}

// RENDER PRODUCTS GRID
function renderProducts() {
  const container = document.getElementById('products-grid');
  const countEl = document.getElementById('products-count');
  if (!container) return;

  const isAr = APP_STATE.lang === 'ar';

  let filtered = PRODUCTS.filter(p => {
    if (APP_STATE.favoritesOnly) {
      if (!APP_STATE.favorites.includes(p.id)) return false;
    } else if (APP_STATE.currentCategory !== 'all' && p.categoryId !== APP_STATE.currentCategory) {
      return false;
    }

    if (APP_STATE.searchQuery.trim() !== '') {
      const q = APP_STATE.searchQuery.toLowerCase().trim();
      const fields = [p.nameAr, p.nameEn, p.descriptionAr, p.descriptionEn].map(f => String(f || '').toLowerCase());
      if (!fields.some(f => f.includes(q))) return false;
    }

    return true;
  });

  if (APP_STATE.sortBy === 'price-asc') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (APP_STATE.sortBy === 'price-desc') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (APP_STATE.sortBy === 'rating') {
    filtered.sort((a, b) => b.rating - a.rating);
  }

  if (countEl) {
    countEl.innerText = `${filtered.length} ${isAr ? 'منتج' : 'products'}`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center">
        <h3 class="text-xl font-bold mb-2">${isAr ? 'لم نعثر على منتجات مطابقة' : 'No products found'}</h3>
        <p class="text-stone-500 max-w-md mx-auto text-sm mb-6">${isAr ? 'جرب البحث بكلمات أخرى أو تصفح بقية الأقسام.' : 'Try searching for something else or browse our categories.'}</p>
        <a href="shop.html" class="btn-primary h-11 px-6 text-sm inline-flex items-center">
          ${isAr ? 'عرض كل المنتجات' : 'View All Products'}
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(productCardHTML).join('');
}

// FAVORITES
function toggleFavorite(id) {
  const index = APP_STATE.favorites.indexOf(id);
  const isAr = APP_STATE.lang === 'ar';
  if (index > -1) {
    APP_STATE.favorites.splice(index, 1);
    showToast(isAr ? 'تم الحذف من المفضلة' : 'Removed from wishlist', 'info');
  } else {
    APP_STATE.favorites.push(id);
    showToast(isAr ? 'تمت الإضافة إلى المفضلة ❤️' : 'Added to wishlist ❤️', 'success');
  }
  saveFavorites();
  renderProducts();
  renderFeaturedProducts();
  renderProductPage();
}

function updateFavBadge() {
  const badge = document.getElementById('fav-count-badge');
  if (badge) {
    const count = APP_STATE.favorites.length;
    badge.innerText = count;
    badge.classList.toggle('hidden', count === 0);
  }
}

// PRODUCT PAGE (product.html?id=...)
let currentPageProduct = null;
let productPageRenderedId = null;

// Products can carry extra photos in `images` (array, or a comma / new-line separated string from the Sheet)
function getProductImages(prod) {
  let extra = prod.images || [];
  if (typeof extra === 'string') extra = extra.split(/[\n,|]+/);
  return [...new Set([prod.image, ...extra].map(s => String(s || '').trim()).filter(Boolean))];
}

function renderProductPage() {
  const page = document.getElementById('product-page');
  if (!page) return;

  const id = new URLSearchParams(window.location.search).get('id');
  const prod = PRODUCTS.find(p => p.id === id);
  const isAr = APP_STATE.lang === 'ar';

  if (!prod) {
    if (!APP_STATE.liveLoadFinished) return; // still waiting for Google Drive
    page.innerHTML = `
      <div class="py-28 text-center">
        <h1 class="text-3xl font-bold mb-3">${isAr ? 'المنتج غير موجود' : 'Product not found'}</h1>
        <p class="text-stone-500 mb-8">${isAr ? 'ربما تم حذف هذا المنتج أو تغيير رابطه.' : 'This product may have been removed or its link changed.'}</p>
        <a href="shop.html" class="btn-primary h-[50px] px-8 inline-flex items-center">${isAr ? 'تصفح كل المنتجات' : 'Browse all products'}</a>
      </div>`;
    document.getElementById('related-section')?.classList.add('hidden');
    return;
  }

  // Keep what the shopper typed when the page re-renders (language switch, live data refresh)
  const prevQty = productPageRenderedId === prod.id ? document.getElementById('pp-qty')?.value : null;
  const prevCustom = productPageRenderedId === prod.id ? document.getElementById('pp-custom')?.value : null;
  currentPageProduct = prod;
  productPageRenderedId = prod.id;

  const cat = CATEGORIES.find(c => c.id === prod.categoryId);
  const name = escapeHtml(isAr ? prod.nameAr : prod.nameEn);
  const desc = escapeHtml(isAr ? prod.descriptionAr : prod.descriptionEn);
  const badge = escapeHtml(isAr ? prod.badgeAr : prod.badgeEn);
  const customLabel = escapeHtml(isAr ? prod.customFieldLabelAr : prod.customFieldLabelEn);
  const onSale = prod.originalPrice && Number(prod.originalPrice) > Number(prod.price);
  const isFav = APP_STATE.favorites.includes(prod.id);
  const images = getProductImages(prod);

  document.title = `${isAr ? prod.nameAr : prod.nameEn} | Nourii`;

  page.innerHTML = `
    <!-- Breadcrumb -->
    <nav class="text-sm text-stone-500 mb-6 flex items-center flex-wrap gap-2">
      <a href="index.html" class="hover:text-brand-500">${isAr ? 'الرئيسية' : 'Home'}</a>
      <i class="fa-solid fa-chevron-${isAr ? 'left' : 'right'} text-[10px] opacity-60"></i>
      ${cat ? `
        <a href="${shopUrl(cat.id)}" class="hover:text-brand-500">${isAr ? cat.nameAr : cat.nameEn}</a>
        <i class="fa-solid fa-chevron-${isAr ? 'left' : 'right'} text-[10px] opacity-60"></i>` : ''}
      <span class="text-stone-800 dark:text-stone-200">${name}</span>
    </nav>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14">
      <!-- Gallery -->
      <div>
        <div class="product-card-img rounded-3xl">
          <img id="pp-main-img" src="${images[0]}" alt="${name}">
        </div>
        ${images.length > 1 ? `
          <div class="grid grid-cols-5 gap-3 mt-3">
            ${images.map((src, i) => `
              <button onclick="selectGalleryImage(${i})" class="gallery-thumb ${i === 0 ? 'is-active' : ''}" data-index="${i}">
                <img src="${src}" alt="" class="w-full h-full object-cover" loading="lazy">
              </button>`).join('')}
          </div>` : ''}
      </div>

      <!-- Details -->
      <div class="lg:pt-4">
        ${badge ? `<span class="text-sm font-bold text-brand-500">${badge}</span>` : ''}
        <h1 class="text-3xl sm:text-4xl font-bold leading-snug mt-1 mb-4">${name}</h1>

        <div class="flex items-baseline gap-3 mb-6">
          <span class="price-now text-3xl font-display">${formatPrice(prod.price)}</span>
          ${onSale ? `<span class="price-old text-lg">${formatPrice(prod.originalPrice)}</span>` : ''}
        </div>

        ${prod.isCustomizable ? `
          <div class="mb-5">
            <label for="pp-custom" class="block text-sm font-bold mb-2">
              ${customLabel || (isAr ? 'الاسم أو العبارة المطلوبة' : 'Name or text to print')}
            </label>
            <input type="text" id="pp-custom" value="${escapeHtml(prevCustom || '')}"
              placeholder="${isAr ? 'مثال: نور' : 'e.g. Noor'}"
              class="w-full px-5 py-3 rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
          </div>` : ''}

        <div id="pp-buy-buttons">
          <div class="flex items-center gap-3 mb-3">
            <div class="qty-stepper">
              <button onclick="changePageQty(1)" aria-label="+">+</button>
              <input type="number" id="pp-qty" value="${Number(prevQty) || 1}" min="1" readonly>
              <button onclick="changePageQty(-1)" aria-label="-">−</button>
            </div>
            <button onclick="addToCartFromProductPage()" class="btn-outline flex-1 h-[50px] text-base">
              ${isAr ? 'أضف للسلة' : 'Add to cart'}
            </button>
            <button onclick="toggleFavorite('${prod.id}')" class="w-[50px] h-[50px] rounded-full border border-stone-200 dark:border-stone-700 flex items-center justify-center flex-shrink-0 hover:text-brand-500"
              title="${isAr ? 'المفضلة' : 'Wishlist'}">
              <i class="${isFav ? 'fa-solid fa-heart text-brand-500' : 'fa-regular fa-heart'}"></i>
            </button>
          </div>
          <button onclick="buyNowFromProductPage()" class="btn-primary w-full h-[50px] text-base">
            ${isAr ? 'اطلب الآن' : 'Buy now'}
          </button>
        </div>

        <div class="grid grid-cols-3 gap-2 mt-6 text-center text-xs font-bold text-stone-600 dark:text-stone-300">
          <div class="bg-stone-50 dark:bg-stone-800/60 rounded-2xl py-3"><i class="fa-solid fa-truck-fast text-brand-500 block text-base mb-1"></i>${isAr ? 'شحن لكل المحافظات' : 'Nationwide shipping'}</div>
          <div class="bg-stone-50 dark:bg-stone-800/60 rounded-2xl py-3"><i class="fa-solid fa-hand-holding-heart text-brand-500 block text-base mb-1"></i>${isAr ? 'صناعة يدوية' : 'Handmade'}</div>
          <div class="bg-stone-50 dark:bg-stone-800/60 rounded-2xl py-3"><i class="fa-brands fa-whatsapp text-brand-500 block text-base mb-1"></i>${isAr ? 'تأكيد عبر واتساب' : 'WhatsApp confirmation'}</div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="mt-12">
      <div class="inline-flex gap-1 bg-stone-100 dark:bg-stone-800 p-1.5 rounded-2xl mb-5">
        <button class="pp-tab is-active" data-tab="desc" onclick="selectProductTab('desc')">${isAr ? 'الوصف' : 'Description'}</button>
        <button class="pp-tab" data-tab="order" onclick="selectProductTab('order')">${isAr ? 'طريقة الطلب' : 'How to order'}</button>
      </div>
      <div id="pp-tab-desc" class="pp-tab-panel text-stone-700 dark:text-stone-300 leading-loose max-w-3xl">${desc}</div>
      <div id="pp-tab-order" class="pp-tab-panel hidden text-stone-700 dark:text-stone-300 leading-loose max-w-3xl">
        ${isAr
          ? 'أضف المنتج للسلة أو اضغط "اطلب الآن"، ثم اكتب بيانات التوصيل. سيتم تجهيز رسالة بطلبك لإرسالها إلى واتساب Nourii، ونؤكد معك التفاصيل وموعد التسليم.'
          : 'Add the product to your cart or press "Buy now", then fill in your delivery details. Your order is sent as a WhatsApp message to Nourii, and we confirm the details and delivery date with you.'}
      </div>
    </div>
  `;

  // Sticky buy bar
  const stickyImg = document.getElementById('sticky-buy-img');
  if (stickyImg) { stickyImg.src = images[0]; stickyImg.alt = isAr ? prod.nameAr : prod.nameEn; }
  const stickyName = document.getElementById('sticky-buy-name');
  if (stickyName) stickyName.innerText = isAr ? prod.nameAr : prod.nameEn;
  const stickyPrice = document.getElementById('sticky-buy-price');
  if (stickyPrice) stickyPrice.innerText = formatPrice(prod.price);
  setupStickyBuyBar();

  // Related products from the same category
  const related = PRODUCTS.filter(p => p.categoryId === prod.categoryId && p.id !== prod.id).slice(0, 4);
  const relatedSection = document.getElementById('related-section');
  const relatedGrid = document.getElementById('related-grid');
  if (relatedSection && relatedGrid) {
    relatedSection.classList.toggle('hidden', related.length === 0);
    relatedGrid.innerHTML = related.map(productCardHTML).join('');
  }
}

let stickyObserver = null;

function setupStickyBuyBar() {
  const bar = document.getElementById('sticky-buy-bar');
  const buttons = document.getElementById('pp-buy-buttons');
  if (!bar || !buttons || !('IntersectionObserver' in window)) return;
  if (stickyObserver) stickyObserver.disconnect();

  stickyObserver = new IntersectionObserver(([entry]) => {
    // Show the bar only once the main buttons have scrolled up out of view
    const show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    bar.classList.toggle('is-visible', show);
    document.body.classList.toggle('has-sticky-buy', show);
  });
  stickyObserver.observe(buttons);
}

function selectGalleryImage(index) {
  const thumbs = document.querySelectorAll('.gallery-thumb');
  const main = document.getElementById('pp-main-img');
  const thumb = thumbs[index];
  if (!main || !thumb) return;
  main.src = thumb.querySelector('img').src;
  thumbs.forEach(t => t.classList.toggle('is-active', t === thumb));
}

function selectProductTab(tab) {
  document.querySelectorAll('.pp-tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
  document.querySelectorAll('.pp-tab-panel').forEach(p => p.classList.toggle('hidden', p.id !== `pp-tab-${tab}`));
}

function changePageQty(delta) {
  const qtyInput = document.getElementById('pp-qty');
  if (!qtyInput) return;
  qtyInput.value = Math.max(1, (parseInt(qtyInput.value) || 1) + delta);
}

function readProductPageSelection() {
  const qty = parseInt(document.getElementById('pp-qty')?.value) || 1;
  const customText = (document.getElementById('pp-custom')?.value || '').trim();
  return { qty, customText };
}

function addToCartFromProductPage() {
  if (!currentPageProduct) return;
  const { qty, customText } = readProductPageSelection();
  addItemToCart(currentPageProduct, qty, customText);
}

// "Buy now": put this item in the cart and go straight to the delivery form
function buyNowFromProductPage() {
  if (!currentPageProduct) return;
  const { qty, customText } = readProductPageSelection();
  addItemToCart(currentPageProduct, qty, customText, { silent: true });
  openCheckoutModal();
}

function quickAddToCart(productId) {
  const prod = PRODUCTS.find(p => p.id === productId);
  if (!prod) return;
  if (prod.isCustomizable) {
    // Personalised items need the name/text field on the product page
    window.location.href = productUrl(prod.id);
  } else {
    addItemToCart(prod, 1, '');
  }
}

// CART MANAGEMENT
function addItemToCart(product, qty, customText, { silent = false } = {}) {
  const existingIndex = APP_STATE.cart.findIndex(
    item => item.id === product.id && item.customText === customText
  );

  if (existingIndex > -1) {
    APP_STATE.cart[existingIndex].qty += qty;
  } else {
    APP_STATE.cart.push({
      id: product.id,
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      price: product.price,
      image: product.image,
      qty: qty,
      customText: customText
    });
  }

  saveCart();
  if (silent) return;
  const isAr = APP_STATE.lang === 'ar';
  showToast(
    isAr
      ? `تمت إضافة "${product.nameAr}" إلى السلة بنجاح 🛍️`
      : `Added "${product.nameEn}" to cart 🛍️`,
    'success'
  );

  // Pulse animation on the header cart button
  document.querySelectorAll('#nav-cart-btn').forEach(btn => {
    btn.classList.add('pulse-animation');
    setTimeout(() => btn.classList.remove('pulse-animation'), 400);
  });
}

function updateCartItemQty(index, delta) {
  if (APP_STATE.cart[index]) {
    APP_STATE.cart[index].qty += delta;
    if (APP_STATE.cart[index].qty <= 0) {
      APP_STATE.cart.splice(index, 1);
    }
    saveCart();
    renderCartDrawer();
  }
}

function removeCartItem(index) {
  if (APP_STATE.cart[index]) {
    APP_STATE.cart.splice(index, 1);
    saveCart();
    renderCartDrawer();
    const isAr = APP_STATE.lang === 'ar';
    showToast(isAr ? 'تم حذف العنصر من السلة' : 'Item removed from cart', 'info');
  }
}

function clearCart() {
  APP_STATE.cart = [];
  saveCart();
  renderCartDrawer();
}

function updateCartBadge() {
  const totalCount = APP_STATE.cart.reduce((sum, item) => sum + item.qty, 0);
  
  document.querySelectorAll('.cart-badge-count').forEach(el => {
    el.innerText = totalCount;
  });
}

// CART DRAWER
function toggleCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  if (!drawer) return;

  const isHidden = drawer.classList.contains('hidden');
  if (isHidden) {
    renderCartDrawer();
    drawer.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  } else {
    drawer.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

function renderCartDrawer() {
  const itemsContainer = document.getElementById('cart-items-container');
  const subtotalEl = document.getElementById('cart-subtotal');
  const discountEl = document.getElementById('cart-discount');
  const totalEl = document.getElementById('cart-total');
  if (!itemsContainer) return;

  const isAr = APP_STATE.lang === 'ar';
  const currency = isAr ? APP_STATE.settings.currencyAr : APP_STATE.settings.currencyEn;

  if (APP_STATE.cart.length === 0) {
    itemsContainer.innerHTML = `
      <div class="py-20 text-center">
        <div class="w-20 h-20 mx-auto rounded-full bg-brand-50 dark:bg-stone-800 flex items-center justify-center text-brand-400 text-3xl mb-4">
          <i class="fa-solid fa-bag-shopping"></i>
        </div>
        <p class="font-display font-bold text-xl mb-1">${isAr ? 'سلة المشتريات فارغة' : 'Your cart is empty'}</p>
        <p class="text-sm text-stone-500 mb-6">${isAr ? 'تصفح أقسام Nourii وأضف منتجاتك المفضلة.' : 'Explore Nourii collections and add your favorite items.'}</p>
        <a href="shop.html" onclick="toggleCartDrawer()" class="btn-primary h-11 px-7 text-sm inline-flex items-center">
          ${isAr ? 'تصفح المنتجات' : 'Start Shopping'}
        </a>
      </div>
    `;
    if (subtotalEl) subtotalEl.innerText = `0 ${currency}`;
    if (discountEl) discountEl.innerText = `0 ${currency}`;
    if (totalEl) totalEl.innerText = `0 ${currency}`;
    return;
  }

  let subtotal = 0;

  itemsContainer.innerHTML = APP_STATE.cart.map((item, index) => {
    const itemTotal = item.price * item.qty;
    subtotal += itemTotal;
    const name = escapeHtml(isAr ? item.nameAr : item.nameEn);

    return `
      <div class="flex gap-4 pb-4 border-b border-stone-100 dark:border-stone-800 relative">
        <a href="${productUrl(item.id)}" class="flex-shrink-0">
          <img src="${item.image}" alt="${name}" class="w-20 h-20 rounded-2xl object-cover">
        </a>

        <div class="flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-2">
              <a href="${productUrl(item.id)}" class="font-display font-bold text-[15px] leading-tight hover:text-brand-500">${name}</a>
              <button onclick="removeCartItem(${index})" class="text-stone-400 hover:text-red-500 transition-colors p-1 text-xs">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
            
            ${item.customText ? `
              <div class="text-[11px] text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-stone-700/50 px-2 py-0.5 rounded mt-1 inline-flex items-center gap-1">
                <i class="fa-solid fa-pen-nib text-[9px]"></i>
                <span>${escapeHtml(item.customText)}</span>
              </div>
            ` : ''}
          </div>

          <div class="flex items-center justify-between mt-3">
            <span class="price-now text-sm">${itemTotal} ${currency}</span>

            <!-- Quantity controls -->
            <div class="flex items-center border border-stone-200 dark:border-stone-700 rounded-full">
              <button onclick="updateCartItemQty(${index}, 1)" class="w-8 h-8 flex items-center justify-center text-sm hover:text-brand-500">+</button>
              <span class="w-6 text-center text-sm font-bold">${item.qty}</span>
              <button onclick="updateCartItemQty(${index}, -1)" class="w-8 h-8 flex items-center justify-center text-sm hover:text-brand-500">−</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const discountAmount = Math.round(subtotal * APP_STATE.discountRate);
  const finalTotal = subtotal - discountAmount;

  if (subtotalEl) subtotalEl.innerText = `${subtotal} ${currency}`;
  if (discountEl) discountEl.innerText = `-${discountAmount} ${currency}`;
  if (totalEl) totalEl.innerText = `${finalTotal} ${currency}`;
}

// PROMO CODE
function applyPromoCode() {
  const input = document.getElementById('promo-input');
  if (!input) return;

  const code = input.value.trim().toUpperCase();
  const isAr = APP_STATE.lang === 'ar';

  if (code === 'NOURII10' || code === 'NOUR10') {
    APP_STATE.promoCode = code;
    APP_STATE.discountRate = 0.10; // 10%
    showToast(isAr ? 'تم تطبيق كود الخصم 10% بنجاح! 🎉' : '10% discount promo applied! 🎉', 'success');
  } else if (code === 'WELCOME') {
    APP_STATE.promoCode = code;
    APP_STATE.discountRate = 0.05; // 5%
    showToast(isAr ? 'تم تطبيق كود الترحيب 5% بنجاح! 🎁' : '5% welcome promo applied! 🎁', 'success');
  } else if (code === '') {
    showToast(isAr ? 'يرجى كتابة كود الخصم أولاً' : 'Please enter promo code', 'error');
    return;
  } else {
    showToast(isAr ? 'كود الخصم غير صالح' : 'Invalid promo code', 'error');
    return;
  }

  renderCartDrawer();
}

// WHATSAPP CHECKOUT (مولد رسائل الواتساب الذكي)
function openCheckoutModal() {
  if (APP_STATE.cart.length === 0) {
    showToast(APP_STATE.lang === 'ar' ? 'السلة فارغة حالياً' : 'Cart is empty', 'error');
    return;
  }
  const modal = document.getElementById('checkout-modal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
}

function executeWhatsAppOrder() {
  const nameInput = document.getElementById('order-cust-name');
  const phoneInput = document.getElementById('order-cust-phone');
  const cityInput = document.getElementById('order-cust-city');
  const addressInput = document.getElementById('order-cust-address');
  const notesInput = document.getElementById('order-cust-notes');

  const name = nameInput ? nameInput.value.trim() : '';
  const phone = phoneInput ? phoneInput.value.trim() : '';
  const city = cityInput ? cityInput.value.trim() : '';
  const address = addressInput ? addressInput.value.trim() : '';
  const notes = notesInput ? notesInput.value.trim() : '';

  const isAr = APP_STATE.lang === 'ar';

  if (!name || !phone) {
    showToast(isAr ? 'يرجى إدخال الاسم ورقم الهاتف للمتابعة' : 'Please provide name and phone', 'error');
    return;
  }

  // Generate unique order ID
  const orderId = 'NR-' + Math.floor(1000 + Math.random() * 9000);
  const currency = isAr ? APP_STATE.settings.currencyAr : APP_STATE.settings.currencyEn;

  let subtotal = 0;
  let itemsListText = '';

  APP_STATE.cart.forEach((item, i) => {
    const itemTotal = item.price * item.qty;
    subtotal += itemTotal;
    const itemName = isAr ? item.nameAr : item.nameEn;
    itemsListText += `\n${i + 1}. *${itemName}*\n   - الكمية: ${item.qty}\n   - السعر: ${itemTotal} ${currency}`;
    if (item.customText) {
      itemsListText += `\n   - التخصيص المطلوب: "${item.customText}"`;
    }
  });

  const discountAmount = Math.round(subtotal * APP_STATE.discountRate);
  const finalTotal = subtotal - discountAmount;

  let message = `*🌸 طلب جديد من متجر Nourii 🌸*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📋 *رقم الطلب:* #${orderId}\n`;
  message += `📅 *التاريخ:* ${new Date().toLocaleDateString('ar-EG')}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📦 *المنتجات المطلوبة:*${itemsListText}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💰 *المجموع الفرعي:* ${subtotal} ${currency}\n`;
  if (APP_STATE.promoCode) {
    message += `🏷️ *كود الخصم:* ${APP_STATE.promoCode} (-${discountAmount} ${currency})\n`;
  }
  message += `💵 *الإجمالي النهائي المطلوب:* ${finalTotal} ${currency}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `👤 *بيانات العميل والتوصيل:*\n`;
  message += `▫️ *الاسم:* ${name}\n`;
  message += `▫️ *الهاتف:* ${phone}\n`;
  if (city) message += `▫️ *المحافظة / المدينة:* ${city}\n`;
  if (address) message += `▫️ *العنوان التفصيلي:* ${address}\n`;
  if (notes) message += `▫️ *ملاحظات إضافية:* ${notes}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `بانتظار تأكيدكم والبدء في تجهيز الطلب بكل حب! ✨`;

  const cleanPhone = APP_STATE.settings.whatsappNumber.replace(/[^0-9]/g, '');
  const encodedText = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;

  // Close modals (the cart drawer is not open when ordering via "Buy now")
  closeCheckoutModal();
  const cartDrawer = document.getElementById('cart-drawer');
  if (cartDrawer && !cartDrawer.classList.contains('hidden')) toggleCartDrawer();

  // Clear cart after order
  clearCart();

  showToast(isAr ? 'جاري توجيهك إلى واتساب لإرسال الطلب...' : 'Redirecting to WhatsApp...', 'success');
  window.open(whatsappUrl, '_blank');
}

// SMART GIVEAWAYS ESTIMATOR (صانع التوزيعات الذكي للمناسبات)
function initGiveawaysEstimator() {
  const eventSelect = document.getElementById('gw-event');
  const typeSelect = document.getElementById('gw-type');
  const qtySelect = document.getElementById('gw-qty');
  const calcBtn = document.getElementById('gw-calc-btn');

  if (calcBtn) {
    calcBtn.addEventListener('click', calculateGiveawayQuote);
  }

  // Auto calculate on change if already calculated
  [eventSelect, typeSelect, qtySelect].forEach(el => {
    if (el) el.addEventListener('change', calculateGiveawayQuote);
  });
}

function calculateGiveawayQuote() {
  const eventSelect = document.getElementById('gw-event');
  const typeSelect = document.getElementById('gw-type');
  const qtySelect = document.getElementById('gw-qty');
  const nameInput = document.getElementById('gw-name');
  const resultCard = document.getElementById('gw-result-card');
  const unitPriceEl = document.getElementById('gw-unit-price');
  const discountBadgeEl = document.getElementById('gw-discount-badge');
  const totalPriceEl = document.getElementById('gw-total-price');

  if (!eventSelect || !typeSelect || !qtySelect) return;

  const basePrices = {
    'choco-box': 25,     // علب شوكولاتة وكروت
    'mini-quran': 35,    // ميني مصحف مخمل وسبحة
    'concrete-paint': 30, // مجسمات كونكريت للتلوين
    'kids-cards': 22,    // كروت تعليمية وألعاب
    'wax-envelope': 20   // أظرف مع ختم شمع وكارت
  };

  const selectedType = typeSelect.value;
  const qty = parseInt(qtySelect.value) || 25;
  const basePrice = basePrices[selectedType] || 25;

  // Volume discounts
  let discount = 0;
  let discountLabel = 'سعر أساسي';
  if (qty >= 200) {
    discount = 0.20; // 20%
    discountLabel = 'خصم كميات كبرى 20%';
  } else if (qty >= 100) {
    discount = 0.15; // 15%
    discountLabel = 'خصم مناسبات 15%';
  } else if (qty >= 50) {
    discount = 0.10; // 10%
    discountLabel = 'خصم خاص 10%';
  }

  const discountedUnitPrice = Math.round(basePrice * (1 - discount));
  const total = discountedUnitPrice * qty;

  const isAr = APP_STATE.lang === 'ar';
  const currency = isAr ? APP_STATE.settings.currencyAr : APP_STATE.settings.currencyEn;

  if (unitPriceEl) unitPriceEl.innerText = `${discountedUnitPrice} ${currency}`;
  if (discountBadgeEl) discountBadgeEl.innerText = isAr ? discountLabel : `${discount * 100}% Discount`;
  if (totalPriceEl) totalPriceEl.innerText = `${total} ${currency}`;

  if (resultCard) {
    resultCard.classList.remove('hidden');
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function requestGiveawayWhatsApp() {
  const eventSelect = document.getElementById('gw-event');
  const typeSelect = document.getElementById('gw-type');
  const qtySelect = document.getElementById('gw-qty');
  const nameInput = document.getElementById('gw-name');

  const eventText = eventSelect ? eventSelect.options[eventSelect.selectedIndex].text : '';
  const typeText = typeSelect ? typeSelect.options[typeSelect.selectedIndex].text : '';
  const qty = qtySelect ? qtySelect.value : '50';
  const nameVal = nameInput ? nameInput.value.trim() : 'غير محدد';

  const totalPriceEl = document.getElementById('gw-total-price');
  const total = totalPriceEl ? totalPriceEl.innerText : '';

  let msg = `*🎉 استفسار عن طلب توزيعات مخصصة من Nourii 🎉*\n\n`;
  msg += `▫️ *نوع المناسبة:* ${eventText}\n`;
  msg += `▫️ *نوع التوزيعات:* ${typeText}\n`;
  msg += `▫️ *الكمية المطلوبة:* ${qty} قطعة\n`;
  msg += `▫️ *الاسم أو التاريخ المراد طباعته:* ${nameVal}\n`;
  msg += `▫️ *التقدير المالي في الموقع:* ${total}\n\n`;
  msg += `أرجو إفادتي بالأشكال المتاحة وموعد التسليم وشكراً!`;

  const cleanPhone = APP_STATE.settings.whatsappNumber.replace(/[^0-9]/g, '');
  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
}

// REVIEWS & FAQS RENDERING
function renderReviews() {
  const container = document.getElementById('reviews-container');
  if (!container) return;

  const isAr = APP_STATE.lang === 'ar';

  container.innerHTML = REVIEWS.map(r => {
    const name = isAr ? r.nameAr : r.nameEn;
    const city = isAr ? r.cityAr : r.cityEn;
    const comment = isAr ? r.commentAr : r.commentEn;

    return `
      <div class="nourii-card p-6 flex flex-col justify-between">
        <div>
          <div class="flex items-center gap-1 text-amber-400 mb-3 text-sm">
            ${Array(r.rating).fill('<i class="fa-solid fa-star"></i>').join('')}
          </div>
          <p class="text-stone-600 dark:text-stone-300 text-sm leading-relaxed mb-6 italic">
            "${comment}"
          </p>
        </div>
        <div class="flex items-center gap-3 pt-4 border-t border-stone-100 dark:border-stone-800">
          <img src="${r.avatar}" alt="${name}" class="w-11 h-11 rounded-full object-cover border-2 border-pink-200">
          <div>
            <h4 class="font-bold text-sm">${name}</h4>
            <span class="text-xs text-stone-400">${city}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderFaqs() {
  const container = document.getElementById('faqs-container');
  if (!container) return;

  const isAr = APP_STATE.lang === 'ar';

  container.innerHTML = FAQS.map((faq, i) => {
    const q = isAr ? faq.qAr : faq.qEn;
    const a = isAr ? faq.aAr : faq.aEn;

    return `
      <div class="border border-stone-200 dark:border-stone-700/80 rounded-2xl overflow-hidden bg-white dark:bg-stone-800/40">
        <button onclick="toggleFaq(${i})" class="w-full p-5 text-start font-bold text-base flex items-center justify-between gap-4 hover:bg-stone-50 dark:hover:bg-stone-800/80 transition-colors">
          <span>${q}</span>
          <i id="faq-icon-${i}" class="fa-solid fa-chevron-down text-xs text-stone-400 transition-transform"></i>
        </button>
        <div id="faq-answer-${i}" class="hidden p-5 pt-0 text-sm text-stone-600 dark:text-stone-300 leading-relaxed border-t border-stone-100 dark:border-stone-700/50">
          ${a}
        </div>
      </div>
    `;
  }).join('');
}

function toggleFaq(index) {
  const ans = document.getElementById(`faq-answer-${index}`);
  const icon = document.getElementById(`faq-icon-${index}`);
  if (ans && icon) {
    const isHidden = ans.classList.contains('hidden');
    ans.classList.toggle('hidden', !isHidden);
    icon.style.transform = isHidden ? 'rotate(180deg)' : '';
  }
}

// STORE SETTINGS MODAL (لتعديل رقم الواتساب وروابط السوشيال بسهولة)
function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;

  const phoneInput = document.getElementById('set-whatsapp-phone');
  if (phoneInput) phoneInput.value = APP_STATE.settings.whatsappNumber;

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
}

function saveStoreSettings() {
  const phoneInput = document.getElementById('set-whatsapp-phone');
  if (phoneInput && phoneInput.value.trim() !== '') {
    APP_STATE.settings.whatsappNumber = phoneInput.value.trim();
  }

  localStorage.setItem('nourii_settings', JSON.stringify(APP_STATE.settings));
  updateWhatsAppLinks();
  closeSettingsModal();
  showToast(APP_STATE.lang === 'ar' ? 'تم حفظ الإعدادات بنجاح!' : 'Settings saved successfully!', 'success');
}

// TOAST NOTIFICATIONS
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'nourii-toast';

  let icon = 'fa-circle-info text-blue-500';
  if (type === 'success') icon = 'fa-circle-check text-emerald-500';
  if (type === 'error') icon = 'fa-circle-exclamation text-rose-500';

  toast.innerHTML = `
    <i class="fa-solid ${icon} text-lg"></i>
    <div class="text-xs font-semibold flex-1 leading-snug">${message}</div>
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
  }, 3500);
}

// SETUP EVENT LISTENERS
function setupEventListeners() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      APP_STATE.searchQuery = e.target.value;
      renderShopBanner();
      renderProducts();
    });
  }

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      APP_STATE.sortBy = e.target.value;
      renderProducts();
    });
  }

  // Keyboard shortcut for closing modals with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCheckoutModal();
      closeSettingsModal();
      const cartDrawer = document.getElementById('cart-drawer');
      if (cartDrawer && !cartDrawer.classList.contains('hidden')) {
        toggleCartDrawer();
      }
    }
  });
}
