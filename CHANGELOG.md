# Karta — Changelog

## v0.5.0 — 2026-04-17

### Theme System

**Three built-in themes**
- **Dark** (cold navy) — the original look, unchanged
- **Warm** (charcoal brown) — earthy tones with amber accents
- **Light** (warm cream) — a bright, legible mode for daylight use

**Theme picker**
- Three dot swatches in the top nav bar, always visible
- Selection persists to `localStorage` (`ph_theme`) and restores on next visit
- Active swatch highlighted with a green ring

**Full theme coverage**
- All surfaces, text hierarchy, chart colors, tooltips, inputs, badges, and interactive states are theme-aware
- Both App and Landing pages respond to the selected theme
- Body background synced to theme on every render

**Fonts**
- DM Serif Display and JetBrains Mono now preloaded via `<link rel="preconnect">` for faster first paint

**Tests**
- Unit tests for `THEMES` (key coverage for all 3 themes), `SWATCHES`, and the `useTheme` hook
- Integration tests for the theme switcher: renders all 3 buttons, clicking each persists the correct value to `localStorage`, persisted theme loads on re-render

---

## v0.4.0 — 2026-04-16

### Event Annotations & Table Polish

**Notes / annotations on portfolio events**
- Optional free-text note field in Setup → Add Single Stock (up to 120 chars)
- Notes are stored alongside the event in `localStorage` (`ph_events`)
- Displayed as small italic text in the History tab's Portfolio Changes log
- Shown in the chart's event bubble tooltip on hover, beneath the ticker/shares line
- Demo history seeded with realistic sample notes for immediate preview

**Table view improvements**
- Removed historical period columns (YTD, 3M, 6M, 1Y, 5Y) — data was not populated
- Kept Today's % change column (green/red, same logic as heatmap)
- Table now renders as a centered card with rounded corners and a border

**History tab improvements**
- Slightly lightened date and note colors in the Portfolio Changes log for better readability
- Consistent `maxWidth` across History and Table tabs for a unified layout

---

## v0.3.1 — 2026-04-15

### Patch

- Portfolio value now hidden by default on load (privacy mode on by default)

---

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
