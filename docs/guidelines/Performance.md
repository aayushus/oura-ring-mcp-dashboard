# Performance Guidelines

**Version 1.0** · Last updated 17 April 2026

> **See also:** [Architecture Guidelines](Architecture.md) — caching strategy, database design, scaling timeline | [Security Guidelines](Security.md) — rate limiting, DDoS protection | [Code Quality Guidelines](Code-Quality.md) — profiling, N+1 query prevention | [Documentation Guidelines](Documentation.md) — SLO documentation, incident runbooks

This document is a reference contract for performance — how fast every part of a product has to be, and what to do when it isn't. Local project rules, installed agent configs, and the actual product scale take precedence over example budgets here. Performance is a feature. Slow software loses users, burns money on infrastructure, and invites scale problems that compound. Treating speed as an afterthought is how systems end up needing expensive rewrites.

This is a **companion** to `Architecture.md` (system shape), `Security.md` (defences), and `Code-Quality.md` (craft). Performance overlaps all three — when the four conflict, treat each doc's specifics as canonical in its own domain.

**Core stance:** slow is a bug. Every team has a performance budget, explicit or implicit. Making it explicit lets you ship; leaving it implicit lets it erode until the product feels broken.

---

## Table of contents

1. [Principles](#1-principles)
2. [Budgets and targets](#2-budgets-and-targets)
3. [Measurement](#3-measurement)
4. [Frontend performance](#4-frontend-performance)
5. [Core Web Vitals](#5-core-web-vitals)
6. [Bundle and asset strategy](#6-bundle-and-asset-strategy)
7. [Rendering performance](#7-rendering-performance)
8. [Mobile constraints](#8-mobile-constraints)
9. [Network strategy](#9-network-strategy)
10. [API performance](#10-api-performance)
11. [Database performance](#11-database-performance)
12. [Caching](#12-caching)
13. [Async and background work](#13-async-and-background-work)
14. [AI performance](#14-ai-performance)
15. [Observability for performance](#15-observability-for-performance)
16. [Performance review process](#16-performance-review-process)
17. [Anti-patterns](#17-anti-patterns)
18. [Pre-ship checklist](#18-pre-ship-checklist)

---

## 1. Principles

Seven principles, in priority order.

**1.1 Measure, then optimise — in that order.** Every performance intuition is wrong until proven. The bottleneck is almost never where you think. Profile, measure, find the real hot spot. The time spent on a well-targeted fix beats days of speculative optimisation.

**1.2 Speed is a feature, not a task.** Performance is not "we'll optimise before launch". It's a constraint that shapes every PR. A feature that ships 100ms slower than the budget permits is not a completed feature — it's a feature with a known bug.

**1.3 Budgets over targets.** A target is a dream; a budget is a contract. Set budgets, enforce them in CI, reject PRs that blow them. "Let's try to keep it fast" is how products become slow one compromise at a time.

**1.4 The cheapest work is no work.** The fastest query is the one you didn't run. The fastest render is the one that didn't happen. Before optimising how something executes, ask if it needs to execute at all. Caching, deduplication, and lazy loading beat micro-optimisation.

**1.5 Latency over throughput for user-facing work.** A user waiting for a button to respond doesn't care about your 10k RPS capacity. Optimise p99 response time for requests a human is blocking on. Optimise throughput only where humans aren't in the loop.

**1.6 Costs compound.** A 50ms slowdown in a commonly-called function adds up to minutes of human-wait-time per day across a user base. A 10KB bundle increase is thousands of extra MB of bandwidth per day. Small costs, at scale, aren't small.

**1.7 Premature optimisation is still bad.** Everything above doesn't justify optimising before you have a problem. Measure first (§1.1). Optimise when the profile says to, not when you have a hunch. Code written clearly and boringly outperforms clever code that's harder to reason about, because clear code gets optimised correctly when the time comes.

---

## 2. Budgets and targets

Every product has performance budgets. These are the defaults — override per-project in an ADR when there's a reason, but don't silently drift.

### 2.1 User-facing interaction budgets

| Interaction | Budget | Notes |
|---|---|---|
| Perceived instant | < 100ms | Click feedback, hover, input response |
| UI transition | < 200ms | Page change, modal open, tab switch |
| Acceptable wait | < 1s | Most API calls the user is waiting on |
| Progress indicator required | > 1s | Show spinner / skeleton / progress bar |
| User disengages | > 10s | Anything this slow needs to be async with notification on completion |

These aren't targets — they're the thresholds at which users perceive the system differently. Past each line, the experience changes.

### 2.2 Core Web Vitals targets

The three 2024+ Google CWV metrics, measured at the 75th percentile across real users (field data, not lab):

| Metric | Good | Needs improvement | Poor |
|---|---|---|---|
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | 2.5s–4.0s | > 4.0s |
| **INP** (Interaction to Next Paint) | ≤ 200ms | 200ms–500ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | 0.1–0.25 | > 0.25 |

Ship target: **Good on all three**. This is enforced in CI where possible (Lighthouse) and monitored in production via real-user monitoring (RUM).

### 2.3 Bundle budgets

| Asset | Budget | Notes |
|---|---|---|
| Initial JS (gzipped) | ≤ 170KB | Hard cap; anything larger blocks LCP on slow networks |
| Initial CSS (gzipped) | ≤ 30KB | Often underrated; big CSS files block render |
| Initial font payload | ≤ 100KB | Subset, preload critical, woff2 only |
| Initial HTML | ≤ 30KB | Server-rendered content only |
| Any single image (above fold) | ≤ 100KB | Next-gen format (AVIF / WebP), responsive sizing |
| Total weight for first meaningful paint | ≤ 500KB | On a 4G-ish connection (1.6 Mbps) this is ~2.5s |

If a route legitimately needs more, it's not the default route — load it async when the user navigates there.

### 2.4 API response time budgets

Measured at the server, not including network latency.

| Route type | p50 | p95 | p99 |
|---|---|---|---|
| Read (single resource, cached-eligible) | < 50ms | < 200ms | < 500ms |
| Read (list, paginated) | < 100ms | < 300ms | < 800ms |
| Write (single resource) | < 100ms | < 300ms | < 1s |
| Search / filter | < 200ms | < 500ms | < 1s |
| Complex aggregation | < 500ms | < 1.5s | < 3s |

p99 breaching for > 5 minutes is an alert. Slow queries hiding in the long tail are how systems degrade gracelessly under load.

### 2.5 Database query budgets

Any single query:

- < 10ms for indexed point lookups
- < 50ms for small list queries
- < 200ms for list queries with joins
- < 500ms for the slowest analytical queries

Anything slower is either a bug, a missing index, or a query that belongs in an async job.

### 2.6 Enforcement

- Lighthouse CI on every frontend PR — fails build on CWV regression or bundle budget breach
- Load tests in CI for API budgets (k6, Artillery) — fails build on p95 regression > 10%
- Slow-query log in dev environments at 50ms threshold — any query exceeding that warns during development
- Production alerts on each budget breach (§15)

---

## 3. Measurement

You cannot optimise what you don't measure. Measurement infrastructure is not optional; it's a prerequisite to any perf work.

### 3.1 Real user monitoring (RUM) over lab data

Lab data (Lighthouse, WebPageTest) is reproducible but unrepresentative. Your users are on 3-year-old Android phones on spotty 4G, not a fast desktop. **RUM is ground truth.**

Tools:
- **Frontend**: hosting provider Speed Insights, SpeedCurve, CDN RUM, or self-hosted via `web-vitals` → your metrics backend. Cheap at small scale; grows with usage.
- **Backend**: OpenTelemetry + Prometheus / Honeycomb / monitoring tool for distributed traces.
- **Database**: slow query log + `pg_stat_statements` for Postgres.
- **Mobile web**: same RUM as desktop; device type and connection tagged.

Lab data is still useful for regression testing — you can reliably run Lighthouse in CI and fail on regressions. Use both.

### 3.2 What to measure

**Frontend**
- Core Web Vitals (LCP, INP, CLS) — per page, per device type, per country
- Time to First Byte (TTFB) — per page
- Bundle size per route, tracked over time
- JS execution time on main thread
- Long tasks (> 50ms) — where they fire, what triggered

**Backend**
- Request duration per route (p50, p95, p99)
- Queue depth and processing time per queue
- Database query time per query (top 100 slowest)
- External service call duration per dependency
- Memory and CPU per service

**Database**
- Slow queries (log threshold: 50ms in dev, 500ms in prod)
- Connection pool utilisation
- Index hit ratio (should be > 99%)
- Buffer cache hit ratio (should be > 99%)
- Table bloat (monitor pg_stat_user_tables)

**AI** (where applicable)
- Latency per model call
- Token cost per tenant, per day
- Cache hit rate for deterministic AI calls
- Error / fallback rate

### 3.3 Percentiles, not averages

Averages lie. A route with p50=50ms and p99=10s averages to ~200ms, which sounds fine — until you realise 1 in 100 users is waiting 10 seconds.

Track p50 (typical user), p95 (slow user), p99 (worst user who's still having a usable experience). Alert on p95. Investigate p99 tails — they often reveal bugs averages hide.

### 3.4 Profiling, not speculation

When something is slow, profile. Don't guess.

- **Node**: `node --inspect`, `clinic doctor`, `0x`, Chrome DevTools profiler
- **Python**: `py-spy record`, `cProfile`, `scalene` (CPU + memory)
- **Browser**: Chrome DevTools → Performance tab, React DevTools Profiler
- **Database**: `EXPLAIN (ANALYZE, BUFFERS, VERBOSE)` on every suspect query
- **Flame graphs**: the fastest way to see where time actually goes

A 30-minute profiling session routinely saves a week of wrong guesses.

### 3.5 A/B testing performance changes

For any non-obvious performance change:

1. Branch the change behind a flag (see architecture §12.6)
2. Roll out to 5% of traffic for 24h
3. Compare RUM metrics vs control
4. Promote if no regression, roll back if regression, investigate if mixed

Performance fixes sometimes make other things worse (cache warming, memory pressure, tail latency). A/B proves it.

---

## 4. Frontend performance

### 4.1 The critical rendering path

The sequence between URL entry and first useful pixel:

```
DNS → TCP → TLS → Request → HTML → CSS → JS → Render → Hydrate → Interactive
```

Every ms before the render is ms users stare at a blank screen. The goal: minimise the work on the critical path; push everything else behind it.

**Rules:**
- HTML returned with useful content server-side, not a shell that waits for JS
- CSS inlined for above-the-fold, rest async
- JS deferred (`defer` attribute) unless it must run before render
- Third-party scripts loaded after interactive — never before
- Fonts preloaded, with `font-display: swap` to avoid FOIT

### 4.2 Render where it's fastest

Pick rendering strategy by page type:

| Page type | Strategy | Why |
|---|---|---|
| Marketing / landing | SSG (static) | Fastest possible; no server work at request time |
| Logged-out, public data | ISR / SSG + revalidate | Updatable without full rebuild |
| Logged-in, personalised | SSR | Content needs session context |
| App shell, highly dynamic | CSR with SSR shell | React takes over after initial HTML |
| Real-time dashboards | CSR with WebSocket | Minimise re-fetch; stream updates |

Next.js, Remix, SvelteKit all support all four. Pick per-route, not per-app.

### 4.3 Rendering framework defaults

For React-based stacks:

- **React 19+** with Server Components where the framework supports (Next.js App Router)
- **Suspense** for loading states — not ad-hoc spinners
- **Streaming SSR** — send HTML as soon as available, don't wait for the whole tree
- **Selective hydration** — hydrate interactive parts first, static parts later
- **No unnecessary `"use client"`** — every client component is JS in the bundle; default to server

For non-React: Vue 3 + Nuxt, SvelteKit, Solid + SolidStart all follow similar principles. Match the stack's idiom.

### 4.4 JavaScript budget

Every KB of JS is:
- Downloaded (network cost)
- Parsed (CPU cost, multiplied on slow devices)
- Executed (blocks main thread)
- Kept in memory (memory pressure on low-RAM devices)

170KB gzipped initial JS is a budget, not a goal. Aim lower. A fully-featured app at 80KB gzipped initial load exists — it's just engineered that way.

### 4.5 CSS performance

CSS is render-blocking by default. Strategies:

- **Inline critical CSS** for above-the-fold (< 14KB to fit in the first TCP roundtrip)
- **Async-load the rest** via `<link rel="preload" as="style" onload="this.rel='stylesheet'">`
- **No CSS-in-JS runtime** on the critical path — use compile-time solutions (vanilla-extract, CSS modules, Tailwind, or raw CSS files). Runtime CSS-in-JS (emotion, styled-components without compilation) ships the CSS engine as JS, blocking hydration.
- **Avoid `@import` in CSS** — serialises loading, defeats parallelism

### 4.6 Fonts

Fonts are commonly 100-500KB each and block text render until loaded. Rules:

- **System fonts by default** (see design guidelines): zero load cost, native render
- **Web fonts only if brand-critical**, and subset aggressively — Latin-only is usually all you need
- **woff2 only** — woff and ttf are obsolete
- **`font-display: swap`** — show fallback font while web font loads, swap when ready
- **Preload the 1-2 fonts used above the fold**:
  ```html
  <link rel="preload" href="/fonts/body.woff2" as="font" type="font/woff2" crossorigin>
  ```
- **Variable fonts** if you need multiple weights of the same family — one file instead of 4

### 4.7 Images

Images are often 80%+ of total page weight. Attack this first.

- **Next-gen formats**: AVIF for new, WebP as fallback, JPEG only if you must. Never PNG for photos.
- **Responsive images** via `<picture>` or `srcset`. Never serve a 2000px image to a phone.
- **Lazy load below-the-fold**: `<img loading="lazy">`. Native support, no library needed.
- **Eager load above-the-fold hero** with `fetchpriority="high"` — otherwise the browser deprioritises it.
- **Explicit dimensions** (`width` and `height` attributes) to prevent CLS. If the image hasn't loaded, the browser still reserves space.
- **CDN with automatic format negotiation** — CDN Images, hosting provider Image, imgix. Cheaper than self-managed.

### 4.8 Preload, prefetch, preconnect

Browser hints that the rendering engine can act on:

```html
<!-- Connect to origin early -->
<link rel="preconnect" href="https://api.example.com">

<!-- DNS lookup only (cheaper) -->
<link rel="dns-prefetch" href="https://analytics.example.com">

<!-- Fetch a critical resource before the browser discovers it -->
<link rel="preload" href="/fonts/body.woff2" as="font" type="font/woff2" crossorigin>

<!-- Fetch likely-next page in the background -->
<link rel="prefetch" href="/dashboard">
```

**Rules:**
- Use `preconnect` for 2-4 critical origins max; each one is a TCP+TLS handshake eagerly kicked off
- Use `preload` for 1-3 critical resources (above-fold font, hero image, critical JS chunk)
- Don't over-preload; browsers deprioritise resources they didn't discover naturally

### 4.9 Third-party scripts

Analytics, chat widgets, tag managers, session replay, A/B testing SDKs — each one adds latency and often blocks the main thread.

Rules:
- **Audit annually**. Remove ones nobody uses. Every script is an ongoing tax.
- **Load after interactive** (`defer` or dynamically inject after `DOMContentLoaded`)
- **Self-host stable libraries** where license permits (Google Fonts now supports this — their CDN is no longer faster)
- **Facade pattern** for heavy embeds (YouTube, Intercom): show a lightweight placeholder, load the real thing on interaction
- **Partytown** for heavy analytics scripts — runs them in a web worker, off the main thread

### 4.10 Service workers and offline

For app-like products (most SaaS apps), a service worker earns its keep:

- Cache static assets aggressively (JS, CSS, fonts, images) — these don't change often
- Cache API responses selectively — ones that are safe to serve stale
- Offline fallback for known-critical pages
- Background sync for queued writes (e.g., a user drafted a message offline)

Don't use a service worker for: marketing sites, rarely-visited pages, anything under 2MB total.

---

## 5. Core Web Vitals

> **Quick reference:** budgets are what matter; the explanations below are for new team members. If you know what LCP/INP/CLS are, skip to the budget table.

Google's CWV are the industry standard for measuring frontend UX. They correlate with user satisfaction across billions of measured sessions.

### 5.1 LCP (Largest Contentful Paint)

When the largest element visible in the viewport renders. Users perceive this as "the page loaded".

**Budget: ≤ 2.5s at p75.**

Common causes of poor LCP:
- **Slow TTFB** — server takes too long to respond. Fix: CDN, better server, edge rendering.
- **Render-blocking JS / CSS** — browser waits to execute before rendering. Fix: defer JS, inline critical CSS.
- **Heavy hero image** — hero loads slowly. Fix: compress, format, preload, `fetchpriority="high"`.
- **Too many resources before LCP element** — wasted bandwidth on non-critical assets. Fix: resource hints, defer non-critical, remove what's unused.

Debugging:
```js
// Measure LCP element
new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];
  console.log('LCP element:', lastEntry.element);
  console.log('LCP time:', lastEntry.startTime);
}).observe({ type: 'largest-contentful-paint', buffered: true });
```

### 5.2 INP (Interaction to Next Paint)

Replaces the deprecated FID metric as of March 2024. Measures the latency from user input (click, tap, key press) to the next visual update.

**Budget: ≤ 200ms at p75.**

Common causes of poor INP:
- **Long JS tasks** — event handler does too much synchronous work. Fix: break up with `scheduler.yield()`, `requestIdleCallback`, or chunking.
- **Heavy React re-renders** — event triggers cascading re-render of large trees. Fix: memoise, split state, `startTransition` for non-urgent updates.
- **Synchronous storage access** — `localStorage.setItem` is blocking. Fix: debounce, use IndexedDB for larger writes.
- **Third-party scripts** — analytics intercepts events. Fix: Partytown or remove.

Debugging: Chrome DevTools Performance panel, record an interaction, look for long tasks on the main thread after input.

### 5.3 CLS (Cumulative Layout Shift)

Measures unexpected visual movement during load. A 0.1 CLS is a mildly annoying page; 0.25+ is actively user-hostile.

**Budget: ≤ 0.1 at p75.**

Common causes of CLS:
- **Images without dimensions** — browser reserves 0 space, then bumps content when image loads. Fix: always set `width` / `height` attributes.
- **Web fonts loading** — fallback font measures differently than web font, content shifts on swap. Fix: `size-adjust` CSS descriptor, match metrics via `ascent-override`.
- **Dynamically injected ads / banners** — insertion pushes content. Fix: reserve space with `min-height`, or load above-the-fold.
- **Late-loading components** — skeleton loads, then content replaces with different height. Fix: size skeleton to match expected content.
- **Animations using top/left instead of transform** — trigger layout, cascade shifts. Fix: use `transform`.

### 5.4 TTFB (Time to First Byte)

Not technically a Core Web Vital but it gates LCP. **Budget: ≤ 800ms.**

Backed by: CDN, server-side rendering performance, database query speed. If TTFB is slow, every other frontend metric is capped. Fix TTFB first.

### 5.5 Other vitals worth tracking

- **FCP (First Contentful Paint)** — first render of anything. Budget: ≤ 1.8s.
- **TTI (Time to Interactive)** — page fully interactive. Budget: ≤ 3.8s on 4G.
- **Total Blocking Time (TBT)** — lab proxy for INP. Budget: ≤ 200ms.
- **Speed Index** — visual completeness over time. Lower is better.

### 5.6 Measuring in production

```js
// Use the web-vitals library — tiny, correct, official
import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';

function sendToAnalytics({ name, value, id, rating }) {
  fetch('/api/metrics', {
    method: 'POST',
    body: JSON.stringify({ name, value, id, rating, url: location.pathname }),
    keepalive: true,  // sends on page unload
  });
}

onCLS(sendToAnalytics);
onINP(sendToAnalytics);
onLCP(sendToAnalytics);
onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

Aggregate to percentiles by route, device type, country. Alert on p75 regression.

---

## 6. Bundle and asset strategy

### 6.1 Code splitting

Single-bundle architectures don't scale. Split by:

- **Route** — each route only loads what it needs. Framework-native in Next.js, React Router 6.4+, SvelteKit.
- **Heavy component** — charts, rich text editors, code editors. Lazy load on mount with `React.lazy` / dynamic import.
- **Rare interaction** — export-to-PDF, bulk import, admin tools. Load on button click, not on initial page.

```tsx
// React lazy load with Suspense fallback
const PdfExporter = lazy(() => import('./PdfExporter'));

function Toolbar() {
  const [exporting, setExporting] = useState(false);
  return (
    <>
      <Button onClick={() => setExporting(true)}>Export PDF</Button>
      {exporting && (
        <Suspense fallback={<Spinner />}>
          <PdfExporter onDone={() => setExporting(false)} />
        </Suspense>
      )}
    </>
  );
}
```

**Rules:**
- Every heavy library imported once and only once across the bundle. Dedupe at the bundler level.
- Shared chunk extraction — common code across routes goes in a shared chunk that's cached independently.
- Don't over-split — hundreds of tiny chunks have their own overhead (HTTP/2 multiplexing is not infinite; browser parallel-request limits still apply).

### 6.2 Bundle analysis

Every project has bundle analysis running:

- **Next.js**: `@next/bundle-analyzer`
- **Vite**: `rollup-plugin-visualizer`
- **Webpack**: `webpack-bundle-analyzer`

Run it locally when shipping anything non-trivial. Inspect the flame graph for surprises — a date library taking 80KB, a single icon library sending all its icons, an entire language pack for one locale.

```bash
# Vite — add to build script
npm run build -- --mode analyze
```

Budget enforcement in CI:

```yaml
# Example GitHub Action with bundlesize
- name: Check bundle size
  run: npx bundlesize
```

### 6.3 Tree shaking

Bundlers eliminate dead code — but only if imports are written in a tree-shakeable way.

```js
// ✗ imports the entire library
import _ from 'lodash';
_.chunk(arr, 2);

// ✓ imports only what's used
import chunk from 'lodash/chunk';
chunk(arr, 2);

// ✓ best — use lodash-es (ESM) or native
import { chunk } from 'lodash-es';
```

**Rules:**
- Use ESM-native libraries where available (`lodash-es` not `lodash`, `date-fns` not `moment`)
- Avoid libraries with side effects on import (register global plugins, patch prototypes)
- Mark `"sideEffects": false` in `package.json` for libraries that genuinely have no side-effectful imports — bundlers tree-shake aggressively

### 6.4 Heavy dependency audit

Quarterly: run bundle analysis, identify the top 10 largest dependencies, ask for each:

1. Is it actually used?
2. Is it used heavily or for one function? (If one function, inline it.)
3. Is there a lighter alternative?

Common heavy offenders and their lighter alternatives:

| Heavy | Light |
|---|---|
| `moment.js` (230KB) | `date-fns` (tree-shaken, ~20KB) or native `Intl.DateTimeFormat` |
| `lodash` (70KB) | `lodash-es` tree-shaken to 2-5KB, or native |
| `axios` (17KB) | Native `fetch` (0KB) |
| Full `react-icons` | Individual icon imports, or custom SVG set |
| `jquery` | Modern DOM APIs (0KB) |
| `immutable.js` | Native `structuredClone` or `immer` (smaller) |
| Full charting libraries | Modular chart packages such as `@mui/x-charts`, or other tree-shakable chart modules |

### 6.5 Compression

- **Brotli** on the server — 15-20% better than gzip for text. Every modern CDN supports it.
- **Pre-compress static assets** (build-time Brotli) so the server doesn't re-compress on every request.
- **Gzip as fallback** for very old clients.
- **No compression on images** (already compressed) or small assets under 1KB (overhead outweighs savings).

### 6.6 HTTP caching for static assets

- **Immutable assets** (hashed filenames): `Cache-Control: public, max-age=31536000, immutable` — cached forever.
- **Mutable assets** (non-hashed, e.g. `index.html`): `Cache-Control: public, max-age=0, must-revalidate` — always revalidated.
- **API responses**: case-by-case (see §12).

All bundlers produce hashed filenames by default. Use them. Never deploy with mutable asset URLs.

---

## 7. Rendering performance

### 7.1 The 16ms frame budget

60fps means a frame every 16.67ms. 120Hz means 8.33ms. The browser needs to:
1. Run JS (event handlers, React updates)
2. Calculate styles
3. Lay out elements
4. Paint
5. Composite

All within the frame budget. Anything longer drops frames. Users notice at 3+ dropped frames.

**Rules:**
- Long tasks > 50ms block the main thread — break them up
- Synchronous work in event handlers must finish in < 100ms for responsive INP
- Animations use `transform` and `opacity` (compositor-only, no layout)

### 7.2 React render performance

The most common React performance bug: rendering way more than needed.

**Rules:**
- **Memoise pure, expensive components** with `memo`. Don't memoise cheap ones — `memo` has its own cost.
- **Move state down**. A `useState` at the root causes the whole tree to re-render on change. Push state to the smallest component that needs it.
- **Derive, don't duplicate**. Compute derived values during render or with `useMemo` — don't sync them into state with `useEffect`.
- **`useCallback` sparingly**. Only when passing callbacks to memoised children. Otherwise it's overhead without benefit.
- **Split heavy lists with virtualisation**. Lists > 200 items should use `react-window` or `@tanstack/react-virtual`.
- **`useTransition` for non-urgent state updates** — React can interrupt if a more-urgent update arrives.

```tsx
// ✗ expensive calculation on every render
function Dashboard({ orders }) {
  const total = orders.reduce((sum, o) => sum + computeTotal(o), 0);
  return <div>{total}</div>;
}

// ✓ memoised
function Dashboard({ orders }) {
  const total = useMemo(
    () => orders.reduce((sum, o) => sum + computeTotal(o), 0),
    [orders]
  );
  return <div>{total}</div>;
}
```

### 7.3 Avoid unnecessary state

Every piece of state triggers re-renders. Alternatives to state:

- **Refs** for values that don't drive the UI (timers, DOM references, mutable counters)
- **Derived values** computed during render, not stored
- **URL state** for things that should survive reload or be linkable (filters, search)
- **Context** for cross-tree values (theme, current user) — but note context re-renders all consumers

### 7.4 List rendering

Every list item should have a stable, unique `key`. Never use array index as key for lists that can reorder — it confuses React's reconciliation.

```tsx
// ✗
{items.map((item, i) => <Row key={i} item={item} />)}

// ✓
{items.map(item => <Row key={item.id} item={item} />)}
```

For long lists:
- **Virtualise** anything over ~200 items (`react-window`, `@tanstack/react-virtual`)
- **Paginate or infinite-scroll** anything over ~1000 backing items
- **Don't render what the user can't see** — a modal's children that are conditionally rendered inside `<Modal>` should only mount when the modal is open

### 7.5 Animations

Animations that stay on the compositor layer (not involving layout or paint) are free. Animations that trigger layout hurt.

**Cheap** (compositor-only):
- `transform: translate / scale / rotate`
- `opacity`
- `filter: blur / brightness / etc.`

**Expensive** (triggers layout or paint):
- `top` / `left` / `width` / `height` — use `transform` instead
- `color` / `background-color` — triggers paint, unavoidable
- Box shadows animating — expensive on large elements

**Rules:**
- Use CSS animations / transitions when possible; they can run on the compositor off-main-thread
- For JS-driven animation, use `requestAnimationFrame`, not `setTimeout`
- For complex animations, use Framer Motion or GSAP, not hand-rolled — they handle edge cases and batching

### 7.6 Forced reflows

The classic perf trap: reading a layout property forces the browser to flush pending layout calculations.

```js
// ✗ forced reflow in a loop
for (const el of elements) {
  el.style.width = el.offsetWidth + 10 + 'px';  // read-write-read-write...
}

// ✓ batch reads, then batch writes
const widths = elements.map(el => el.offsetWidth);
elements.forEach((el, i) => {
  el.style.width = widths[i] + 10 + 'px';
});
```

Reads: `offsetWidth`, `offsetHeight`, `getBoundingClientRect`, `scrollTop`, computed styles.
Writes: anything setting dimensions or position.

Never mix reads and writes in a loop.

### 7.7 Main-thread offloading

For genuinely heavy work (parsing large JSON, image processing, encryption, compression):

- **Web Workers** — move work off the main thread. Use Comlink for a simpler API.
- **OffscreenCanvas** — canvas rendering off the main thread.
- **WASM** — for hot loops, image codecs, crypto. Wins over JS when the work is measurably CPU-bound.

Don't reach for workers by default — the message-passing overhead kills the win for small tasks. Profile first.

---

## 8. Mobile constraints

Mobile is the default for most users. Design for it first; desktop is the "better" case.

### 8.1 The mobile baseline

Assumed device: mid-range Android, 2-3 years old:
- **CPU**: ~1/4 the performance of a high-end desktop
- **RAM**: 3-4GB, heavily shared with OS and other apps
- **Network**: intermittent 4G, variable latency
- **Battery**: every CPU cycle costs; screen-on time matters
- **Thermal throttling**: after a few seconds of heavy work, CPU clocks down

If your app works well here, it'll fly on everything else. If you only test on a MacBook Pro, you've been designing for the top 10% of users.

### 8.2 JavaScript on mobile

JS is 2-5x slower on mobile than desktop. Every 100ms of desktop JS is 200-500ms of mobile JS, blocking the main thread the whole time.

**Rules:**
- Bundle sizes matter **more** on mobile (parse time is CPU-bound)
- Long tasks feel worse (animation dropped frames, unresponsive taps)
- Hydration cost is much higher — minimise client components

### 8.3 Touch targets and interaction

- **Minimum 44×44 CSS pixels** for any tappable target (WCAG 2.5.8). See design guidelines mobile patterns.
- **300ms tap delay is gone** on modern browsers with proper viewport meta, but test — some older hybrid apps still have it.
- **Avoid hover-only UI** — touch devices have no hover. Hover reveals must also appear on tap or be non-essential.

### 8.4 Network assumptions

- **High latency** — RTT on mobile is often 100-300ms vs 10-30ms on broadband
- **Intermittent connectivity** — handle offline gracefully, queue writes, show connection state
- **Data caps** — every MB matters. Compress everything. Defer what you can.
- **Connection type detection** — use `navigator.connection` to adapt. On 2G/3G/slow-4G, serve lower-res images, defer non-critical requests, skip auto-playing video.

```js
// Adapt to network
const conn = navigator.connection;
if (conn?.saveData || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') {
  // Serve lower-fidelity experience
}
```

### 8.5 Memory

Mobile browsers kill tabs aggressively when memory is tight. Once killed, your users start over from scratch.

- **Don't accumulate state** — offload large datasets to IndexedDB when not actively needed
- **Clean up event listeners** in React's cleanup functions
- **Unmount heavy components** when not visible — don't just hide with CSS
- **Watch for memory leaks** — React DevTools Profiler has a memory tab; Chrome's Memory panel has heap snapshots

### 8.6 Battery

Battery-draining patterns:
- Polling loops with short intervals (use WebSockets / SSE instead)
- Geolocation in watch mode (use it sparingly)
- Constantly-running animations (pause when not visible: `IntersectionObserver`)
- Wake locks held longer than needed

Use the **Page Visibility API** to pause work when the tab isn't visible:

```js
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pausePolling();
    pauseAnimations();
  } else {
    resumePolling();
    resumeAnimations();
  }
});
```

### 8.7 Testing on real devices

Chrome DevTools mobile emulation is useful but lies about CPU throttling and network. For real testing:

- **WebPageTest** — free, runs on real mobile devices in various regions
- **BrowserStack / Sauce Labs** — paid, broader device coverage
- **Actual devices** — keep a cheap Android phone around for real testing. Not optional.

Lighthouse CI's mobile preset uses 4x CPU throttling and 150ms RTT — a reasonable mid-range baseline. Use it to catch regressions.

### 8.8 iOS Safari specifics

Safari has quirks worth knowing:

- **Autoplay restrictions** — video won't autoplay without `muted` attribute
- **100vh bug** — full-height elements extend under the URL bar; use `100dvh` (dynamic viewport height) instead
- **Focused input zoom** — any `<input>` with `font-size < 16px` triggers a zoom on focus; always 16px minimum
- **Scroll behaviour** — `overflow: auto` has different inertia than other browsers; test on real devices
- **Date / time inputs** — native picker is different from Chrome; don't assume UI consistency

### 8.9 Mobile web vs native

Mobile web is the right default for B2B tools. Users hit your URL from email, they don't install apps. But:

- For power users who use it daily: consider a PWA with installability (adds home-screen icon, offline, push notifications)
- For consumer-grade frequency: native app is often worth the investment, but not before PMF

---

## 9. Network strategy

### 9.1 HTTP/2 and HTTP/3

Both are table stakes in 2026. Multiplexing, header compression, server push (H/2 only; deprecated in H/3 for the `103 Early Hints` pattern). Your CDN handles this — verify it's enabled.

### 9.2 Connection reuse

Each new HTTPS connection is a DNS lookup + TCP handshake + TLS handshake — often 300-500ms on mobile. Reuse connections aggressively:

- **Same origin for API and assets** where possible — one connection serves everything
- **preconnect** for origins you know you'll hit (§4.8)
- **Keep-alive** on backend HTTP clients — reuse sockets instead of reconnecting per request

### 9.3 Request batching and deduplication

Multiple parallel requests for the same data are wasteful. Dedupe at the client layer.

React Query / SWR / TanStack Query handle this natively: two components asking for the same resource share one in-flight request.

```tsx
// Both components trigger one fetch, share the result
function RecordName({ id }) {
  const { data } = useRecord(id);  // react-query
  return <span>{data?.name}</span>;
}
function RecordStatus({ id }) {
  const { data } = useRecord(id);  // deduped
  return <Badge>{data?.status}</Badge>;
}
```

For server-side batching (combining multiple backend calls into one), see GraphQL or BFF patterns — but those add complexity you usually don't need. Client-side dedup covers 80%.

### 9.4 Pagination on the wire

Always cursor-paginated (see architecture §5.6 and API performance below). For UX:

- **Infinite scroll** for browse-style pages (feed, search results)
- **Explicit pagination** for analytical tables where the user wants to navigate
- **Prefetch the next page** when the user is near the end — pre-warms the cache

### 9.5 WebSockets and SSE

For real-time data:

- **Server-Sent Events (SSE)** — simpler, unidirectional. Great for push notifications, live activity feeds, streaming AI responses.
- **WebSockets** — bidirectional, lower overhead for frequent messages. Use for collaborative editing, live chat, real-time dashboards.
- **Polling as a last resort** — adaptive polling (back off when no changes) if you can't deploy WS/SSE.

**Rules:**
- Reconnect with exponential backoff + jitter
- Heartbeat every 30s to detect dead connections
- Handle offline gracefully (queue messages, sync on reconnect)
- Scope subscriptions tightly (not "all tenant events" — "this record's events")

### 9.6 GraphQL (if used)

Not a default — see architecture §5.1. If used:

- **Batching and dedup** at the client (Apollo, urql, Relay all support this)
- **Field selection discipline** — don't over-fetch because "the component might need it"
- **Persisted queries** — pre-register queries at build time; runtime sends only the ID, not the full query (smaller requests, faster parsing, security gate)
- **Avoid N+1 with DataLoader** — always. Every GraphQL resolver touching DB uses DataLoader.

---

## 10. API performance

### 10.1 The N+1 query trap

The single most common backend perf bug. Loading a list, then making one DB call per item:

```ts
// ✗ N+1: 1 query for records + N queries for each one's attachments
const records = await db.record.findMany({ where: { tenantId } });
for (const r of records) {
  r.attachments = await db.attachment.findMany({ where: { recordId: r.id } });
}

// ✓ 2 queries total
const records = await db.record.findMany({
  where: { tenantId },
  include: { attachments: true },
});
```

**Rules:**
- Prisma `include` / `select` for related data in one query
- SQL `JOIN` when raw — never loop-and-fetch
- For REST endpoints: use a "expand" or similar query param pattern for embedded related resources, but fetch them in one query on the backend
- For GraphQL: DataLoader, always

**Detection:**
- Watch DB query logs in development — if one HTTP request fires 50 queries, you have an N+1
- Tools: `prisma-erd-generator`, `express-prisma-query-count` middleware, observability tags

### 10.2 Pagination

Covered in architecture §5.6. Summary: cursor-based, never offset-based. Offset pagination is O(N) on the database and breaks under concurrent writes.

### 10.3 Response shape discipline

Every byte in the response is a byte the client downloads, parses, and processes. Don't send data the client doesn't use.

- **Select only needed fields** — Prisma `select`, SQL explicit columns. Never `SELECT *` in production paths.
- **Don't leak internal IDs** users don't care about (auto-increment bigints, legacy FKs)
- **Don't leak denormalised data** that blows up response size (embedded full-user objects on every row when all you need is `userId` and `userName`)
- **Compress at the HTTP layer** — every response > 1KB passes through gzip/brotli

Typical slim list response:

```json
{
  "data": [
    { "id": "01H...", "name": "Acme Corp", "status": "verified", "createdAt": "2026-01-15T10:30:00Z" }
  ],
  "pagination": { "nextCursor": "eyJ...", "hasMore": true }
}
```

Not:

```json
{
  "data": [
    {
      "id": "01H...",
      "name": "Acme Corp",
      "status": "verified",
      "createdAt": "...",
      "updatedAt": "...",
      "deletedAt": null,
      "createdBy": { "id": "...", "email": "...", "name": "...", "avatarUrl": "..." },
      "tenant": { "id": "...", "name": "...", "plan": "...", "createdAt": "..." },
      "credentials": [ ... 12 of these each with full metadata ... ],
      // ... 40 more fields
    }
  ]
}
```

### 10.4 Connection pooling

Database connections are expensive to establish. Pool them.

- **Node + Prisma**: single Prisma client with pool (default 10, tune per load)
- **Python + asyncpg**: connection pool per process, typically 10-20 per worker
- **Don't create a new client per request** — connection setup is 10-50ms

For serverless: connection pooling is harder (every cold start is a new pool). Use **PgBouncer in transaction mode** as a shared pool, or a connection-pooling proxy like Neon / Supabase's pooler.

See architecture §6.11 for Postgres specifics.

### 10.5 Query timeouts

Every database query has a timeout. No exceptions.

```ts
// Prisma
const db = new PrismaClient({
  // ...
  transactionOptions: {
    timeout: 15_000,  // 15s max transaction
  },
});

// Per-query timeout via pg
const conn = await pool.connect();
await conn.query(`SET statement_timeout TO ${queryTimeoutMs}`);
```

Rationale: a query that never returns holds the connection, which backs up the pool, which causes every other request to wait. One slow query at 3am takes down the whole service. Timeout and fail fast.

### 10.6 Batch endpoints for bulk operations

One endpoint that does 100 things > 100 separate endpoint calls:

```
POST /api/v1/records/bulk-verify
{ "recordIds": ["01H...", "01H...", ...] }
```

Rules:
- Cap at 100 items per batch (prevents abuse)
- Return per-item results (which succeeded, which failed, why)
- Transactional within the batch when possible
- Idempotency keys per batch, not per item

### 10.7 Write amplification

A single user action that writes to 10 tables means 10 queries, 10 transaction participants, 10 audit log entries. Common, often necessary, but expensive.

- **Batch writes** where possible — `createMany` in Prisma, `INSERT ... VALUES ((), (), ())` in SQL
- **Defer non-critical writes** to async jobs (audit enrichment, denormalisation)
- **Question every side effect** — does this write happen on every call, or only in specific cases?

### 10.8 Rate limiting

Covered in security §5 and architecture §5.10. Rate limits are both a security and a performance control — they protect the server from overload, not just from abuse.

---

## 11. Database performance

### 11.1 Every query hits an index

Non-negotiable. Any query that performs a sequential scan on a table with > 1000 rows is a bug. Verify with `EXPLAIN`.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM records.records
WHERE tenant_id = '01H...' AND status = 'verified'
ORDER BY created_at DESC
LIMIT 25;
```

Look for:
- `Index Scan` or `Index Only Scan` — good
- `Seq Scan` — bad (on large tables)
- `Rows Removed by Filter` — indicates the index isn't covering the filter

### 11.2 Composite index column ordering

Covered in architecture §6.6. Summary: leading column is the most selective equality filter (usually `tenant_id`), range/sort columns last.

Right:
```sql
CREATE INDEX idx_records_tenant_status_created
ON records.records (tenant_id, status, created_at DESC);
```

Wrong:
```sql
CREATE INDEX idx_records_created_status_tenant
ON records.records (created_at DESC, status, tenant_id);
```

The right one serves queries filtering by tenant and status, sorted by date. The wrong one serves none efficiently.

### 11.3 Covering indexes

When a query's SELECT list is small and stable, include those columns in the index so the index itself answers the query (no table lookup needed):

```sql
-- For frequent "list records by status showing name" queries:
CREATE INDEX idx_records_cover
ON records.records (tenant_id, status)
INCLUDE (id, name, created_at);
```

This is an **Index Only Scan** — the fastest thing Postgres can do.

### 11.4 Partial indexes

For filtered queries, partial indexes shrink the index size and improve hit rates:

```sql
-- Only index non-deleted rows, since every query filters deleted_at IS NULL
CREATE INDEX idx_records_active
ON records.records (tenant_id, status, created_at DESC)
WHERE deleted_at IS NULL;

-- Index only pending items, the small subset users query often
CREATE INDEX idx_records_pending
ON records.records (tenant_id, created_at DESC)
WHERE status = 'pending';
```

Partial indexes are usually 5-20x smaller than full indexes, with the same hit rate for the filtered query.

### 11.5 Index hygiene

Indexes are not free:
- Every write (INSERT / UPDATE / DELETE) updates every affected index
- Indexes consume disk space
- Indexes sit in the buffer cache, competing with table pages

**Rules:**
- Drop unused indexes quarterly. Check with `pg_stat_user_indexes` — indexes with `idx_scan = 0` aren't being used.
- Don't over-index — every index is a write-time cost. Aim for the minimum set that covers your queries.
- Create indexes `CONCURRENTLY` in production migrations (architecture §6.10).

### 11.6 Slow query log

Enable and monitor:

```sql
ALTER SYSTEM SET log_min_duration_statement = 100;  -- log queries > 100ms
ALTER SYSTEM SET log_statement = 'none';
ALTER SYSTEM SET log_duration = off;
SELECT pg_reload_conf();
```

Dev: 50ms threshold. Staging: 100ms. Production: 500ms (any slower query is investigated).

`pg_stat_statements` extension tracks aggregate query performance. Enable it:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

Query for slowest queries over time:

```sql
SELECT
  substring(query, 1, 100) AS short_query,
  round(mean_exec_time::numeric, 2) AS avg_ms,
  calls,
  round(total_exec_time::numeric, 2) AS total_ms
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

The top of this list is where perf work should focus.

### 11.7 EXPLAIN ANALYZE every production query

Before a new query hits production:

1. Run `EXPLAIN (ANALYZE, BUFFERS)` against production-size data
2. Check for Sequential Scans on large tables
3. Check for sort operations on large result sets
4. Check buffer hit ratio
5. Check estimated vs actual row counts (bad estimates mean stale stats)

`EXPLAIN` on 100 rows lies. Always test against realistic data volumes. Keep an anonymised production snapshot for this purpose.

### 11.8 JSONB performance

JSONB columns are flexible but can be slow. Rules:

- **Index paths you query often** — GIN indexes on the whole JSONB or expression indexes on specific paths
- **Don't use JSONB for queryable structured data** — if you filter / sort on a field, make it a column
- **Keep JSONB size reasonable** — < 100KB per row typically. Larger is a redesign hint.

```sql
-- Index the whole JSONB for containment queries
CREATE INDEX idx_settings_gin ON tenants.tenants USING GIN (settings);

-- Index a specific path for equality
CREATE INDEX idx_settings_plan ON tenants.tenants ((settings->>'plan'));
```

### 11.9 Transactions

Keep them short. A transaction holds locks; the longer held, the more contention.

**Rules:**
- Don't make external HTTP calls inside a transaction — API latency blocks the lock
- Don't do heavy computation inside a transaction — compute first, transact last
- Don't hold transactions across user interaction — never "open transaction, show dialog, commit on submit"

```ts
// ✗ long-held transaction
await db.$transaction(async (tx) => {
  const record = await tx.record.create({ data: input });
  await emailProvider.send({ to: record.email });  // slow external call
  await tx.auditLog.create({ data: { ... } });
});

// ✓ transaction minimal, email deferred
const record = await db.$transaction(async (tx) => {
  const r = await tx.record.create({ data: input });
  await tx.auditLog.create({ data: { ... } });
  await tx.outbox.create({ data: { event: 'record.created', recordId: r.id } });
  return r;
});
// outbox worker picks up the email send asynchronously
```

### 11.10 Lock contention

Postgres has row-level locks for UPDATE / DELETE. Contention happens when:

- Many concurrent updates to the same row (a hot counter)
- Long-held advisory locks
- Serialisable isolation where queries conflict

Fixes:
- **Don't increment counters synchronously** — use background aggregation or Redis counters, periodically synced
- **Use `SELECT ... FOR UPDATE SKIP LOCKED`** for work-queue-style patterns in SQL (jobs pulling work without blocking each other)
- **Set lock timeouts** to fail fast rather than wait forever:
  ```sql
  SET lock_timeout = '5s';
  ```

### 11.11 Vacuum and bloat

Postgres MVCC means deleted / updated rows stay on disk as dead tuples until vacuumed. Heavy write workloads produce bloat — tables grow larger than their live data.

- **Autovacuum is on by default** — verify it's not disabled
- **Tune `autovacuum_vacuum_scale_factor`** for high-write tables (default 0.2 = 20% bloat before vacuum; tune down for busy tables)
- **Monitor bloat** via `pg_stat_user_tables` or pgstattuple extension
- **Run VACUUM ANALYZE manually after bulk operations** — migrations, backfills, large deletes

### 11.12 Read replicas

When a single Postgres can't keep up with read traffic, add a replica.

- Use for: analytical queries, reporting, search, cross-tenant scans
- Don't use for: reads that must be fresh (replication lag is typically 10-100ms, sometimes seconds)
- Route queries explicitly — don't let "auto-routing" ORMs decide; they get it wrong

Before adding a replica, check: is the primary actually CPU-bound, or could you fix the hottest queries and buy another 6 months?

---

## 12. Caching

Caching is the most powerful perf tool and the most dangerous — stale caches are a bug factory.

### 12.1 Only cache what measurably matters

Don't cache because "caching is good". Cache because the profile shows a hot spot.

Pre-caching checklist:
1. Is this path measurably slow?
2. Is the data idempotent or safe to be stale?
3. What's the cache invalidation strategy?
4. What happens when the cache is cold?

If you can't answer all four, you're not ready to cache.

### Decision tree: should this be cached?

Use this before adding any cache layer. Caching adds invalidation complexity — only do it when there's a measurable benefit.

```
Is this data read significantly more often than it changes?
  └─ No (write-heavy) → Don't cache. Invalidation cost outweighs benefit.
  └─ Yes → Continue ↓

Is the computation or query expensive (> 50ms)?
  └─ No (fast query, simple computation) → Don't cache unless traffic is very high.
  └─ Yes → Continue ↓

Can you tolerate stale data for some period of time?
  └─ No (financial balances, live inventory, permission checks) → Don't cache, or cache with TTL ≤ 5 seconds.
  └─ Yes (dashboards, analytics, user profiles) → Continue ↓

Is the data scoped to a single user/tenant, or shared across many?
  └─ Single user/tenant → Cache per-tenant with tenant ID in the cache key.
  └─ Shared → Cache globally. High impact. Confirm invalidation strategy before proceeding.

→ ✓ Cache this. Document: cache key structure, TTL, and invalidation trigger.
```

**Cache key structure rules:**
```
// Always scope to tenant + version to prevent cross-tenant data leaks
const key = `${tenantId}:${resource}:${id}:v${CACHE_VERSION}`;

// Examples
"t_abc123:project:proj_456:v3"         // tenant-scoped
"global:plan_limits:v2"                 // global, versioned
"t_abc123:user:usr_789:permissions:v1"  // permissions — short TTL
```

**TTL guide:**

| Data type | Recommended TTL | Invalidation trigger |
|---|---|---|
| Permission checks | 30–60 seconds | Role/permission change event |
| User profile | 5 minutes | Profile update event |
| Dashboard aggregates | 5–15 minutes | Underlying data write |
| Plan/billing limits | 1 hour | Billing event |
| Static reference data | 24 hours | Admin update |
| AI-generated content | Until explicitly invalidated | User requests refresh |

**Never cache:**
- Authentication tokens (managed by auth provider)
- Active session state (use Redis sessions, not application cache)
- Financial transaction records
- Anything containing raw PII without explicit DPA review

### 12.2 Caching layers

| Layer | Use | TTL |
|---|---|---|
| Browser HTTP cache | Static assets (hashed) | Forever (`max-age=31536000, immutable`) |
| Browser HTTP cache | HTML, API responses | Short or revalidate (`max-age=0, must-revalidate`) |
| CDN (CDN, Fastly) | Static, semi-dynamic pages | Minutes to hours |
| Edge runtime (ISR) | Personalised-per-region | Minutes |
| Application memory (Node `LRU-cache`) | Per-process hot data | Seconds to minutes |
| Redis (application cache) | Shared hot data | Seconds to hours |
| Database buffer cache | Postgres page cache | Auto |

Each layer has different invalidation characteristics. Pick the right one for the data.

### 12.3 Cache-aside pattern

The default pattern:

```ts
async function getRecord(id: string): Promise<Record | null> {
  const cached = await redis.get(`record:${id}`);
  if (cached) return JSON.parse(cached);

  const record = await db.record.findUnique({ where: { id } });
  if (record) {
    await redis.set(`record:${id}`, JSON.stringify(record), 'EX', 300);  // 5min TTL
  }
  return record;
}
```

**Rules:**
- Always have a TTL — infinite caches leak memory and serve stale data
- Invalidate on write (`redis.del`) — belt and braces with TTL
- Never cache PII or sensitive fields at a shared layer — tenant-scoped keys at minimum
- Key includes tenant ID — `tenant:{tenantId}:record:{id}` — catches tenant-leakage bugs

### 12.4 Cache stampedes

When a hot cache key expires, 1000 concurrent requests all miss and hammer the database simultaneously. Defences:

- **Request coalescing** — if a miss is already in flight, other requests wait on it
  ```ts
  const singleflight = new Map();
  async function getWithCoalescing(key, fetchFn) {
    if (singleflight.has(key)) return singleflight.get(key);
    const promise = fetchFn();
    singleflight.set(key, promise);
    try { return await promise; }
    finally { singleflight.delete(key); }
  }
  ```
- **Probabilistic early expiry** — refresh cache before it expires, spread across time
- **Soft TTL + hard TTL** — soft miss triggers background refresh while serving stale; hard miss requires fresh

### 12.5 Invalidation strategies

"There are only two hard things in computer science: cache invalidation and naming things."

Patterns:

1. **TTL only** — simplest; data can be stale up to TTL. Fine for read-heavy, write-rare data.
2. **Write-through** — update cache when the DB updates. Keeps in sync but adds latency to writes.
3. **Write-back** — writes go to cache, flushed to DB async. Risky; data can be lost.
4. **Event-driven invalidation** — DB write triggers an event, cache consumers delete their entries. Handles distributed cases.

For most cases: **TTL + explicit invalidation on write from the same service**. Cross-service invalidation via the outbox / event bus when needed.

### 12.6 HTTP caching for APIs

```
Cache-Control: private, max-age=60
ETag: "abc123"
Last-Modified: Tue, 17 Apr 2026 10:00:00 GMT
```

- `private` — browser caches, CDN doesn't (for authenticated responses)
- `public` — both cache (for truly public content)
- `max-age` — seconds to cache
- `ETag` / `If-None-Match` — conditional request, server returns 304 if unchanged
- `stale-while-revalidate` — serve stale while fetching fresh in background (great for non-critical freshness)

```
Cache-Control: private, max-age=0, stale-while-revalidate=60
```

This serves cached for free, revalidates on next request, serves stale for up to 60s if revalidation fails. Strong default for authenticated API reads.

### 12.7 CDN caching

Static assets: cache at CDN forever (hashed filenames prevent stale).

For dynamic content: use CDN with short TTL (e.g., 30s) and surrogate keys for targeted invalidation:

```
Cache-Control: public, max-age=30
Surrogate-Key: record-01H... tenant-01H...
```

On record update, purge `record-01H...` at the CDN level. All cached responses tagged with that key get invalidated.

CDN, Fastly, and hosting provider all support surrogate / cache-tag patterns.

### 12.8 Client-side query caching

React Query / SWR / TanStack Query caches API responses in memory by default. Configure for:

- **`staleTime`** — how long data is considered fresh (no refetch)
- **`cacheTime` / `gcTime`** — how long unused data stays in memory
- **Refetch on window focus** — on by default; turn off for expensive queries
- **Optimistic updates** — write to cache immediately, reconcile with server response

```tsx
const { data } = useQuery({
  queryKey: ['record', id],
  queryFn: () => fetchRecord(id),
  staleTime: 60_000,      // 60s fresh
  gcTime: 5 * 60_000,     // keep 5min after unmount
});
```

### 12.9 Caching AI responses

AI calls are expensive ($) and slow. Cache aggressively when the prompt is deterministic:

- **Cache by prompt hash + model + temp** — if the inputs are identical, serve cached
- **Scope per tenant** — cross-tenant cache hits leak data
- **Short TTL** for context-dependent prompts (hours); longer for truly static (classification of fixed enums)
- **Don't cache** high-variance, time-sensitive, or per-user personalised outputs

See AI performance (§14) for more.

---

## 13. Async and background work

Covered in architecture §7. Performance-specific notes here:

### 13.1 If it can be async, it should be

Any operation > 200ms that a user is blocking on should consider becoming async with a job record + polling / webhook pattern. Covered extensively in architecture §7.

The exception: operations where the response value is needed immediately (e.g., the ID of the thing just created). Those stay sync, but the *side effects* (emails, webhooks, notifications) go async.

### 13.2 Job batching

Instead of one job per item:

```ts
// ✗ one job per user notification
for (const user of users) {
  await queue.add('notify', { userId: user.id });
}

// ✓ one job per batch
await queue.add('notify-batch', { userIds: users.map(u => u.id) });
```

Tradeoffs: batches are faster but retry behaviour changes (whole batch retries vs individual). Choose per-case.

### 13.3 Worker concurrency

BullMQ workers have a concurrency setting — how many jobs they process in parallel:

```ts
new Worker('emails', processor, { concurrency: 10 });
```

**Rules:**
- Start with 10; tune based on downstream bottleneck (usually DB pool or external API)
- Separate worker pools per job type — a slow AI job shouldn't starve the email queue
- Monitor queue depth — if it grows unboundedly, scale workers or rate-limit producers

### 13.4 Job priority

Most queues support priorities. Use sparingly:

- User-facing: higher priority
- Background (daily reports, aggregations): lower priority
- Retries: original priority, not "retry priority"

Too many priority levels is complexity without value. Two (high / normal) is usually enough.

---

## 14. AI performance

AI has different performance characteristics from traditional code:
- Latency varies wildly (1s to 60s)
- Cost per call is non-trivial
- Caching is partial (semantic similarity, not exact match)
- Output quality varies with model, prompt, temperature

### 14.1 All AI work is async (reminder)

Already in architecture §11.2. Never block an HTTP handler on an AI call. Always queue.

### 14.2 Streaming

For user-facing AI output, stream tokens as they arrive — perceived latency is far better even if total time is identical:

```ts
// Server — stream tokens from the LLM to the client
for await (const chunk of anthropic.messages.stream(request)) {
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
}
```

Use SSE (`Content-Type: text/event-stream`) for streaming. WebSockets are fine too; SSE is simpler.

Frontend renders tokens as they arrive. For React, use a ref-backed text buffer to avoid re-rendering on every token.

### 14.3 Model selection by latency / cost

Not every AI call needs the largest model. Tiered approach:

| Task | Model tier |
|---|---|
| Classification, simple extraction | Small / fast (Haiku, Gemini Flash) |
| Summary, rewriting, coding | Medium (Sonnet, GPT-4o) |
| Complex reasoning, long context | Largest (Opus, o1) |

Fallback pattern:

```ts
try {
  return await callModel('large', prompt, { timeoutMs: 30_000 });
} catch (e) {
  if (e.code === 'TIMEOUT' || e.code === 'RATE_LIMITED') {
    return await callModel('medium', prompt, { timeoutMs: 20_000 });
  }
  throw e;
}
```

### 14.4 Prompt caching

Modern LLM APIs support prompt caching — repeated prefixes (system prompts, few-shot examples, long context) are cached server-side at the provider, cutting latency and cost.

- **Structure prompts with cache-friendly prefixes** — static context first, dynamic user input last
- **Use the provider's cache flag** where supported (Anthropic's `cache_control`)
- Savings: often 50-90% cost reduction on the cached portion, 30-80% latency reduction

### 14.5 Semantic caching

For queries that are similar-but-not-identical, a vector-similarity cache beats exact-match:

1. Hash query → embed → search cache for similar embeddings
2. If similarity > threshold (e.g., 0.95), return cached response
3. Otherwise, call LLM, cache result

This is non-trivial — maintain a cache DB, embed on every query. Use when cost savings justify the complexity (high-volume, common queries).

### 14.6 Batching

If multiple items need similar AI processing, batch them into one prompt:

```ts
// ✗ 100 AI calls
const scored = await Promise.all(items.map(item =>
  llm.score(buildPrompt(item))
));

// ✓ 1 AI call for 10-20 items
const batched = chunk(items, 20);
const scored = (await Promise.all(batched.map(batch =>
  llm.scoreBatch(buildBatchPrompt(batch))
))).flat();
```

Tradeoff: larger context = slightly more cost per call but far fewer calls. Usually a net win.

### 14.7 Token budget per tenant

Covered in security §14.4. Performance angle: a runaway AI loop can burn $1000 in an hour. Per-tenant daily caps prevent this.

---

## 15. Observability for performance

Can't optimise what you don't see.

### 15.1 Real-time dashboards

Essential dashboards, available to the team always:

1. **Frontend RUM** — CWV percentiles by route, device, geography
2. **API latency** — p50/p95/p99 per route
3. **Database** — slow query list, connection pool saturation, cache hit ratios
4. **Queues** — depth, processing time, DLQ entries
5. **AI** — latency, cost, token usage per tenant
6. **Errors** — 5xx rate, 4xx rate, unhandled exceptions

Dashboards are grafana / monitoring tool / dashboard tool Cloud. Make them visible — a TV in the office, a team chat channel posting daily snapshots, whatever works.

### 15.2 SLOs and error budgets

For each user-facing surface:

- **SLI** (Service Level Indicator): measurable signal (p95 latency, error rate, availability)
- **SLO** (Service Level Objective): target for the SLI (99.9% availability, p95 < 300ms)
- **Error budget**: the allowed deviation from SLO (0.1% = 43 minutes/month of downtime)

When error budget is exhausted for the quarter, stop shipping features and focus on reliability. This is how you prevent "we'll fix it later" from becoming "we never fix it".

Start simple: one SLO per surface. "Login p95 < 500ms. Login success rate > 99.5%." Add more as needed.

### 15.3 Alerts on performance regressions

Covered in §2.6. Specific alert examples:

- p95 latency on any route > budget for 5 minutes
- CWV regression > 10% on any route for 24h
- Queue depth > threshold for 10 minutes
- Error rate > 1% for 5 minutes
- Slow query log entries > 100/hour

Alert fatigue is the enemy. Fewer, better alerts that are always actionable.

### 15.4 Weekly perf review

Dedicate 30 minutes per week to perf review:

1. What regressed this week? Why?
2. What's the slowest thing in production right now?
3. Are any SLOs approaching budget?
4. Any surprising entries in the slow-query log?
5. What's the biggest unresolved perf issue?

This is not a meeting with stakeholders — it's engineering hygiene. 30 minutes prevents weeks of cleanup.

### 15.5 Flamegraphs in production

Continuous profiling tools (Pyroscope, Parca, monitoring tool Continuous Profiler) sample running processes and build flamegraphs from real traffic. Invaluable when "profile it locally" doesn't reproduce.

At larger scale this is worth the setup. At small scale, on-demand profiling is enough.

---

## 16. Performance review process

Performance isn't a one-off project — it's a discipline.

### 16.1 When to invest in performance

- **Before launch** — establish budgets, hit CWV targets
- **When users complain** — listen. Perception of slowness is real even if metrics look fine.
- **When budgets are breached** — CI or production alerts
- **Before scale milestones** — if you expect 10x traffic, prove the system can handle it before it arrives
- **Quarterly** — bundle audit, slow query review, dependency audit

### 16.2 Performance as part of PR review

See the pre-ship checklist (§18). Performance considerations in every review:

- Does this add to bundle size? By how much?
- Does this add new queries? Indexed?
- Does this add synchronous external calls to hot paths?
- Does this add unbounded loops, recursion, or collection growth?

### 16.3 Load testing

Before shipping something with traffic assumptions:

- Write a load test scenario (k6, Artillery, Locust)
- Run against staging at expected peak traffic + 50%
- Observe: error rate, latency, resource saturation
- Fix anything that breaks before going live

Load tests aren't a one-off — make them repeatable and run regularly (weekly or per-release).

### 16.4 Performance regressions are bugs

When performance regresses, file a bug. Assign it. Track it to resolution. "It got 200ms slower but still works" is a bug with a countdown timer — left unfixed, it compounds.

---

## 17. Anti-patterns

Things that look fast and aren't.

### 17.1 Over-caching

Symptom: every DB call wrapped in Redis, cache invalidation scattered everywhere, hard to reason about staleness.

Reality: caching adds complexity. Only cache paths that are measurably slow AND safe to stale.

### 17.2 Micro-optimising in hot loops that aren't hot

Symptom: `++i` instead of `i++`, replacing `map` with for-loops in places that run 10 times.

Reality: profile first. The 10-iteration loop doesn't matter. The thousands-of-renders component does.

### 17.3 "It's fine in dev"

Symptom: everything's fast on localhost with 10 rows of test data.

Reality: performance problems scale with data. Test against production-size data, on production-representative hardware. Otherwise you're measuring your laptop, not your product.

### 17.4 Bundle.min.js "optimisation"

Symptom: shipping a 3MB bundle and blaming the network.

Reality: the problem is what's in the bundle, not how it's compressed. Analyse, split, remove.

### 17.5 "We'll add the index later"

Symptom: shipping a query that does a seq scan because "the table is small now".

Reality: tables grow. Add the index in the same migration as the query. Indexes are cheap; missing indexes at 10M rows are catastrophic.

### 17.6 Loops of network calls

Symptom: "for each item, call the API".

Reality: batch. If the API doesn't support batching, fix the API. N×RTT is the single cheapest thing to fix and the single most common perf bug.

### 17.7 The "we have a CDN" excuse

Symptom: the app is slow. "But we have a CDN, so it's fine."

Reality: CDN fixes static asset distribution, not your 800KB JS bundle or your 2s API call. CDNs help but don't absolve architecture choices.

### 17.8 Hot loops with async/await

Symptom: `for (const x of huge) { await doThing(x); }` sequentially.

Reality: this is sequential, not parallel. Use `Promise.all` (if no dependencies), `p-map` (for concurrency-limited parallelism), or `for await` streams for ordered processing.

```ts
// ✗ sequential, slow
for (const id of ids) {
  await process(id);
}

// ✓ parallel with concurrency limit
import pMap from 'p-map';
await pMap(ids, process, { concurrency: 10 });
```

### 17.9 Forgotten cache keys with user data

Symptom: cache key is `/api/orders` — everyone's orders, one cache entry.

Reality: cache keys include tenant, user, query params. `/api/orders:tenant_01H:user_01H:cursor_X`. Shared cache keys are a data-leak bug.

### 17.10 Polling for real-time

Symptom: client polls every 5s "just in case something changed".

Reality: 99% of polls return nothing. Massive waste of client battery, server CPU, bandwidth. Use SSE or WebSockets for push.

### 17.11 Lazy loading the first thing the user sees

Symptom: hero image, above-the-fold — `loading="lazy"`.

Reality: lazy-load delays the most important render. Eager-load above-the-fold, lazy-load below-the-fold.

### 17.12 Synchronous layout in animations

Symptom: animating `width` / `top` / `margin-left`, jerky on mobile.

Reality: use `transform` and `opacity` only. Anything else triggers layout / paint per frame.

---

## 18. Pre-ship checklist

Before merging any PR that could affect performance:

### Frontend

- [ ] Bundle analyser run — no unexpected bloat
- [ ] Lighthouse CI passes — CWV green on affected routes
- [ ] Images: next-gen format, lazy-loaded below fold, explicit dimensions
- [ ] No render-blocking third-party scripts added on critical path
- [ ] Heavy components lazy-loaded or behind interaction
- [ ] No new CSS-in-JS runtime added to critical render
- [ ] Animations use transform/opacity only
- [ ] New state is scoped to the smallest component that needs it
- [ ] Lists with > 200 items virtualised
- [ ] No `localStorage` / synchronous storage calls in event handlers

### API

- [ ] New endpoints have p95 budget met under load test
- [ ] No N+1 queries (verified in DB log)
- [ ] Response shape is lean — only necessary fields
- [ ] Pagination is cursor-based
- [ ] New DB queries `EXPLAIN`d against prod-sized data
- [ ] External calls have timeouts
- [ ] Slow operations (> 1s) moved to async jobs

### Database

- [ ] New queries hit an index — verified with EXPLAIN
- [ ] Composite index column order is correct
- [ ] Indexes created `CONCURRENTLY` in the migration
- [ ] No new unbounded-size JSONB fields
- [ ] Transactions kept short; no external calls inside
- [ ] Unused indexes removed

### Caching

- [ ] Caches have TTLs
- [ ] Cache keys scoped to tenant / user where appropriate
- [ ] Invalidation strategy documented
- [ ] Cold-start behaviour acceptable

### Mobile

- [ ] Tested on real mid-range Android device OR Lighthouse mobile profile
- [ ] Tap targets ≥ 44×44
- [ ] Inputs ≥ 16px font-size (no iOS zoom)
- [ ] Works on slow-4G emulation
- [ ] Visible on small screens (320px width)
- [ ] Safe-area insets respected

### AI (if applicable)

- [ ] AI calls are async (never blocking HTTP)
- [ ] Streaming used for user-facing AI output
- [ ] Model selection appropriate for the task's latency/cost budget
- [ ] Prompt structured for cache-friendly prefixes
- [ ] Per-tenant token budget enforced
- [ ] Fallback model / graceful degradation on failure

### Observability

- [ ] New routes emit latency metrics
- [ ] New queries emit query metrics
- [ ] New background jobs emit duration / error metrics
- [ ] Alerts configured for new critical paths

If every box is ticked: ship. If any are unticked: fix before merge.

---

*End of document. Changes require a version bump in the header. Budget changes require an ADR. Performance standards are audited quarterly — the doc evolves with the state of the web and the product's needs.*
