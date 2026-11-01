// ========================================================
// NOURII STORE - SHARED TAILWIND THEME (ألوان وخطوط المتجر)
// ========================================================
// Loaded right after the Tailwind CDN script on every storefront page.

tailwind.config = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"El Messiri"', 'Cairo', 'sans-serif'],
        sans: ['Cairo', '"El Messiri"', 'Outfit', 'sans-serif'],
      },
      colors: {
        // Bright pink brand scale (main accent: brand-500 #e85db3)
        brand: {
          50: '#fdf2f9',
          100: '#fce7f4',
          200: '#fbcfea',
          300: '#f7a8d6',
          400: '#f07cc4',
          500: '#e85db3',
          600: '#d4409b',
          700: '#b52f80',
          800: '#942a69',
          900: '#7a2657',
        },
        // Older markup uses Tailwind's pink-*; point it at the same scale
        pink: {
          50: '#fdf2f9',
          100: '#fce7f4',
          200: '#fbcfea',
          300: '#f7a8d6',
          400: '#f07cc4',
          500: '#e85db3',
          600: '#d4409b',
          700: '#b52f80',
          800: '#942a69',
          900: '#7a2657',
        },
        ink: '#131316',
      }
    }
  }
};
