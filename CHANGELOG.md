# Karta — Changelog

## v0.3.0 — 2026-04-15

### Portfolio History & Test Suite

**History tracking (local-only, zero backend)**
- Daily portfolio value snapshots recorded every weekday after a refresh (`ph_history`, max 365 entries)
- Portfolio change events captured on every add, remove, or share-count update (`ph_events`, rolling 1-year window)
- Both stored in `localStorage` — nothing leaves the device

**New History tab**
- SVG line chart showing portfolio total value over up to 1 year
- Color-coded event markers on the chart (green = add, red = remove, yellow = mixed day)
- Separate hover behavior: event bubbles show portfolio changes; line hover shows value and daily % change
- Summary stat cards: current value, % change since first record, tracking start date, days recorded
- Portfolio Changes log listing all events newest-first
- "Load demo data" button to preview the chart with seeded data
- "Clear all history data" to reset

**Code quality**
- Extracted `computeTreemap`, `perfColor`, `IS_DEMO` to `src/utils.js`
- Added `applySnapshot` and `applyEvent` pure helpers for history mutations
- 53 automated tests (Vitest + Testing Library): 28 unit tests for pure functions and storage logic, 25 integration tests for the App component
- Run with `npm run test:run` before pushing

---

## v0.2.0 — 2026-04-11

### Landing Page & UX Polish

- Animated landing page: floating heatmap tiles, ticker tape, scroll-reveal sections
- Mobile-responsive layout for both the landing page and the app
- Shared key notice in the Setup tab encouraging users to get their own Finnhub key
- Buy Me a Coffee and GitHub links wired up

---

## v0.1.0 — Initial Release

### Core App

- Squarified treemap heatmap sized by portfolio value, colored by % performance
- Six time periods: Today, YTD, 3M, 6M, 1Y, 5Y
- Finnhub integration — bring your own free API key, or use Karta's shared key
- Shared key proxy (`/api/finnhub`) with 15-min KV cache and IP rate limiting
- Table view with all period returns per holding
- Setup tab: bulk import (ticker, shares), single add, portfolio name editor
- Privacy-first: all data in `localStorage`, nothing sent to Karta servers
- Demo mode with pre-seeded portfolio and onboarding hints
- Privacy mode to mask portfolio value
- Visitor counter via Vercel KV (`/api/counter`)
