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
    whatsappNumber: '201000000000', // placeholder until the number is set in the admin page (Store settings)
    storeName: 'Nourii',
    currencyAr: 'ج.م',
    currencyEn: 'EGP',
    instagram: 'nourii_crafts',
    facebook: 'NouriiCrafts',
    tiktok: 'nourii_crafts'
  }
};

// Store settings chosen in the admin page (Settings sheet): home banner, ads slider,
// announcement bar, WhatsApp number, social links and discounts
const STORE_SETTINGS = {
  heroImage: '', heroVideo: '',
  whatsappNumber: '', instagramUrl: '', facebookUrl: '', tiktokUrl: '',
  announcementAr: '', announcementEn: '',
  adSlides: [],
  discounts: { store: { percent: 0, endsAt: '' }, categories: [], products: [] }
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
  // New categories may only be known once the live list arrives, so any id is accepted here
  const cat = params.get('cat');
  if (cat && /^[\w-]+$/.test(cat)) APP_STATE.currentCategory = cat;
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
  if (typeof renderFooterCategories === 'function') renderFooterCategories();
  applyStoreContact();
  renderAdsSlider();
  renderHeroMedia();
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
// One request brings the visible categories, their products and the home page banner.
const LIVE_STORE_MAX_AGE_MS = 5 * 60 * 1000;

function replaceItems(target, items) {
  target.length = 0;
  items.forEach(item => target.push(item));
}

function applyLiveStore(store) {
  if (Array.isArray(store.products) && store.products.length) replaceItems(PRODUCTS, store.products);
  if (Array.isArray(store.categories) && store.categories.length) replaceItems(CATEGORIES, store.categories);
  if (store.settings) Object.assign(STORE_SETTINGS, store.settings);
}

function fetchLiveProductsFromGoogleDrive() {
  const driveUrl = (typeof NOURII_CONFIG !== 'undefined' && NOURII_CONFIG.googleScriptUrl)
    || localStorage.getItem('nourii_google_script_url');

  if (!driveUrl) {
    APP_STATE.liveLoadFinished = true;
    renderProductPage();
    return;
  }

  // Moving between pages reuses data fetched in the last few minutes instead of asking
  // Google again on every click (keeps the store fast when many people visit at once).
  // A product or category page whose item isn't in that data still checks Google for it.
  const fetchedAt = Number(localStorage.getItem('nourii_live_store_at')) || 0;
  const wantedId = document.getElementById('product-page') ? new URLSearchParams(window.location.search).get('id') : null;
  const wantedCat = APP_STATE.currentCategory !== 'all' ? APP_STATE.currentCategory : null;
  const isFresh = Date.now() - fetchedAt < LIVE_STORE_MAX_AGE_MS && localStorage.getItem('nourii_live_store');
  if (isFresh && (!wantedId || PRODUCTS.some(p => p.id === wantedId)) && (!wantedCat || CATEGORIES.some(c => c.id === wantedCat))) {
    APP_STATE.liveLoadFinished = true;
    renderProductPage();
    return;
  }

  fetch(`${driveUrl}?action=getStore`)
    .then(res => res.json())
    .then(res => {
      if (res.status === 'success' && Array.isArray(res.products)) return res;
      // Apps Script not redeployed yet: it only knows getProducts
      return fetch(`${driveUrl}?action=getProducts`)
        .then(r => r.json())
        .then(r => (r.status === 'success' ? { products: r.data } : null));
    })
    .then(store => {
      if (!store || !Array.isArray(store.products) || store.products.length === 0) return;
      applyLiveStore(store);
      localStorage.setItem('nourii_live_store', JSON.stringify(store));
      localStorage.setItem('nourii_live_store_at', String(Date.now()));
      if (APP_STATE.currentCategory !== 'all' && !CATEGORIES.some(c => c.id === APP_STATE.currentCategory)) {
        APP_STATE.currentCategory = 'all';
      }
      renderStorefront();
      console.log(`[Nourii] Loaded ${store.products.length} products and ${CATEGORIES.length} categories live from Google Drive.`);
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

    // Last store data from Google Drive (or products edited in the admin page on this browser)
    try {
      const liveStore = localStorage.getItem('nourii_live_store');
      const liveProds = localStorage.getItem('nourii_live_products') || localStorage.getItem('nourii_admin_products');
      if (liveStore) {
        applyLiveStore(JSON.parse(liveStore));
      } else if (liveProds) {
        applyLiveStore({ products: JSON.parse(liveProds) });
      }
    } catch (err) {
      console.warn('Error applying live store data:', err);
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

  container.innerHTML = CATEGORIES.map(cat => {
    const img = categoryImage(cat);
    const name = escapeHtml(categoryName(cat));
    return `
    <a href="${shopUrl(cat.id)}" class="group text-center">
      <div class="relative aspect-square rounded-2xl overflow-hidden bg-brand-50 dark:bg-stone-800 mb-2.5 flex items-center justify-center">
        ${img ? `<img src="${escapeHtml(img)}" alt="${name}" loading="lazy"
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">`
          : `<i class="fa-solid ${escapeHtml(cat.icon || 'fa-tag')} text-4xl text-brand-300"></i>`}
        ${cat.video ? '<span class="video-tag"><i class="fa-solid fa-play"></i></span>' : ''}
      </div>
      <span class="font-display font-bold text-sm sm:text-base group-hover:text-brand-500 transition-colors">${name}</span>
    </a>`;
  }).join('');
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
    title = escapeHtml(categoryName(cat));
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
      ${cat && cat.video && videoSource(cat.video)
        ? `<div class="shop-banner-media">${videoFrameHTML(cat.video, { className: 'rounded-2xl' })}</div>`
        : cat && categoryImage(cat) ? `<img src="${escapeHtml(categoryImage(cat))}" alt="${title}" class="w-full sm:w-48 h-40 sm:h-36 object-cover rounded-2xl">` : ''}
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
    CATEGORIES.map(cat => chip(cat.id, escapeHtml(categoryName(cat)), PRODUCTS.filter(p => p.categoryId === cat.id).length)).join('');

  container.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

// PRODUCT CARD (used by the catalog grid and "related products")
function productCardHTML(prod) {
  const isAr = APP_STATE.lang === 'ar';
  const isFav = APP_STATE.favorites.includes(prod.id);
  const name = escapeHtml(isAr ? prod.nameAr : prod.nameEn);
  const price = priceInfo(prod);
  const onSale = price.was > 0;
  const images = getProductImages(prod);
  const hasVideo = getProductVideos(prod).length > 0;

  return `
    <div class="product-card group flex flex-col">
      <a href="${productUrl(prod.id)}" class="product-card-img block">
        <img src="${escapeHtml(images[0] || '')}" alt="${name}" loading="lazy">
        ${images[1] ? `<img src="${escapeHtml(images[1])}" alt="" loading="lazy" class="product-card-img-alt">` : ''}
        ${onSale ? `<span class="sale-tag">${isAr ? `خصم ${price.percent}%` : `-${price.percent}%`}</span>` : ''}
        ${hasVideo ? `<span class="video-tag"><i class="fa-solid fa-play"></i>${isAr ? 'فيديو' : 'Video'}</span>` : ''}
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
          <span class="price-now text-base">${formatPrice(price.now)}</span>
          ${onSale ? `<span class="price-old text-xs">${formatPrice(price.was)}</span>` : ''}
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
    filtered.sort((a, b) => priceInfo(a).now - priceInfo(b).now);
  } else if (APP_STATE.sortBy === 'price-desc') {
    filtered.sort((a, b) => priceInfo(b).now - priceInfo(a).now);
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

// PRICES & DISCOUNTS
// Discounts set in the admin page: whole store, per category, per product. The biggest one that
// still applies wins (they don't add up). A coupon code then comes off the cart total.
function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function activeDiscountPercent(prod) {
  const d = STORE_SETTINGS.discounts || {};
  const today = todayString();
  const applies = rule => rule && Number(rule.percent) > 0 && (!rule.endsAt || rule.endsAt >= today);
  const rules = [
    d.store,
    ...(d.categories || []).filter(r => r.id === prod.categoryId),
    ...(d.products || []).filter(r => r.id === prod.id)
  ].filter(applies);
  return rules.length ? Math.max(...rules.map(r => Number(r.percent))) : 0;
}

// now: what the customer pays; was: the crossed-out price (0 when there is none)
function priceInfo(prod) {
  const base = Number(prod.price) || 0;
  const percent = activeDiscountPercent(prod);
  const now = percent ? Math.round(base * (100 - percent) / 100) : base;
  const was = Math.max(Number(prod.originalPrice) || 0, percent ? base : 0);
  return was > now
    ? { now, was, percent: Math.round((1 - now / was) * 100) }
    : { now, was: 0, percent: 0 };
}

// Cart lines follow today's price, so a discount added or ended later is reflected
function cartItemPrice(item) {
  const prod = PRODUCTS.find(p => p.id === item.id);
  return prod ? priceInfo(prod).now : Number(item.price) || 0;
}

// ADS SLIDER (home page): photos and videos chosen in the admin page
let adsRenderedKey = null;
let adsIndex = 0;
let adsTimer = null;

function renderAdsSlider() {
  const section = document.getElementById('ads-slider');
  if (!section) return;
  const slides = (STORE_SETTINGS.adSlides || []).filter(s => s && s.src);
  const key = JSON.stringify(slides) + APP_STATE.lang;
  if (key === adsRenderedKey) return; // keep a playing video playing
  adsRenderedKey = key;

  section.classList.toggle('hidden', slides.length === 0);
  if (!slides.length) {
    section.innerHTML = '';
    return;
  }

  const isAr = APP_STATE.lang === 'ar';
  const shopLabel = isAr ? 'تسوق الآن' : 'Shop now';
  section.innerHTML = `
    <div class="ads-slider">
      <div id="ads-track" class="ads-track no-scrollbar">
        ${slides.map((s, i) => {
          // Links videoSource can't play are treated as photos
          const kind = videoSource(s.src)?.kind;
          const isVideo = kind === 'iframe' || kind === 'video';
          const link = s.link ? escapeHtml(s.link) : '';
          if (isVideo) {
            return `
              <div class="ads-slide" data-index="${i}" data-video="1">
                ${videoFrameHTML(s.src)}
                ${link ? `<a href="${link}" class="ads-cta btn-primary h-10 px-6 text-sm inline-flex items-center">${shopLabel}</a>` : ''}
              </div>`;
          }
          const img = `<img src="${escapeHtml(s.src)}" alt="" ${i ? 'loading="lazy"' : ''}>`;
          return `<div class="ads-slide" data-index="${i}">${link ? `<a href="${link}" class="block w-full h-full">${img}</a>` : img}</div>`;
        }).join('')}
      </div>
      ${slides.length > 1 ? `
        <button class="ads-arrow ads-arrow--prev" onclick="goToAd(adsIndex - 1)" aria-label="${isAr ? 'السابق' : 'Previous'}"><i class="fa-solid fa-chevron-${isAr ? 'right' : 'left'}"></i></button>
        <button class="ads-arrow ads-arrow--next" onclick="goToAd(adsIndex + 1)" aria-label="${isAr ? 'التالي' : 'Next'}"><i class="fa-solid fa-chevron-${isAr ? 'left' : 'right'}"></i></button>
        <div class="ads-dots">
          ${slides.map((_, i) => `<button onclick="goToAd(${i})" class="${i === 0 ? 'is-active' : ''}" aria-label="${i + 1}"></button>`).join('')}
        </div>` : ''}
    </div>`;

  adsIndex = 0;
  const track = document.getElementById('ads-track');
  // Swiping on a phone moves the track; keep the dots and timer in step with it
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) setActiveAd(Number(entry.target.dataset.index));
    });
  }, { root: track, threshold: 0.6 });
  track.querySelectorAll('.ads-slide').forEach(el => observer.observe(el));
  setActiveAd(0);
}

function goToAd(index) {
  const track = document.getElementById('ads-track');
  if (!track) return;
  const count = track.children.length;
  const target = (index + count) % count;
  const dir = document.documentElement.dir === 'rtl' ? -1 : 1;
  track.scrollTo({ left: dir * target * track.clientWidth, behavior: 'smooth' });
}

// Photos stay 5 seconds, videos 20; a video stops when its slide is left
function setActiveAd(index) {
  const track = document.getElementById('ads-track');
  if (!track) return;
  const previous = track.children[adsIndex];
  if (previous && index !== adsIndex) {
    previous.querySelectorAll('video').forEach(v => v.pause());
    previous.querySelectorAll('iframe').forEach(f => { f.src = f.src; }); // reloading an embed stops it
  }
  adsIndex = index;
  document.querySelectorAll('.ads-dots button').forEach((b, i) => b.classList.toggle('is-active', i === index));

  clearTimeout(adsTimer);
  if (track.children.length < 2) return;
  const isVideo = track.children[index]?.dataset.video === '1';
  adsTimer = setTimeout(() => {
    if (document.hidden) return setActiveAd(adsIndex);
    goToAd(adsIndex + 1);
  }, isVideo ? 20000 : 5000);
}

// ANNOUNCEMENT BAR, WHATSAPP NUMBER & SOCIAL LINKS (set in the admin page)
function applyStoreContact() {
  if (STORE_SETTINGS.whatsappNumber) APP_STATE.settings.whatsappNumber = STORE_SETTINGS.whatsappNumber;
  updateWhatsAppLinks();

  const isAr = APP_STATE.lang === 'ar';
  const text = (isAr ? STORE_SETTINGS.announcementAr : STORE_SETTINGS.announcementEn) || STORE_SETTINGS.announcementAr;
  const bar = document.getElementById('announcement-bar');
  if (bar) {
    if (bar.dataset.defaultHtml === undefined) bar.dataset.defaultHtml = bar.innerHTML;
    bar.innerHTML = text ? `<span>${escapeHtml(text)}</span>` : bar.dataset.defaultHtml;
  }

  [['instagram', 'instagramUrl'], ['facebook', 'facebookUrl'], ['tiktok', 'tiktokUrl']].forEach(([name, key]) => {
    const a = document.getElementById(`footer-${name}`);
    if (!a) return;
    a.href = STORE_SETTINGS[key] || '#';
    a.classList.toggle('hidden', !STORE_SETTINGS[key]);
  });
}

// PRODUCT PAGE (product.html?id=...)
let currentPageProduct = null;
let productPageRenderedId = null;

// MEDIA: photos and videos
// Products carry extra photos in `images` and videos in `videos` (array, or one link per line
// from the Sheet). Categories have one `video`; the home page banner is in STORE_SETTINGS.
function parseMediaList(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[\n,|]+/);
  return list.map(s => String(s || '').trim()).filter(s => /^(https?:\/\/|assets\/)/i.test(s));
}

function getProductImages(prod) {
  return [...new Set([String(prod.image || '').trim(), ...parseMediaList(prod.images)].filter(Boolean))];
}

function getProductVideos(prod) {
  return [...new Set(parseMediaList(prod.videos))];
}

function categoryName(cat) {
  return (APP_STATE.lang === 'ar' ? cat.nameAr : cat.nameEn) || cat.nameAr || cat.nameEn || cat.id;
}

// A category without its own photo borrows its video's thumbnail or one of its products' photos
function categoryImage(cat) {
  return cat.image
    || (cat.video && videoSource(cat.video)?.thumb)
    || PRODUCTS.find(p => p.categoryId === cat.id && p.image)?.image
    || '';
}

// Works out how a video link plays on the page. shape: 'wide' (16:9), 'tall' (9:16) or 'square'.
// Supports YouTube, Instagram, TikTok, Facebook, Google Drive uploads and direct .mp4/.webm links;
// anything else becomes a "watch the video" button that opens the link.
function videoSource(url, { autoplay = false } = {}) {
  let u;
  try { u = new URL(url); } catch (err) { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.replace(/^(www|m)\./, '');
  let m;

  if (host === 'youtu.be' || host.endsWith('youtube.com')) {
    const id = host === 'youtu.be' ? u.pathname.split('/')[1]
      : u.searchParams.get('v') || (u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]+)/) || [])[1];
    if (id && /^[\w-]+$/.test(id)) {
      const auto = autoplay ? `&autoplay=1&mute=1&loop=1&playlist=${id}&controls=0` : '';
      return {
        kind: 'iframe',
        src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1${auto}`,
        shape: u.pathname.startsWith('/shorts/') ? 'tall' : 'wide',
        thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
      };
    }
  }
  if (host.endsWith('instagram.com') && (m = u.pathname.match(/\/(p|reels?|tv)\/([\w-]+)/))) {
    return { kind: 'iframe', src: `https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/embed`, shape: 'tall' };
  }
  if (host.endsWith('tiktok.com') && (m = u.pathname.match(/\/video\/(\d+)/))) {
    return { kind: 'iframe', src: `https://www.tiktok.com/embed/v2/${m[1]}`, shape: 'tall' };
  }
  if (host.endsWith('facebook.com') || host === 'fb.watch') {
    return {
      kind: 'iframe',
      src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u.href)}&show_text=false`,
      shape: u.pathname.includes('/reel') ? 'tall' : 'wide'
    };
  }
  if (host === 'drive.google.com') {
    const id = (u.pathname.match(/\/file\/d\/([\w-]+)/) || [])[1] || u.searchParams.get('id');
    if (id && /^[\w-]+$/.test(id)) {
      return {
        kind: 'iframe',
        src: `https://drive.google.com/file/d/${id}/preview`,
        shape: 'square',
        thumb: `https://drive.google.com/thumbnail?id=${id}&sz=w600`
      };
    }
  }
  if (/\.(mp4|webm|mov)$/i.test(u.pathname)) {
    return { kind: 'video', src: u.href, shape: 'square' };
  }
  return { kind: 'link', src: u.href, shape: 'wide' };
}

function videoFrameHTML(url, { autoplay = false, className = '' } = {}) {
  const v = videoSource(url, { autoplay });
  if (!v) return '';
  const cls = `media-frame media-frame--${v.shape} ${className}`;
  if (v.kind === 'iframe') {
    return `<div class="${cls}"><iframe src="${escapeHtml(v.src)}" loading="lazy" title="video"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  }
  if (v.kind === 'video') {
    return `<div class="${cls}"><video src="${escapeHtml(v.src)}" controls playsinline preload="metadata"${autoplay ? ' autoplay muted loop' : ''}></video></div>`;
  }
  return `<a href="${escapeHtml(v.src)}" target="_blank" rel="noopener" class="${cls} media-frame--link">
      <i class="fa-solid fa-circle-play"></i><span>${APP_STATE.lang === 'ar' ? 'شاهد الفيديو' : 'Watch the video'}</span></a>`;
}

// HOME PAGE BANNER: the photo or video picked in the admin page, otherwise the built-in collage
let heroRenderedKey = null;

function renderHeroMedia() {
  const el = document.getElementById('hero-media');
  if (!el) return;
  if (el.dataset.defaultHtml === undefined) el.dataset.defaultHtml = el.innerHTML;

  const { heroVideo, heroImage } = STORE_SETTINGS;
  const key = `${heroVideo}|${heroImage}`;
  if (key === heroRenderedKey) return; // don't restart a playing video on every re-render
  heroRenderedKey = key;

  if (heroVideo && videoSource(heroVideo)) {
    el.innerHTML = videoFrameHTML(heroVideo, { autoplay: true, className: 'rounded-2xl' });
  } else if (heroImage) {
    el.innerHTML = `<img src="${escapeHtml(heroImage)}" alt="Nourii" class="w-full h-72 sm:h-[26rem] object-cover rounded-2xl">`;
  } else {
    el.innerHTML = el.dataset.defaultHtml;
  }
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
  const price = priceInfo(prod);
  const onSale = price.was > 0;
  const isFav = APP_STATE.favorites.includes(prod.id);
  const images = getProductImages(prod);
  const videos = getProductVideos(prod);
  // Main photo first, then videos, then the other photos
  galleryMedia = [
    ...images.slice(0, 1).map(src => ({ type: 'image', src })),
    ...videos.map(src => ({ type: 'video', src })),
    ...images.slice(1).map(src => ({ type: 'image', src }))
  ];
  galleryAlt = name;
  if (galleryIndex >= galleryMedia.length || prevQty === null) galleryIndex = 0;

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
        <div id="pp-main-media">${galleryMainHTML(galleryIndex)}</div>
        ${galleryMedia.length > 1 ? `
          <div class="grid grid-cols-5 gap-3 mt-3">
            ${galleryMedia.map((item, i) => {
              const label = `${item.type === 'video' ? (isAr ? 'فيديو' : 'Video') : (isAr ? 'صورة' : 'Photo')} ${i + 1}`;
              const thumb = item.type === 'video' ? (videoSource(item.src)?.thumb || images[0] || '') : '';
              return `
              <button onclick="selectGalleryImage(${i})" class="gallery-thumb ${i === galleryIndex ? 'is-active' : ''}" data-index="${i}" aria-label="${label}">
                ${item.type === 'video'
                  ? `<span class="gallery-thumb-video">${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy">` : ''}<i class="fa-solid fa-play"></i></span>`
                  : `<img src="${escapeHtml(item.src)}" alt="" class="w-full h-full object-cover" loading="lazy">`}
              </button>`;
            }).join('')}
          </div>` : ''}
      </div>

      <!-- Details -->
      <div class="lg:pt-4">
        ${badge ? `<span class="text-sm font-bold text-brand-500">${badge}</span>` : ''}
        <h1 class="text-3xl sm:text-4xl font-bold leading-snug mt-1 mb-4">${name}</h1>

        <div class="flex items-baseline gap-3 mb-6">
          <span class="price-now text-3xl font-display">${formatPrice(price.now)}</span>
          ${onSale ? `<span class="price-old text-lg">${formatPrice(price.was)}</span>
            <span class="sale-pill">${isAr ? `وفّر ${price.percent}%` : `Save ${price.percent}%`}</span>` : ''}
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
  if (stickyPrice) stickyPrice.innerText = formatPrice(price.now);
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

// Product page gallery: photos and videos of the product shown on the page
let galleryMedia = [];
let galleryIndex = 0;
let galleryAlt = '';

function galleryMainHTML(index) {
  const item = galleryMedia[index];
  if (!item) return '<div class="product-card-img rounded-3xl"></div>';
  if (item.type === 'video') return videoFrameHTML(item.src, { className: 'rounded-3xl' });
  return `<div class="product-card-img rounded-3xl"><img id="pp-main-img" src="${escapeHtml(item.src)}" alt="${galleryAlt}"></div>`;
}

function selectGalleryImage(index) {
  const main = document.getElementById('pp-main-media');
  if (!main || !galleryMedia[index]) return;
  galleryIndex = index;
  main.innerHTML = galleryMainHTML(index);
  document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.toggle('is-active', Number(t.dataset.index) === index));
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
      price: priceInfo(product).now,
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
    const itemTotal = cartItemPrice(item) * item.qty;
    subtotal += itemTotal;
    const name = escapeHtml(isAr ? item.nameAr : item.nameEn);

    return `
      <div class="flex gap-4 pb-4 border-b border-stone-100 dark:border-stone-800 relative">
        <a href="${productUrl(item.id)}" class="flex-shrink-0">
          <img src="${escapeHtml(item.image)}" alt="${name}" class="w-20 h-20 rounded-2xl object-cover">
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

// PROMO CODE (codes are set in the admin page and checked by Google Drive)
const LEGACY_PROMO_CODES = { NOURII10: 10, NOUR10: 10, WELCOME: 5 };

function applyPromoCode() {
  const input = document.getElementById('promo-input');
  if (!input) return;

  const code = input.value.trim().toUpperCase();
  const isAr = APP_STATE.lang === 'ar';
  if (code === '') {
    showToast(isAr ? 'يرجى كتابة كود الخصم أولاً' : 'Please enter promo code', 'error');
    return;
  }

  const accept = percent => {
    APP_STATE.promoCode = code;
    APP_STATE.discountRate = percent / 100;
    showToast(isAr ? `تم تطبيق كود الخصم ${percent}% بنجاح! 🎉` : `${percent}% discount applied! 🎉`, 'success');
    renderCartDrawer();
  };
  const reject = () => showToast(isAr ? 'كود الخصم غير صالح أو انتهى' : 'Invalid or expired promo code', 'error');

  const driveUrl = typeof NOURII_CONFIG !== 'undefined' && NOURII_CONFIG.googleScriptUrl;
  if (!driveUrl) return LEGACY_PROMO_CODES[code] ? accept(LEGACY_PROMO_CODES[code]) : reject();

  const btn = document.getElementById('promo-apply-btn');
  if (btn) btn.disabled = true;
  fetch(`${driveUrl}?action=checkCoupon&code=${encodeURIComponent(code)}`)
    .then(res => res.json())
    .then(res => {
      if (res.status === 'success' && Number(res.percent) > 0) return accept(Number(res.percent));
      // Apps Script not redeployed yet: it doesn't know checkCoupon
      if (res.message === 'Unknown action' && LEGACY_PROMO_CODES[code]) return accept(LEGACY_PROMO_CODES[code]);
      reject();
    })
    .catch(() => showToast(isAr ? 'تعذر التحقق من الكود، حاول مرة أخرى' : 'Could not check the code, try again', 'error'))
    .finally(() => { if (btn) btn.disabled = false; });
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
    const itemTotal = cartItemPrice(item) * item.qty;
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
      const cartDrawer = document.getElementById('cart-drawer');
      if (cartDrawer && !cartDrawer.classList.contains('hidden')) {
        toggleCartDrawer();
      }
    }
  });
}
