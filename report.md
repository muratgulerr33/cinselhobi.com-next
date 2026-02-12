# Perf / Cache / Security Discovery Report

## 1) Repo snapshot
- Repo: `/Users/apple/dev/cinselhobi.com-next`
- Branch: `backup/page-transition-hub-20260123-1915`
- Commit: `9a175305ef7484edddbab8133c630cac408e01ba`
- Node: `v22.14.0`
- npm: `10.9.2`
- Scripts summary: dev/build/start/lint + Drizzle DB tools + hub/category QC scripts (see `data/snapshots/perf-discovery/20260124-0445/commands/07-npm-run.txt`).
- Config/middleware: `next.config.ts` present; `vercel.json` missing; `middleware.ts` missing (see `data/snapshots/perf-discovery/20260124-0445/commands/29-config-ls.txt` and `data/snapshots/perf-discovery/20260124-0445/commands/20-middleware-ls.txt`).
- Command fallback note: `rg` regex for `next: { revalidate }` failed, so `grep` fallback used for command 12.

## 2) Master Pack map (brief)
- Master Pack found: `docs/00.chatgpt-master-pack-16-01-2026.md`.
- Relevant docs for perf/cache/security: DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-07, DOC-08, DOC-09.

## 3) A) Page → data source → render mode
Render mode terms: SSR means server render per request; ISR means cached server render; "force-dynamic" means always SSR.

| Page route | Data source | Render mode (evidence) | Cache breakers (evidence) |
| --- | --- | --- | --- |
| `/` | DB via `getLatestProductsCursor` + session check via `auth()`; client Load More hits `/api/products` | `force-dynamic` from `src/app/layout.tsx:46` | `auth()` session use at `src/app/page.tsx:22`; global `force-dynamic` at `src/app/layout.tsx:46` |
| `/hub` | Config data only (`HUBS`), images | `force-dynamic` from `src/app/layout.tsx:46` | global `force-dynamic` at `src/app/layout.tsx:46` |
| `/hub/[hubSlug]` | DB via `getCategoryBySlug` + `getChildCategoriesByParentWcId` | `force-dynamic` from `src/app/layout.tsx:46` | global `force-dynamic` at `src/app/layout.tsx:46` |
| `/search` | DB direct selects on products/categories/joins | `force-dynamic` from `src/app/layout.tsx:46` | global `force-dynamic` at `src/app/layout.tsx:46` |
| `/categories` | Redirect only (`permanentRedirect`) | `force-dynamic` from `src/app/layout.tsx:46` | global `force-dynamic` at `src/app/layout.tsx:46` |
| `/${slug}` (category) | DB via `getCategoryBySlug`, `getProductsCursor`, `getChildCategoriesByParentWcId` | `force-dynamic` from `src/app/layout.tsx:46` | global `force-dynamic` at `src/app/layout.tsx:46` |
| `/urun/[slug]` | DB via `getProductBySlug` + `productCategories` lookup + related products query | `force-dynamic` from `src/app/layout.tsx:46` | global `force-dynamic` at `src/app/layout.tsx:46` |
| `/cart` | Client cart state in `localStorage` | `force-dynamic` from `src/app/layout.tsx:46` | global `force-dynamic` at `src/app/layout.tsx:46` |
| `/checkout` | Client page calls server actions that hit DB | `force-dynamic` from `src/app/layout.tsx:46` | global `force-dynamic` at `src/app/layout.tsx:46` |
| `/account` | Session gate in account layout; page itself is static UI | `force-dynamic` in `src/app/account/layout.tsx:6` | `auth()` session gate at `src/app/account/layout.tsx:13-14` |

Evidence refs for the table:
- Home data: `src/app/page.tsx:1-31`.
- Hub index data: `src/app/hub/page.tsx:1-20`.
- Hub detail data: `src/app/hub/[hubSlug]/page.tsx:23-33`.
- Search data: `src/app/search/page.tsx:15-46`.
- Categories redirect: `src/app/categories/page.tsx:1-5`.
- Category page data: `src/app/[slug]/page.tsx:88-189`.
- Product detail data: `src/app/urun/[slug]/page.tsx:49-112`.
- Cart storage: `src/components/cart/cart-store.ts:14-42` + page `src/app/cart/page.tsx:1-5`.
- Checkout actions: `src/actions/address.ts:67-76` and `src/actions/checkout.ts:125-173`.
- Global render mode: `src/app/layout.tsx:46`.

## 4) B) Top 5 expensive points (evidence-based)
1) Search pulls full tables on every query. This is heavy DB and memory use (Hypothesis: TTFB/CPU). Evidence: `src/app/api/search/route.ts:26-55` and `src/app/search/page.tsx:15-46`.
2) App-wide `force-dynamic` disables static/ISR caching. This forces SSR on every request (Hypothesis: TTFB/cache). Evidence: `src/app/layout.tsx:46`.
3) `/api/products` is `force-dynamic`, `revalidate = 0`, and sends `Cache-Control: no-store`, while multiple clients call it. This bypasses CDN cache and repeats DB work (Hypothesis: TTFB/DB). Evidence: `src/app/api/products/route.ts:9-10,130-134` + callers in `src/components/catalog/load-more-grid.tsx:62-100`, `src/components/hub/hub-featured-rail.tsx:75-91`, `src/components/hub/category-quick-look-sheet.tsx:55-75`.
4) Hub detail page runs multiple DB calls per parent slug via `Promise.all`. This can amplify DB load with many hubs (Hypothesis: TTFB/DB). Evidence: `src/app/hub/[hubSlug]/page.tsx:23-33`.
5) Product detail hero gallery renders large images and a client slider. This is a likely LCP and JS cost hotspot (Hypothesis: LCP/JS). Evidence: `src/components/product/product-view.tsx:117-168`.

## 5) C) 5 quick wins (no code changes yet)
1) Scope `force-dynamic` to only auth-required routes. This can enable ISR (cached server render) for `/hub` and static pages. Risk: High (might affect session-aware UI). Evidence: `src/app/layout.tsx:46` and `src/app/account/layout.tsx:6`.
2) Add caching for anonymous `/api/products` responses (e.g., `s-maxage`) and keep `no-store` for logged-in users. This reduces DB load without touching checkout/auth flows. Risk: Medium. Evidence: `src/app/api/products/route.ts:9-10,130-134`.
3) Move search filtering into SQL with limits, instead of loading full tables in memory. This reduces TTFB and memory. Risk: Medium. Evidence: `src/app/api/search/route.ts:26-55`.
4) Replace `<img>` tags with `next/image` where possible. This gives automatic image optimization (compression + resizing). Risk: Low. Evidence: `src/components/cart/cart-view.tsx:125-131` and `src/components/catalog/category-grid.tsx:31-37`.
5) Lazy-load or defer carousel bundles on non-critical pages. This reduces JS on initial load (Hypothesis: JS/LCP). Risk: Low/Medium. Evidence: `src/components/ui/carousel.tsx:3-66` + `src/components/product/detail/related-products-carousel.tsx:1-33`.

## 6) D) Next-step plan draft (single PR = single intent)
Goal: Reduce perf debt without breaking auth or checkout.

Plan (safe sequence):
1) Decide caching strategy for anonymous vs authenticated routes. Document which pages can be static/ISR. Files to touch (candidate): `src/app/layout.tsx`, `src/app/account/layout.tsx`.
2) Optimize search data path: replace full table loads with SQL-filtered queries. Files to touch (candidate): `src/app/api/search/route.ts`, `src/app/search/page.tsx`.
3) Add API response caching for `/api/products` when user is anonymous. Files to touch (candidate): `src/app/api/products/route.ts`.
4) Reduce image cost: migrate `<img>` to `next/image` in cart and category grid. Files to touch (candidate): `src/components/cart/cart-view.tsx`, `src/components/catalog/category-grid.tsx`.
5) Optional JS deferral: dynamically import carousels on product pages. Files to touch (candidate): `src/components/product/detail/related-products-carousel.tsx`, `src/components/ui/carousel.tsx`.

Definition of Done (DoD):
- `npm run lint`
- `npm run build`
- Basic smoke: home, hub, product detail, search, cart, checkout.

## 7) PageSpeed JSON
- PageSpeed JSON: Missing — Murat will provide. Expected filename: `pagespeed.json` (repo root) or `data/snapshots/*pagespeed*.json`.

## 8) Appendix: command outputs
- `data/snapshots/perf-discovery/20260124-0445/commands/00-pwd.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/01-git-head.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/02-git-branch.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/03-git-status.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/04-node-version.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/05-npm-version.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/06-package-json.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/07-npm-run.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/08-npm-scripts.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/09-app-router-cache-exports.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/10-fetch-usage.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/11-fetch-cache-directives.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/12-fetch-next-revalidate.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/13-db-ls.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/14-db-access-points.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/15-db-callers.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/16-api-routes-list.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/17-api-route-methods.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/18-auth-commerce-routes.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/19-cache-breakers.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/20-middleware-ls.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/21-middleware-headers.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/22-img-tags.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/23-next-image-usage.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/24-carousel-rail-usage.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/25-map-usage.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/26-json-response-usage.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/27-edge-runtime.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/28-fs-writes.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/29-config-ls.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/30-next-config-ts.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/31-next-config-js.txt`
- `data/snapshots/perf-discovery/20260124-0445/commands/32-vercel-json.txt`
