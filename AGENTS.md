# Nourii store — shared notes for AI agents

This file is read by both **Antigravity** and **Claude Code**. Whichever agent works on
this project should read it first and add a short line to the "Work log" at the bottom
when it finishes something, so the other agent knows what changed.

## What this project is

A static online store for the Nourii brand (handmade prints, coloring kits, event favors,
notebooks, kids' learning tools). Arabic-first, RTL, with English toggle and dark mode.
Orders are sent through WhatsApp; there is no payment gateway.

- Live site: https://yaminakkady.github.io/nourii/
- Admin page: https://yaminakkady.github.io/nourii/admin.html
- Repo: https://github.com/yaminakkady/nourii (branch `main`, served by GitHub Pages)

### The 10 categories
كونكريت للتلوين · كتب تلوين · صور مغناطيس و بروش · توزيعات مناسبات · نوت بوك ·
مطبوعات دينية · ادوات تعليمية للاطفال · مطبوعات · استيكرز · اخرى

Sample photos for each category are the `.jpeg`/`.jpg` files in the project root; the
copies the site uses live in `assets/images/`.

## Files

| File | Role |
|------|------|
| `index.html` | Home page: hero, category tiles, best sellers, giveaways promo, reviews, FAQs |
| `shop.html` | Shop page: all products (`shop.html`), one category (`shop.html?cat=<id>`), search (`?q=`) or wishlist (`?fav=1`); banner, chips, search, sort, grid |
| `giveaways.html` | Smart giveaways estimator page |
| `app.js`, `styles.css` | Shared storefront logic and styles: cart, wishlist, coupons (`NOURII10`), WhatsApp checkout, page renderers |
| `product.html` | Product page (`product.html?id=<product id>`): gallery, price, name field, qty, add to cart / buy now, tabs, related products, sticky buy bar |
| `layout.js` | Shared announcement bar, header + category menu, footer, cart drawer, checkout and settings modals, injected into `#site-header`, `#site-footer`, `#site-overlays` on every storefront page |
| `tailwind-config.js` | Shared Tailwind theme: bright pink `brand` scale (`#e85db3`), El Messiri display font |
| `products.js` | Fallback product catalog (27 products), used when Google Drive can't be reached |
| `admin.html`, `admin.js`, `admin.css` | Admin portal: login, products CRUD, users (Admin/Editor), password change, first-login password setup |
| `config.js` | `googleScriptUrl` (live Apps Script web app) and GitHub repo settings |
| `google_apps_script_backend.js` | Code pasted into Google Apps Script; creates/uses `Products` and `Users` sheets and a `Nourii Media` Drive folder |
| `sync_google_to_github.py`, `sync_store.bat` | Pull products from the Sheet, rewrite `products.js`, commit and push |
| `nourii_products_database.csv` | Product data export for importing into the Sheet |
| `docs/` | Setup guides (Google Drive setup guide is git-ignored) |

## How data flows

- **Google Sheets (via the Apps Script URL in `config.js`) is the source of truth** for
  products and users. `products.js` is only a fallback copy.
- **Login goes through Google Drive only** and returns a signed session token (12 hours,
  HMAC secret in Script Properties `AUTH_SECRET`). Every write action (`saveProduct`,
  `deleteProduct`, `uploadImage`: admin or editor; `saveUser`, `deleteUser`, `getUsers`,
  `bulkImportProducts`: admin only) must send `token`; the backend re-reads the user each time,
  so deleted/disabled users and changed passwords end sessions at once. Code `unauthorized` =
  no valid session (admin page logs out); `forbidden` = role not allowed.
- Passwords in the `Users` sheet are salted SHA-256 hashes (`sha256$salt$hash`). A plain
  password typed into the sheet by the owner still works once and is hashed on that login.
  Minimum length 8; 5 wrong logins lock that username for 15 minutes. Forgot the admin
  password: run `resetAdminPassword()` in the Apps Script editor (prints a temp password).
- The admin page never stores passwords in the browser. If the `admin` row is removed from
  the `Users` sheet, or Drive is unreachable, nobody can log in. Keep that row.
- Speed: the backend caches `getProducts` for 5 minutes (cleared on product saves and by the
  `onEdit` trigger when the sheet is edited by hand); the storefront reuses a product list
  fetched in the last 5 minutes when moving between pages.
- Script and style tags in every storefront page and `admin.html` carry a version
  query string for cache busting. Bump it when you change those files.
- Every header menu item is its own page (home, `shop.html`, `shop.html?cat=<id>` per
  category, `giveaways.html`). Old `index.html?cat=...` links redirect to `shop.html`. A product can have extra photos in an optional `images` field (array, or comma /
  new-line separated URLs); they show as thumbnails on its product page.
- When the Apps Script backend changes, it must be re-pasted in Google Apps Script and
  redeployed; a new deployment gives a new URL that must go into `config.js`.

## Rules for agents

- Never put passwords, GitHub tokens or other secrets in this file or in committed code.
- After changing `google_apps_script_backend.js`, the owner must paste it into Apps Script and
  redeploy (Manage deployments → Edit → New version keeps the same URL).
- Test changes against the live Apps Script URL before pushing; the site updates as soon as
  `main` is pushed.
- Keep the UI Arabic-first and RTL.

## Work log

- 2026-10-08 (Antigravity): Built the storefront with 10 categories, WhatsApp checkout,
  giveaways estimator, bilingual UI and dark mode.
- 2026-10-09 (Antigravity): Published to GitHub Pages. Added admin portal, Google Drive
  backend, GitHub sync, password change and first-login setup. Fixed multi-device login and
  made Google Drive the strict source of truth so deleted users can't log in (commit
  `ff623ff`). Gave a resale price estimate (about 15,000–30,000 EGP for a new store with no
  sales yet).
- 2026-11-01 (Claude Code): Added this shared AGENTS.md and CLAUDE.md, and registered
  Claude Code as an MCP server in Antigravity.
- 2026-11-01 (Claude Code): Added the `antigravity` MCP server to Claude Code
  (`~/.claude/mcp/antigravity-bridge/server.js`). Claude Code can now start and continue
  Antigravity conversations (Flash/Pro tiers) and ask Gemini 4 Argon through the Gemini API.
- 2026-11-01 (Claude Code): Redesigned the storefront in a clean white + bright pink style
  (El Messiri font, pill buttons, centered logo with category menu). Replaced the product
  pop-up with a shareable product page (`product.html?id=...`) and moved the shared header,
  footer and cart into `layout.js`.
- 2026-11-01 (Claude Code): Split the storefront into pages: each menu item now opens its own
  page (`shop.html` for all products and per category, `giveaways.html`); home keeps hero,
  categories, best sellers, reviews and FAQs.
- 2026-11-01 (Claude Code): Security fix: backend write actions now require a signed login
  token and the right role, passwords are hashed, login lockout added, user list no longer
  public, default password removed from the site/docs. Added backend + storefront product
  caching. Owner must redeploy the Apps Script for the backend part to take effect.
