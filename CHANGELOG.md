# Karta — Changelog

## v0.6.0 — 2026-04-18

### Smart Input, Annotation Editing & Setup Redesign

**Smart Input — Split Diff stock editor (replaces bulk import + single add)**
- Free-form command editor on the left; live "portfolio after apply" diff on the right
- Supports natural language: `AAPL 100`, `add NVDA 25`, `sold META 3`, `buy 10 TSLA`, `drop 6 NVDA`
- Auto-detects reversed `COUNT TICKER` order — `sold 8 META` and `sold META 8` both work
- Operators: `add / added / bought / buy / plus / +` to increment; `sold / sell / drop / dropped / remove / removed / - / minus` to decrement; bare `TICKER COUNT` to set
- Semantics: set creates or replaces; add creates if new; sold clamps to 0 and removes the row
- Right panel shows only tickers mentioned in the input, color-coded: green (new), blue (updated), red (removed)
- Footer shows live command count, skipped-line warnings, and inline parse error details
- Example button pre-fills the textarea; textarea clears automatically after a successful apply
- Placeholder text rendered in italics

**Inline annotation editing (History tab)**
- Hover any row in Portfolio Changes to reveal a pencil icon (✎) beside the note
- Click the pencil or the note text to enter inline edit mode — no modal, no separate form
- Confirm with ✓ or Enter; cancel with ✕ or Escape
- Saving an empty note removes the `note` property entirely from the event
- Icon only appears on the hovered row — zero visual clutter at rest

**Setup page layout redesign**
- Two-column floating tile grid: Data Source + Portfolio on the left, Appearance on the right
- All cards have a subtle box shadow for a lifted, floating feel
- Appearance tile updated to vertical rows (dot + label + active checkmark ✓)

**Theme picker moved to Setup**
- Removed from the app header — cleaner toolbar
- Now lives in the Appearance card in Setup tab
- Theme buttons show a ✓ on the active selection

**Landing page — freemium preparation**
- Removed GitHub link from nav bar and footer
- Removed all "open source" and "free & open source" copy
- "Open source — verify it yourself" privacy card replaced with "Fully auditable in your browser" (dev-tools framing)
- Footer tagline updated to "— portfolio heatmap"

**Tests**
- 110 tests passing across 2 files
- New unit suites: `parseLine` (15 tests) and `applyAll` (11 tests) covering all ops, reversed-order detection, clamping, semantic errors, and edge cases
- New integration suites: annotation editing (9 tests), SmartInput UI (13 tests), theme placement in Setup
- All portfolio management tests updated for the SmartInput API

---

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
