import { create } from "zustand";
import { THEMES } from "../theme";
import { IS_DEMO, applySnapshot, applyEvent } from "../utils";
import { savePriceCache, saveCandleCache } from "../services/db";
import type {
  PortfolioItem,
  StockData,
  CandleSeries,
  HistoryEntry,
  PortfolioEvent,
  EventType,
  Mutation,
  TabKey,
  ThemeKey,
  Theme,
  TreemapRect,
} from "../types";

// ─── Default portfolio ────────────────────────────────────────────

// Stocks chosen to form ~4 natural correlation clusters:
//   Tech/Semis: NVDA + AMD          (highly correlated AI-chip plays)
//   Mega Tech:  MSFT + META + GOOG  (large-cap software/ads)
//   Finance:    JPM + BAC            (bank cycle)
//   Energy:     XOM + CVX            (oil-price driven)
//   Solo:       UNH                  (healthcare, low correlation to others)
export const DEFAULT_PORTFOLIO: PortfolioItem[] = [
  { ticker: "NVDA",  shares: 20, demoPerf:  11.2 },
  { ticker: "AMD",   shares: 30, demoPerf:   8.7 },
  { ticker: "MSFT",  shares: 18, demoPerf:   4.1 },
  { ticker: "META",  shares: 16, demoPerf:   5.9 },
  { ticker: "GOOG",  shares: 14, demoPerf:   3.3 },
  { ticker: "JPM",   shares: 28, demoPerf:   1.4 },
  { ticker: "BAC",   shares: 60, demoPerf:  -0.8 },
  { ticker: "XOM",   shares: 22, demoPerf:  -2.6 },
  { ticker: "CVX",   shares: 18, demoPerf:  -4.1 },
  { ticker: "UNH",   shares: 10, demoPerf:  -6.3 },
];

// ─── Constants ────────────────────────────────────────────────────

export const RL_WINDOW = 900; // must match api/finnhub.js

// Throttle: auto-refresh only if >15 min since last fetch
let lastFetchTime = parseInt(localStorage.getItem("ph_last_fetch") || "0");

// ─── State interface ──────────────────────────────────────────────

interface PortfolioState {
  // UI
  tab: TabKey;
  tooltip: TreemapRect | null;
  privacyMode: boolean;
  showPrivacyNotice: boolean;
  isMobile: boolean;
  boxSize: { w: number; h: number };

  // Theme
  theme: ThemeKey;
  S: Theme;

  // Portfolio
  portfolioName: string;
  portfolio: PortfolioItem[];
  isDemo: boolean;

  // Stock data
  stockData: Record<string, StockData>;
  candleData: Record<string, CandleSeries>;
  sectorData: Record<string, string>;  // ticker → finnhubIndustry
  loading: boolean;
  fetchErrors: Record<string, string>;
  rateLimitSecs: number;

  // History
  history: HistoryEntry[];
  portfolioEvents: PortfolioEvent[];

  // API key
  apiKey: string;
  apiInput: string;

  // Event editing
  editingEventIdx: number | null;
  editingNote: string;
  hoveredEventIdx: number | null;

  // Actions — UI
  setTab: (tab: TabKey) => void;
  setTooltip: (tooltip: TreemapRect | null) => void;
  setPrivacyMode: (mode: boolean | ((prev: boolean) => boolean)) => void;
  setShowPrivacyNotice: (show: boolean) => void;
  setIsMobile: (mobile: boolean) => void;
  setBoxSize: (size: { w: number; h: number }) => void;

  // Actions — theme
  setTheme: (theme: ThemeKey) => void;

  // Actions — portfolio
  setPortfolioName: (name: string) => void;
  setPortfolio: (portfolio: PortfolioItem[]) => void;
  handleSmartApply: (mutations: Mutation[]) => void;

  // Actions — API key
  setApiKey: (key: string) => void;
  setApiInput: (input: string) => void;

  // Actions — data
  fetchData: (key?: string, force?: boolean) => Promise<void>;
  tryAutoFetch: (force?: boolean) => void;
  hydrateStockData: (data: Record<string, StockData>) => void;
  hydrateCandleData: (data: Record<string, CandleSeries>) => void;

  // Actions — history
  setHistory: (history: HistoryEntry[] | ((prev: HistoryEntry[]) => HistoryEntry[])) => void;
  setPortfolioEvents: (events: PortfolioEvent[]) => void;
  recordDailySnapshot: (currentVal: number, prevCloseVal: number) => void;
  recordPortfolioEvent: (type: EventType, ticker: string, shares: number, prevShares?: number | null, note?: string | null) => void;
  saveEventNote: (idx: number, noteText: string) => void;
  seedDemoHistory: () => void;

  // Actions — event editing
  setEditingEventIdx: (idx: number | null) => void;
  setEditingNote: (note: string) => void;
  setHoveredEventIdx: (idx: number | null) => void;

  // Actions — rate limit
  setRateLimitSecs: (secs: number | ((prev: number) => number)) => void;
}

// ─── Store helpers (also used by resetStore) ─────────────────────

function loadPortfolio(): PortfolioItem[] {
  try { return JSON.parse(localStorage.getItem("ph_portfolio") || "") || DEFAULT_PORTFOLIO; }
  catch { return DEFAULT_PORTFOLIO; }
}

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem("ph_history") || "") || []; }
  catch { return []; }
}

function loadEvents(): PortfolioEvent[] {
  try { return JSON.parse(localStorage.getItem("ph_events") || "") || []; }
  catch { return []; }
}

function loadStockData(): Record<string, StockData> {
  // ph_stockdata is migrated to Dexie on first load (see db.migrateLocalStoragePriceCache),
  // but if migration hasn't run yet (first ever load), hydrate from localStorage as fallback.
  try { return JSON.parse(localStorage.getItem("ph_stockdata") || "") || {}; }
  catch { return {}; }
}

const initialTheme: ThemeKey = (localStorage.getItem("ph_theme") as ThemeKey) || "dark";

// ─── Test helper: reset store to match current localStorage ──────
// Called in test setup.js after localStorage.clear() so each test
// starts from a clean slate (Zustand is a module singleton otherwise).
export function resetStore() {
  const theme: ThemeKey = (localStorage.getItem("ph_theme") as ThemeKey) || "dark";
  lastFetchTime = parseInt(localStorage.getItem("ph_last_fetch") || "0");
  usePortfolioStore.setState({
    tab: "heatmap",
    tooltip: null,
    privacyMode: true,
    showPrivacyNotice: !localStorage.getItem("ph_privacy_seen"),
    isMobile: window.innerWidth < 640,
    boxSize: { w: 700, h: 460 },
    theme,
    S: THEMES[theme],
    portfolioName: localStorage.getItem("ph_name") || "Portfolio Heatmap",
    portfolio: loadPortfolio(),
    isDemo: IS_DEMO("ph_portfolio"),
    stockData: loadStockData(),
    candleData: {},
    sectorData: {},
    loading: false,
    fetchErrors: {},
    rateLimitSecs: 0,
    history: loadHistory(),
    portfolioEvents: loadEvents(),
    apiKey: localStorage.getItem("ph_apikey") || "",
    apiInput: localStorage.getItem("ph_apikey") || "",
    editingEventIdx: null,
    editingNote: "",
    hoveredEventIdx: null,
  });
}

export const usePortfolioStore = create<PortfolioState>()((set, get) => ({
  // ── UI ──────────────────────────────────────────────────────────
  tab: "heatmap",
  tooltip: null,
  privacyMode: true,
  showPrivacyNotice: !localStorage.getItem("ph_privacy_seen"),
  isMobile: window.innerWidth < 640,
  boxSize: { w: 700, h: 460 },

  // ── Theme ────────────────────────────────────────────────────────
  theme: initialTheme,
  S: THEMES[initialTheme],

  // ── Portfolio ────────────────────────────────────────────────────
  portfolioName: localStorage.getItem("ph_name") || "Portfolio Heatmap",
  portfolio: loadPortfolio(),
  isDemo: IS_DEMO("ph_portfolio"),

  // ── Stock data ────────────────────────────────────────────────────
  stockData: loadStockData(),
  candleData: {},
  sectorData: {},
  loading: false,
  fetchErrors: {},
  rateLimitSecs: 0,

  // ── History ───────────────────────────────────────────────────────
  history: loadHistory(),
  portfolioEvents: loadEvents(),

  // ── API key ───────────────────────────────────────────────────────
  apiKey: localStorage.getItem("ph_apikey") || "",
  apiInput: localStorage.getItem("ph_apikey") || "",

  // ── Event editing ─────────────────────────────────────────────────
  editingEventIdx: null,
  editingNote: "",
  hoveredEventIdx: null,

  // ── UI actions ────────────────────────────────────────────────────
  setTab: (tab) => set({ tab }),
  setTooltip: (tooltip) => set({ tooltip }),
  setPrivacyMode: (mode) => set(s => ({
    privacyMode: typeof mode === "function" ? mode(s.privacyMode) : mode,
  })),
  setShowPrivacyNotice: (show) => set({ showPrivacyNotice: show }),
  setIsMobile: (isMobile) => set({ isMobile }),
  setBoxSize: (boxSize) => set({ boxSize }),

  // ── Theme actions ─────────────────────────────────────────────────
  setTheme: (theme) => {
    localStorage.setItem("ph_theme", theme);
    set({ theme, S: THEMES[theme] });
  },

  // ── Portfolio actions ─────────────────────────────────────────────
  setPortfolioName: (portfolioName) => {
    localStorage.setItem("ph_name", portfolioName);
    set({ portfolioName });
  },

  setPortfolio: (portfolio) => {
    localStorage.setItem("ph_portfolio", JSON.stringify(portfolio));
    const isDemo = portfolio.length === 0;
    set({ portfolio, isDemo });
  },

  handleSmartApply: (mutations) => {
    const { portfolio, recordPortfolioEvent } = get();
    let next = [...portfolio];
    for (const m of mutations) {
      if (m.type === "create") {
        next = [...next, { ticker: m.ticker, shares: m.shares! }];
        recordPortfolioEvent("add", m.ticker, m.shares!);
      } else if (m.type === "update") {
        next = next.map(p => p.ticker === m.ticker ? { ...p, shares: m.shares! } : p);
        recordPortfolioEvent("update", m.ticker, m.shares!, m.prevShares);
      } else if (m.type === "remove") {
        next = next.filter(p => p.ticker !== m.ticker);
        recordPortfolioEvent("remove", m.ticker, m.prevShares!);
      }
    }
    get().setPortfolio(next);
  },

  // ── API key actions ───────────────────────────────────────────────
  setApiKey: (apiKey) => {
    localStorage.setItem("ph_apikey", apiKey);
    set({ apiKey });
  },
  setApiInput: (apiInput) => set({ apiInput }),

  // ── Rate limit ────────────────────────────────────────────────────
  setRateLimitSecs: (secs) => set(s => ({
    rateLimitSecs: typeof secs === "function" ? secs(s.rateLimitSecs) : secs,
  })),

  // ── Hydrate stockData from Dexie on initial load ──────────────────
  hydrateStockData: (data) => set(s => ({
    stockData: Object.keys(s.stockData).length > 0 ? s.stockData : data,
  })),

  // ── Hydrate candleData from Dexie on initial load ─────────────────
  hydrateCandleData: (data) => set(s => ({
    candleData: Object.keys(s.candleData).length > 0 ? s.candleData : data,
  })),

  // ── Auto-fetch (throttled, for mount + tab click) ─────────────────
  // force=false (default): silent background fetch — no loading overlay.
  // force=true: visible fetch with loading overlay (use on explicit tab switch).
  tryAutoFetch: (force = false) => {
    const { apiKey, loading, rateLimitSecs, fetchData } = get();
    if (loading || rateLimitSecs > 0) return;
    if (Date.now() - lastFetchTime <= 15 * 60 * 1000) return;
    fetchData(apiKey || "", force);
  },

  // ── Fetch stock data ──────────────────────────────────────────────
  fetchData: async (key = "", force = false) => {
    const { portfolio, isDemo } = get();
    if (!portfolio.length) return;
    const useShared = !key;
    const collected: Record<string, StockData> = {};

    if (useShared && force) {
      try {
        const check = await fetch("/api/finnhub", { method: "POST" });
        if (check.status === 429) {
          const { retryAfter } = await check.json() as { retryAfter?: number };
          get().setRateLimitSecs(retryAfter || RL_WINDOW);
          return;
        }
      } catch { /* network error — proceed */ }
    }

    const silent = useShared && !force;

    if (!silent) {
      set({ loading: true, fetchErrors: {}, stockData: {}, rateLimitSecs: 0 });
    }

    const now    = Math.floor(Date.now() / 1000);
    const then1y = now - (365 + 5)      * 86400;
    const then5y = now - (5 * 365 + 10) * 86400;
    const errs: Record<string, string> = {};

    const findPrice = (candle: { t?: number[]; c?: number[]; s?: string }, ts: number): number | null => {
      if (!candle?.t?.length || candle.s === "no_data") return null;
      let idx = -1;
      for (let j = 0; j < candle.t.length; j++) { if (candle.t[j] <= ts) idx = j; else break; }
      return idx >= 0 ? (candle.c![idx] || null) : null;
    };

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    for (let i = 0; i < portfolio.length; i++) {
      const { ticker } = portfolio[i];
      try {
        let q: { c?: number; pc?: number; dp?: number }, c1y: object, c5y: object;
        if (useShared) {
          const fp = force ? "&force=true" : "";
          const [qr, cr1y, cr5y] = await Promise.all([
            fetch(`/api/finnhub?ticker=${ticker}&type=quote${fp}`),
            fetch(`/api/finnhub?ticker=${ticker}&type=candle&resolution=D&from=${then1y}${fp}`),
            fetch(`/api/finnhub?ticker=${ticker}&type=candle&resolution=M&from=${then5y}${fp}`),
          ]);
          if (!qr.ok) break;
          [q, c1y, c5y] = await Promise.all([qr.json(), cr1y.json(), cr5y.json()]);
        } else {
          const [qr, cr1y, cr5y] = await Promise.all([
            fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${key}`),
            fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${then1y}&to=${now}&token=${key}`),
            fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=M&from=${then5y}&to=${now}&token=${key}`),
          ]);
          [q, c1y, c5y] = await Promise.all([qr.json(), cr1y.json(), cr5y.json()]);
        }

        if (!q.c || q.c === 0) {
          if (!useShared) errs[ticker] = "Not found";
          continue;
        }

        const cur = q.c;
        const ret = (candle: object, ts: number) => {
          const p = findPrice(candle as { t?: number[]; c?: number[]; s?: string }, ts);
          return p ? ((cur - p) / p) * 100 : null;
        };
        const d = new Date();
        const ts = {
          ytd: new Date(d.getFullYear(), 0, 1).getTime() / 1000,
          "3m": new Date(d.getFullYear(), d.getMonth() - 3, d.getDate()).getTime() / 1000,
          "6m": new Date(d.getFullYear(), d.getMonth() - 6, d.getDate()).getTime() / 1000,
          "1y": new Date(d.getFullYear() - 1, d.getMonth(), d.getDate()).getTime() / 1000,
          "5y": new Date(d.getFullYear() - 5, d.getMonth(), d.getDate()).getTime() / 1000,
        };

        const entry: StockData = {
          price:    cur,
          prevClose: q.pc ?? 0,
          today:    q.dp ?? null,
          ytd:      ret(c1y, ts.ytd),
          "3m":     ret(c1y, ts["3m"]),
          "6m":     ret(c1y, ts["6m"]),
          "1y":     ret(c1y, ts["1y"]),
          "5y":     ret(c5y, ts["5y"]),
        };
        collected[ticker] = entry;
        set(s => ({ stockData: { ...s.stockData, [ticker]: entry } }));

        // Fetch daily closes (Yahoo Finance) and sector profile (Finnhub) in parallel
        try {
          const [hr, pr] = await Promise.all([
            fetch(`/api/historical?ticker=${ticker}`),
            fetch(`/api/profile?ticker=${ticker}`),
          ]);
          if (hr.ok) {
            const hist = await hr.json() as { s?: string; t?: number[]; c?: number[] };
            if (hist.s !== "no_data" && hist.t?.length && hist.c?.length) {
              const series = { timestamps: hist.t, closes: hist.c };
              set(s => ({ candleData: { ...s.candleData, [ticker]: series } }));
              saveCandleCache(ticker, hist.t, hist.c).catch(() => {});
            }
          }
          if (pr.ok) {
            const prof = await pr.json() as { industry?: string | null };
            if (prof.industry) {
              set(s => ({ sectorData: { ...s.sectorData, [ticker]: prof.industry! } }));
            }
          }
        } catch { /* best-effort */ }
      } catch (e) {
        if (!useShared) {
          const msg = e instanceof Error ? e.message : String(e);
          errs[ticker] = msg;
          set(s => ({ fetchErrors: { ...s.fetchErrors, [ticker]: msg } }));
        }
      }
      if (!useShared && i < portfolio.length - 1) await sleep(220);
    }

    // Snapshot: record current value + prev-close so history % matches header
    {
      let currentVal = 0, prevCloseVal = 0;
      for (const { ticker, shares } of portfolio) {
        const d = collected[ticker];
        if (d?.price)     currentVal   += d.price    * shares;
        if (d?.prevClose) prevCloseVal += d.prevClose * shares;
      }
      if (!isDemo) get().recordDailySnapshot(currentVal, prevCloseVal);
    }

    // Persist to Dexie
    if (Object.keys(collected).length > 0) {
      savePriceCache(collected).catch(() => {
        // Dexie write failure — silently fall back, prices are in memory
      });
    }

    if (!silent) {
      set({ fetchErrors: errs, loading: false });
    }

    // Update throttle timestamp
    lastFetchTime = Date.now();
    localStorage.setItem("ph_last_fetch", String(lastFetchTime));
  },

  // ── History actions ───────────────────────────────────────────────
  setHistory: (history) => set(s => ({
    history: typeof history === "function" ? history(s.history) : history,
  })),

  setPortfolioEvents: (portfolioEvents) => set({ portfolioEvents }),

  recordDailySnapshot: (currentVal, prevCloseVal) => {
    const { isDemo } = get();
    if (isDemo || currentVal <= 0) return;
    const now = new Date();
    if (now.getDay() === 0 || now.getDay() === 6) return;
    const dateStr = now.toISOString().split("T")[0];

    set(s => {
      let base = s.history;

      if (prevCloseVal > 0) {
        const d = new Date(dateStr + "T12:00:00");
        do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6);
        const prevDate = d.toISOString().split("T")[0];
        const prevIdx = base.findIndex(h => h.date === prevDate);
        if (prevIdx >= 0) {
          const beforePrev = base.filter(h => h.date < prevDate).slice(-1)[0];
          const correctedChange = beforePrev?.value > 0
            ? ((prevCloseVal - beforePrev.value) / beforePrev.value) * 100
            : base[prevIdx].change;
          base = base.map((h, i) =>
            i === prevIdx ? { ...h, value: prevCloseVal, change: correctedChange } : h
          );
        }
      }

      const todayChange = prevCloseVal > 0
        ? ((currentVal - prevCloseVal) / prevCloseVal) * 100
        : null;
      const next = applySnapshot(base, dateStr, currentVal, todayChange);
      localStorage.setItem("ph_history", JSON.stringify(next));
      return { history: next };
    });
  },

  recordPortfolioEvent: (type, ticker, shares, prevShares = null, note = null) => {
    const { isDemo } = get();
    if (isDemo) return;
    const now = new Date();
    const event: PortfolioEvent = {
      date: now.toISOString().split("T")[0],
      time: now.toTimeString().split(" ")[0],
      type, ticker, shares,
      ...(prevShares != null ? { prevShares } : {}),
      ...(note ? { note } : {}),
    };
    set(s => {
      const next = applyEvent(s.portfolioEvents, event);
      localStorage.setItem("ph_events", JSON.stringify(next));
      return { portfolioEvents: next };
    });
  },

  saveEventNote: (idx, noteText) => {
    set(s => {
      const next = s.portfolioEvents.map((ev, i) => {
        if (i !== idx) return ev;
        const trimmed = noteText.trim();
        const updated = { ...ev };
        if (trimmed) updated.note = trimmed;
        else delete updated.note;
        return updated;
      });
      localStorage.setItem("ph_events", JSON.stringify(next));
      return { portfolioEvents: next, editingEventIdx: null, hoveredEventIdx: null };
    });
  },

  seedDemoHistory: () => {
    const demoHistory: HistoryEntry[] = [];
    const demoEvents: PortfolioEvent[] = [];
    let value = 68400;
    const today = new Date();
    for (let daysBack = 59; daysBack >= 0; daysBack--) {
      const d = new Date(today);
      d.setDate(d.getDate() - daysBack);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const dateStr = d.toISOString().split("T")[0];
      const dailyChange = (Math.random() - 0.44) * 3.2;
      value = value * (1 + dailyChange / 100);
      demoHistory.push({ date: dateStr, value: Math.round(value * 100) / 100, change: +dailyChange.toFixed(2) });
    }
    const eventDefs: Array<Omit<PortfolioEvent, "date" | "time">> = [
      { type: "add",    ticker: "NVDA",  shares: 5,  note: "AI momentum, added on dip" },
      { type: "add",    ticker: "MSFT",  shares: 10, note: "Rebalancing tech allocation" },
      { type: "remove", ticker: "XOM",   shares: 20, note: "Rotating out of energy" },
      { type: "update", ticker: "AAPL",  shares: 15, prevShares: 8, note: "Doubled down after earnings" },
      { type: "add",    ticker: "META",  shares: 3  },
      { type: "remove", ticker: "F",     shares: 50, note: "Cut losses, EV thesis failed" },
    ];
    const weekdays = demoHistory.map(h => h.date);
    const step = Math.floor(weekdays.length / (eventDefs.length + 1));
    eventDefs.forEach((ev, i) => {
      const date = weekdays[step * (i + 1)];
      if (!date) return;
      demoEvents.push({ date, time: "10:32:00", ...ev });
    });
    localStorage.setItem("ph_history", JSON.stringify(demoHistory));
    localStorage.setItem("ph_events",  JSON.stringify(demoEvents));
    set({ history: demoHistory, portfolioEvents: demoEvents });
  },

  // ── Event editing actions ─────────────────────────────────────────
  setEditingEventIdx: (editingEventIdx) => set({ editingEventIdx }),
  setEditingNote: (editingNote) => set({ editingNote }),
  setHoveredEventIdx: (hoveredEventIdx) => set({ hoveredEventIdx }),
}));
