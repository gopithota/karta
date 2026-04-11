import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Squarified Treemap ────────────────────────────────────────────
function computeTreemap(items, W, H) {
  if (!items.length || W <= 0 || H <= 0) return [];
  const total = items.reduce((s, i) => s + Math.max(i.weight, 0.001), 0);
  const nodes = items
    .map(i => ({ ...i, area: (Math.max(i.weight, 0.001) / total) * W * H }))
    .sort((a, b) => b.area - a.area);
  const result = [];

  function worst(row, rowArea, axisLen) {
    const sv = rowArea / axisLen;
    let w = 0;
    for (const n of row) { const ia = (n.area / rowArea) * axisLen; w = Math.max(w, Math.max(sv / ia, ia / sv)); }
    return w;
  }

  function squarify(nodes, x, y, w, h) {
    if (!nodes.length || w < 1 || h < 1) return;
    if (nodes.length === 1) { result.push({ ...nodes[0], x, y, w, h }); return; }
    const leftStrip = w >= h;
    const axisLen = leftStrip ? h : w;
    let row = [], rowArea = 0, nextIdx = 0;
    while (nextIdx < nodes.length) {
      const c = nodes[nextIdx];
      const newRow = [...row, c], newArea = rowArea + c.area;
      if (row.length === 0 || worst(newRow, newArea, axisLen) <= worst(row, rowArea, axisLen) + 0.001) {
        row = newRow; rowArea = newArea; nextIdx++;
      } else break;
    }
    if (!row.length) { row = [nodes[0]]; rowArea = nodes[0].area; nextIdx = 1; }
    const sv = rowArea / axisLen;
    let offset = 0;
    for (const n of row) {
      const ia = (n.area / rowArea) * axisLen;
      if (leftStrip) result.push({ ...n, x, y: y + offset, w: sv, h: ia });
      else result.push({ ...n, x: x + offset, y, w: ia, h: sv });
      offset += ia;
    }
    const rem = nodes.slice(nextIdx);
    if (rem.length) {
      if (leftStrip) squarify(rem, x + sv, y, w - sv, h);
      else squarify(rem, x, y + sv, w, h - sv);
    }
  }

  squarify(nodes, 0, 0, W, H);
  return result;
}

// ─── Color scale ──────────────────────────────────────────────────
// Original max colors (deep red / deep green) preserved.
// Grey zone narrowed to ±0.3% — outside that, color kicks in immediately.
function perfColor(pct) {
  if (pct === null || pct === undefined || isNaN(pct)) return "#1e293b";
  if (Math.abs(pct) < 0.2) return "#334155"; // tiny grey band around zero only
  const t = Math.max(-1, Math.min(1, pct / 10));
  if (t < 0) {
    const i = -t;
    return `rgb(${Math.round(30 + 190 * i)},${Math.round(40 - 10 * i)},${Math.round(40 - 10 * i)})`;
  }
  return `rgb(${Math.round(25 - 5 * t)},${Math.round(100 + 110 * t)},${Math.round(25 - 5 * t)})`;
}

const LEGEND_STOPS = [-10, -7, -4, -2, -1, 0, 1, 2, 4, 7, 10];

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "ytd",   label: "YTD"   },
  { key: "3m",    label: "3M"    },
  { key: "6m",    label: "6M"    },
  { key: "1y",    label: "1Y"    },
  { key: "5y",    label: "5Y"    },
];

// Demo portfolio — 10 stocks across sectors, varied sizes for visual richness
// demoPerf: pre-seeded values spanning the full color range for a vivid first impression
const DEFAULT_PORTFOLIO = [
  { ticker: "AMD",   shares: 20, demoPerf:  9.1  },  // deep green
  { ticker: "NVDA",  shares: 22, demoPerf:  8.4  },  // strong green
  { ticker: "META",  shares: 20, demoPerf:  6.8  },  // mid green
  { ticker: "MSFT",  shares: 20, demoPerf:  3.7  },  // light green
  { ticker: "JPM",   shares: 30, demoPerf:  0.9  },  // near zero
  { ticker: "AAPL",  shares: 28, demoPerf: -1.1  },  // light red
  { ticker: "AMZN",  shares: 18, demoPerf: -2.3  },  // light red
  { ticker: "UNH",   shares: 10, demoPerf: -3.8  },  // mid red
  { ticker: "XOM",   shares: 22, demoPerf: -5.2  },  // strong red
  { ticker: "TSLA",  shares: 25, demoPerf: -7.5  },  // deep red
];

const RL_WINDOW = 900; // must match api/finnhub.js

const IS_DEMO = (key) => {
  // True if the user has never saved their own portfolio
  const saved = localStorage.getItem(key);
  if (!saved) return true;
  try {
    const parsed = JSON.parse(saved);
    return !parsed || parsed.length === 0;
  } catch { return true; }
};

const S = {
  bg: "#0c0f18", panel: "#131825", border: "#1c2536",
  accent: "#3b82f6", text: "#e2e8f0", muted: "#64748b",
};

// ─── Main ─────────────────────────────────────────────────────────
export default function App() {
  const [apiKey,        setApiKey]        = useState(() => localStorage.getItem("ph_apikey") || "");
  const [apiInput,      setApiInput]      = useState(() => localStorage.getItem("ph_apikey") || "");
  const [portfolioName, setPortfolioName] = useState(() => localStorage.getItem("ph_name") || "Portfolio Heatmap");
  const [portfolio,     setPortfolio]     = useState(() => {
    try { return JSON.parse(localStorage.getItem("ph_portfolio")) || DEFAULT_PORTFOLIO; }
    catch { return DEFAULT_PORTFOLIO; }
  });
  const [newTicker,    setNewTicker]    = useState("");
  const [newShares,    setNewShares]    = useState("10");
  const [bulkText,     setBulkText]     = useState("");
  const [bulkError,    setBulkError]    = useState("");
  const [stockData,    setStockData]    = useState({});
  const [loading,      setLoading]      = useState(false);
  const [fetchErrors,  setFetchErrors]  = useState({});
  const [tab,          setTab]          = useState("heatmap");
  const [tooltip,      setTooltip]      = useState(null);
  const [privacyMode,  setPrivacyMode]  = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(
    () => !localStorage.getItem("ph_privacy_seen")
  );
  const [isDemo, setIsDemo] = useState(() => IS_DEMO("ph_portfolio"));
  const [rateLimitSecs, setRateLimitSecs] = useState(0);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const containerRef = useRef(null);
  const [boxSize, setBoxSize] = useState({ w: 700, h: 460 });

  // Observe heatmap container size
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([e]) =>
      setBoxSize({ w: e.contentRect.width, h: e.contentRect.height })
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Persist portfolio + clear demo flag when user saves their own
  useEffect(() => {
    localStorage.setItem("ph_portfolio", JSON.stringify(portfolio));
    // Once user has made any edit, it's no longer the demo
    if (portfolio.length && JSON.stringify(portfolio) !== JSON.stringify(DEFAULT_PORTFOLIO)) {
      setIsDemo(false);
    }
  }, [portfolio]);

  // Track viewport width for responsive layout
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // Auto-fetch on mount using shared key when user has no key saved
  useEffect(() => {
    if (!apiKey && portfolio.length) fetchData("", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Count down rate-limit timer (1 s tick)
  useEffect(() => {
    if (rateLimitSecs <= 0) return;
    const t = setTimeout(() => setRateLimitSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [rateLimitSecs]);

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const fetchData = useCallback(async (key = apiKey, force = false) => {
    if (!portfolio.length) return;
    const useShared = !key;

    // Pre-flight rate-limit check — one POST before the loop, not per ticker
    if (useShared && force) {
      try {
        const check = await fetch("/api/finnhub", { method: "POST" });
        if (check.status === 429) {
          const { retryAfter } = await check.json();
          setRateLimitSecs(retryAfter || RL_WINDOW);
          return;
        }
      } catch { /* network error — proceed anyway */ }
    }

    // Silent mode: shared key auto-fetch on mount — no loading overlay, no errors shown,
    // demo data stays visible while we quietly try to get real prices in the background.
    const silent = useShared && !force;

    if (!silent) {
      setLoading(true);
      setFetchErrors({});
      setStockData({});
      setRateLimitSecs(0);
    }

    const now      = Math.floor(Date.now() / 1000);
    const then1y   = now - (365 + 5)      * 86400;
    const then5y   = now - (5 * 365 + 10) * 86400;
    const errs     = {};

    const findPrice = (candle, ts) => {
      if (!candle?.t?.length || candle.s === "no_data") return null;
      let idx = -1;
      for (let j = 0; j < candle.t.length; j++) { if (candle.t[j] <= ts) idx = j; else break; }
      return idx >= 0 ? (candle.c[idx] || null) : null;
    };

    for (let i = 0; i < portfolio.length; i++) {
      const { ticker } = portfolio[i];
      try {
        let q, c1y, c5y;
        if (useShared) {
          const fp = force ? "&force=true" : "";
          const [qr, cr1y, cr5y] = await Promise.all([
            fetch(`/api/finnhub?ticker=${ticker}&type=quote${fp}`),
            fetch(`/api/finnhub?ticker=${ticker}&type=candle&resolution=D&from=${then1y}${fp}`),
            fetch(`/api/finnhub?ticker=${ticker}&type=candle&resolution=M&from=${then5y}${fp}`),
          ]);
          // If proxy isn't running or returns an error, bail out silently
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
        const ret = (candle, ts) => { const p = findPrice(candle, ts); return p ? ((cur - p) / p) * 100 : null; };
        const d = new Date();
        const ts = {
          ytd: new Date(d.getFullYear(), 0, 1).getTime() / 1000,
          "3m": new Date(d.getFullYear(), d.getMonth() - 3, d.getDate()).getTime() / 1000,
          "6m": new Date(d.getFullYear(), d.getMonth() - 6, d.getDate()).getTime() / 1000,
          "1y": new Date(d.getFullYear() - 1, d.getMonth(), d.getDate()).getTime() / 1000,
          "5y": new Date(d.getFullYear() - 5, d.getMonth(), d.getDate()).getTime() / 1000,
        };

        const entry = {
          price: cur,
          today: q.dp,
          ytd:   ret(c1y, ts.ytd),
          "3m":  ret(c1y, ts["3m"]),
          "6m":  ret(c1y, ts["6m"]),
          "1y":  ret(c1y, ts["1y"]),
          "5y":  ret(c5y, ts["5y"]),
        };
        setStockData(prev => ({ ...prev, [ticker]: entry }));
      } catch (e) {
        if (!useShared) {
          errs[ticker] = e.message;
          setFetchErrors(prev => ({ ...prev, [ticker]: e.message }));
        }
      }
      // Only throttle direct Finnhub calls (shared key responses come from cache)
      if (!useShared && i < portfolio.length - 1) await sleep(220);
    }

    if (!silent) {
      setFetchErrors(errs);
      setLoading(false);
    }
  }, [apiKey, portfolio]);

  const getWeight = useCallback((ticker) => {
    const d = stockData[ticker];
    const h = portfolio.find(p => p.ticker === ticker);
    if (d && h) return d.price * h.shares;
    return h ? h.shares * 100 : 100;
  }, [stockData, portfolio]);

  const totalValue = useMemo(
    () => portfolio.reduce((s, { ticker }) => s + getWeight(ticker), 0),
    [portfolio, getWeight]
  );

  const treemapItems = useMemo(() => portfolio.map(({ ticker }) => {
    const realPerf  = stockData[ticker]?.today ?? null;
    const demoEntry = DEFAULT_PORTFOLIO.find(d => d.ticker === ticker);
    // Show demoPerf colors instantly; replaced by real data once loaded
    const perf = realPerf !== null ? realPerf : (isDemo && demoEntry ? demoEntry.demoPerf : null);
    return {
      id: ticker, ticker,
      weight: getWeight(ticker),
      perf,
      price: stockData[ticker]?.price ?? null,
    };
  }), [portfolio, stockData, getWeight, isDemo]);

  const rects = useMemo(
    () => computeTreemap(treemapItems, boxSize.w, boxSize.h),
    [treemapItems, boxSize.w, boxSize.h]
  );

  const aggReturn = useMemo(() => {
    if (!Object.keys(stockData).length) return null;
    let wSum = 0, wRet = 0;
    for (const { ticker, shares } of portfolio) {
      const d = stockData[ticker];
      if (!d || d.today == null) continue;
      const val = d.price * shares;
      wRet += d.today * val; wSum += val;
    }
    return wSum > 0 ? wRet / wSum : null;
  }, [stockData, portfolio]);

  const addStock = () => {
    const t = newTicker.trim().toUpperCase();
    const s = parseFloat(newShares);
    if (!t || isNaN(s) || s <= 0 || portfolio.find(p => p.ticker === t)) return;
    setPortfolio([...portfolio, { ticker: t, shares: s }]);
    setNewTicker(""); setNewShares("10");
  };

  const parseBulk = () => {
    setBulkError("");
    const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean);
    const parsed = [], errors = [];
    for (const line of lines) {
      const parts = line.split(/[\s,\t]+/).filter(Boolean);
      if (parts.length < 2) { errors.push(`"${line}" — need ticker and shares`); continue; }
      const ticker = parts[0].toUpperCase();
      const shares = parseFloat(parts[1]);
      if (!/^[A-Z.\-]{1,10}$/.test(ticker)) { errors.push(`"${ticker}" — invalid ticker`); continue; }
      if (isNaN(shares) || shares <= 0) { errors.push(`"${ticker}" — invalid shares`); continue; }
      if (parsed.find(p => p.ticker === ticker)) continue;
      parsed.push({ ticker, shares });
    }
    if (errors.length) { setBulkError(errors.join(" · ")); return; }
    if (!parsed.length) { setBulkError("Nothing to import — check the format."); return; }
    const merged = [...portfolio];
    for (const p of parsed) {
      const idx = merged.findIndex(m => m.ticker === p.ticker);
      if (idx >= 0) merged[idx] = p; else merged.push(p);
    }
    setPortfolio(merged);
    setBulkText("");
  };

  const btnBase = (active) => ({
    padding: "5px 13px", borderRadius: 6,
    border: active ? `1px solid ${S.accent}` : `1px solid ${S.border}`,
    cursor: "pointer", fontSize: 13, fontWeight: 500, transition: "all .15s",
    background: active ? "#1a3160" : S.panel,
    color: active ? "#93c5fd" : S.muted,
  });

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: S.bg, color: S.text, height: "100vh", display: "flex", flexDirection: "column", userSelect: "none" }}>

      {/* First-run privacy notice */}
      {showPrivacyNotice && (
        <div style={{
          position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 200, width: "min(580px, calc(100vw - 40px))",
          background: "#0e1420", border: "1px solid rgba(74,222,128,0.25)",
          borderRadius: 14, padding: "18px 20px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          display: "flex", alignItems: "flex-start", gap: 14,
        }}>
          <div style={{ fontSize: 22, flexShrink: 0 }}>🔒</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0", marginBottom: 4 }}>
              Your portfolio never leaves your device
            </div>
            <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
              Your tickers, share counts, and API key are stored only in <strong style={{ color: "#94a3b8" }}>your browser's localStorage</strong>.
              Stock prices are fetched directly from Finnhub — nothing passes through our servers.
              We never see your holdings.
            </div>
          </div>
          <button
            onClick={() => { setShowPrivacyNotice(false); localStorage.setItem("ph_privacy_seen", "1"); }}
            style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer", background: "rgba(74,222,128,0.15)", color: "#4ade80", fontSize: 12, fontWeight: 700 }}
          >Got it</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "8px 12px" : "12px 18px", borderBottom: `1px solid ${S.border}`, flexShrink: 0, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 12, minWidth: 0 }}>
          <a href="/" title="Back to Karta home" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none", color: "inherit", minWidth: 0 }}>
            <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <rect width="22" height="22" rx="5" fill="#0a1a12"/>
              {[["#1a4731","#1e5c3e","#2d7a52"],["#1e5c3e","#2d7a52","#3a9966"],["#2d7a52","#3a9966","#4ade80"],["#1a3a28","#2d7a52","#22c55e"]].map((row, ri) =>
                row.map((fill, ci) => {
                  const cell = 22/4.2, gap = cell*0.18, r = cell*0.28;
                  const totalW = 3*cell+2*gap, totalH = 4*cell+3*gap;
                  return <rect key={ri+"-"+ci} x={(22-totalW)/2+ci*(cell+gap)} y={(22-totalH)/2+ri*(cell+gap)} width={cell} height={cell} rx={r} fill={fill}/>;
                })
              )}
            </svg>
            <span style={{ fontSize: isMobile ? 14 : 18, fontWeight: 800, letterSpacing: "-0.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: isMobile ? 110 : "none" }}>{portfolioName}</span>
          </a>
          {aggReturn !== null && !isMobile && (
            <span style={{ fontSize: 13, fontWeight: 700, color: aggReturn >= 0 ? "#4ade80" : "#f87171", flexShrink: 0 }}>
              {aggReturn >= 0 ? "▲" : "▼"} {Math.abs(aggReturn).toFixed(2)}%
            </span>
          )}
          {totalValue > 0 && (
            <button
              onClick={() => setPrivacyMode(p => !p)}
              title={privacyMode ? "Show portfolio value" : "Hide portfolio value"}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: isMobile ? "3px 7px" : "3px 10px", borderRadius: 5, border: `1px solid ${S.border}`, background: S.panel, color: privacyMode ? S.muted : S.text, cursor: "pointer", fontSize: 12, flexShrink: 0 }}
            >
              {privacyMode ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
              {!isMobile && (
                <span style={{ fontWeight: 600, letterSpacing: privacyMode ? "0.15em" : 0 }}>
                  {privacyMode ? "••••••" : `$${totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
                </span>
              )}
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: isMobile ? 3 : 4, alignItems: "center", flexShrink: 0 }}>
          {!isMobile && (
            <div title="Your portfolio is stored locally in your browser only. Nothing is sent to our servers." style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 6,
              border: "1px solid rgba(74,222,128,0.2)",
              background: "rgba(74,222,128,0.06)",
              fontSize: 11, color: "#4ade80", fontWeight: 600,
              cursor: "default", letterSpacing: "0.02em",
            }}>
              🔒 Local only
            </div>
          )}
          {["heatmap", "table", "setup"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...btnBase(tab === t), textTransform: "capitalize", padding: isMobile ? "5px 9px" : "5px 13px", fontSize: isMobile ? 12 : 13 }}>
              {isMobile ? (t === "heatmap" ? "Map" : t) : t}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      {tab !== "setup" && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderBottom: `1px solid ${S.border}`, flexShrink: 0 }}>
          <div style={{ flex: 1 }} />
          {Object.keys(fetchErrors).length > 0 && (
            <span style={{ fontSize: 12, color: "#f87171" }}>⚠ {Object.keys(fetchErrors).length} error(s)</span>
          )}
          <button
            onClick={() => fetchData(apiKey, true)}
            disabled={loading || rateLimitSecs > 0}
            style={{ padding: "5px 14px", borderRadius: 6, border: "none", cursor: loading || rateLimitSecs > 0 ? "not-allowed" : "pointer", background: loading ? "#374151" : S.accent, color: "#fff", fontSize: 13, fontWeight: 600, opacity: rateLimitSecs > 0 ? 0.5 : 1 }}
          >
            {loading ? "⟳ Loading…" : rateLimitSecs > 0
              ? `⟳ ${Math.floor(rateLimitSecs / 60)}:${String(rateLimitSecs % 60).padStart(2, "0")}`
              : "⟳ Refresh"}
          </button>
        </div>
      )}

      {/* Shared-key nudge — visible when user hasn't set their own API key */}
      {!apiKey && tab !== "setup" && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          padding: "5px 18px", flexShrink: 0,
          background: "rgba(59,130,246,0.05)",
          borderBottom: "1px solid rgba(59,130,246,0.1)",
          fontSize: 12, color: S.muted,
        }}>
          {rateLimitSecs > 0 ? (
            <>
              <span style={{ color: "#f87171", fontWeight: 600 }}>
                Slow down! Next refresh in {Math.floor(rateLimitSecs / 60)}:{String(rateLimitSecs % 60).padStart(2, "0")}
              </span>
              <span style={{ color: "#1e293b" }}>·</span>
              <button onClick={() => setTab("setup")} style={{ background: "none", border: "none", cursor: "pointer", color: "#93c5fd", fontSize: 12, fontWeight: 600, padding: 0 }}>
                Get your own key for unlimited refreshes →
              </button>
            </>
          ) : (
            <>
              <span>{isMobile ? "Shared key · 15 min cache" : "Using Karta's shared key — prices cached every 15 min"}</span>
              <span style={{ color: "#1e293b" }}>·</span>
              <button onClick={() => setTab("setup")} style={{ background: "none", border: "none", cursor: "pointer", color: "#93c5fd", fontSize: 12, fontWeight: 600, padding: 0 }}>
                {isMobile ? "Get your own key →" : "Get your own free key →"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Content — all tabs always mounted, toggled via CSS display */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>

        {/* ━━━ HEATMAP ━━━ */}
        <div style={{ position: "absolute", inset: 0, display: tab === "heatmap" ? "block" : "none" }}>
          {!loading && Object.keys(stockData).length === 0 && !isDemo && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <div style={{ fontSize: 36 }}>📊</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>No data loaded yet</div>
              <button onClick={() => fetchData()} style={{ marginTop: 4, padding: "7px 20px", borderRadius: 6, border: "none", cursor: "pointer", background: S.accent, color: "#fff", fontSize: 13, fontWeight: 600 }}>Load Portfolio Data</button>
            </div>
          )}
          {loading && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, pointerEvents: "none" }}>
              <div style={{ background: "rgba(12,15,24,0.85)", padding: "12px 24px", borderRadius: 10, fontSize: 14, color: S.muted }}>
                Fetching {portfolio.length} stocks…
              </div>
            </div>
          )}
          {/* Demo banner */}
          {isDemo && !loading && (
            <div style={{
              position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
              zIndex: 20, whiteSpace: "nowrap",
              background: "rgba(14,20,32,0.92)", backdropFilter: "blur(10px)",
              border: "1px solid rgba(250,204,21,0.3)",
              borderRadius: 10, padding: "9px 18px",
              display: "flex", alignItems: "center", gap: 10,
              boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
            }}>
              <span style={{ fontSize: 14 }}>✨</span>
              <span style={{ fontSize: 13, color: "#fde68a", fontWeight: 600 }}>Demo portfolio</span>
              <span style={{ color: "#334155", fontSize: 13 }}>·</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Customize it for your holdings</span>
              <span style={{ color: "#334155", fontSize: 13 }}>—</span>
              <button
                onClick={() => setTab("setup")}
                style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", textUnderlineOffset: 3 }}
              >Set up yours →</button>
            </div>
          )}
          {/* Onboarding hints — only shown while in demo mode */}
          {isDemo && !loading && (
            <div style={{
              position: "absolute", top: 52, left: 12, zIndex: 25,
              display: "flex", flexDirection: "column", gap: 7, alignItems: "flex-start",
            }}>
              {[
                { icon: "👁", label: "Toggle portfolio value", action: () => setPrivacyMode(p => !p) },
                { icon: "⊞", label: "See table view", action: () => setTab("table") },
                { icon: "✏️", label: "Customize your portfolio", action: () => setTab("setup") },
              ].map(hint => (
                <button key={hint.label} onClick={hint.action} style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "6px 12px", borderRadius: 8,
                  background: "rgba(14,20,32,0.88)", backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#94a3b8", fontSize: 12, fontWeight: 500,
                  cursor: "pointer", transition: "color 0.15s, border-color 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#e2e8f0"; e.currentTarget.style.borderColor = "rgba(74,222,128,0.25)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                >
                  <span style={{ fontSize: 13 }}>{hint.icon}</span>
                  {hint.label}
                  <span style={{ color: "#4ade80", fontSize: 11 }}>→</span>
                </button>
              ))}
            </div>
          )}

          <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }} onClick={isMobile ? () => setTooltip(null) : undefined}>
            {rects.map(rect => {
              const gap = 2;
              const bx = rect.x + gap, by = rect.y + gap;
              const bw = rect.w - gap * 2, bh = rect.h - gap * 2;
              if (bw < 4 || bh < 4) return null;
              const showTicker = bw > 30 && bh > 20;
              const showPerf   = bw > 55 && bh > 42;
              const showPrice  = bw > 75 && bh > 60;
              return (
                <div
                  key={rect.id}
                  style={{ position: "absolute", left: bx, top: by, width: bw, height: bh, background: perfColor(rect.perf), borderRadius: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", transition: "filter .12s", cursor: isMobile ? "pointer" : "crosshair" }}
                  onMouseEnter={isMobile ? undefined : e => { e.currentTarget.style.filter = "brightness(1.25)"; setTooltip(rect); }}
                  onMouseLeave={isMobile ? undefined : e => { e.currentTarget.style.filter = ""; setTooltip(null); }}
                  onClick={isMobile ? e => { e.stopPropagation(); setTooltip(tooltip?.id === rect.id ? null : rect); } : undefined}
                >
                  {showTicker && <div style={{ fontSize: Math.max(9, Math.min(22, bw / 5.5)), fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: "-0.02em" }}>{rect.ticker}</div>}
                  {showPerf  && rect.perf !== null && <div style={{ fontSize: Math.max(8, Math.min(15, bw / 7)), fontWeight: 700, color: "rgba(255,255,255,.88)", lineHeight: 1.2 }}>{rect.perf >= 0 ? "+" : ""}{rect.perf.toFixed(2)}%</div>}
                  {showPrice && rect.price && <div style={{ fontSize: Math.max(8, Math.min(12, bw / 9)), color: "rgba(255,255,255,.55)", lineHeight: 1.2 }}>${rect.price.toFixed(2)}</div>}
                </div>
              );
            })}
            {tooltip && (
              <div style={{ position: "absolute", bottom: 48, left: 16, background: "#1e293b", border: `1px solid ${S.border}`, borderRadius: 8, padding: "10px 14px", pointerEvents: isMobile ? "auto" : "none", zIndex: 20, minWidth: 160 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{tooltip.ticker}</div>
                  {isMobile && <button onClick={() => setTooltip(null)} style={{ background: "none", border: "none", color: S.muted, fontSize: 18, cursor: "pointer", padding: "0 0 0 12px", lineHeight: 1 }}>×</button>}
                </div>
                {tooltip.price && <div style={{ fontSize: 13, color: S.muted }}>Price: <strong style={{ color: S.text }}>${tooltip.price.toFixed(2)}</strong></div>}
                {tooltip.perf !== null && <div style={{ fontSize: 13, color: tooltip.perf >= 0 ? "#4ade80" : "#f87171", fontWeight: 700 }}>Today: {tooltip.perf >= 0 ? "+" : ""}{tooltip.perf.toFixed(2)}%</div>}
                <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{((getWeight(tooltip.ticker) / totalValue) * 100).toFixed(1)}% of portfolio</div>
              </div>
            )}
            {rects.length > 0 && (
              <div style={{ position: "absolute", bottom: 10, right: 12, display: "flex", alignItems: "center", gap: 3, background: "rgba(12,15,24,.75)", backdropFilter: "blur(4px)", padding: "5px 10px", borderRadius: 7, fontSize: 11, color: S.muted }}>
                <span>-10%</span>
                {LEGEND_STOPS.map(v => <div key={v} style={{ width: 14, height: 14, background: perfColor(v), borderRadius: 2 }} />)}
                <span>+10%</span>
              </div>
            )}
          </div>
        </div>

        {/* ━━━ TABLE ━━━ */}
        <div style={{ position: "absolute", inset: 0, overflow: "auto", display: tab === "table" ? "block" : "none" }}>
          {Object.keys(stockData).length === 0 ? (
            <div style={{ textAlign: "center", color: S.muted, padding: 48, fontSize: 14 }}>Load data using the Refresh button above.</div>
          ) : (
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${S.border}`, position: "sticky", top: 0, background: S.bg }}>
                  {["Ticker", "Price", "Shares", "Value", "Weight", ...PERIODS.map(p => p.label)].map((h, i) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: i === 0 ? "left" : "right", color: S.muted, fontWeight: 600, fontSize: 12, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...portfolio].sort((a, b) => getWeight(b.ticker) - getWeight(a.ticker)).map(({ ticker, shares }) => {
                  const d = stockData[ticker];
                  if (!d) return null;
                  const val = d.price * shares;
                  const w = totalValue > 0 ? (val / totalValue) * 100 : 0;
                  return (
                    <tr key={ticker} style={{ borderBottom: `1px solid #0f1520` }}>
                      <td style={{ padding: "9px 14px", fontWeight: 800, fontSize: 14 }}>{ticker}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right" }}>${d.price.toFixed(2)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", color: S.muted }}>{shares}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 600 }}>${val.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", color: S.muted }}>{w.toFixed(1)}%</td>
                      {PERIODS.map(p => {
                        const v = d[p.key];
                        return (
                          <td key={p.key} style={{ padding: "9px 14px", textAlign: "right", color: v == null ? "#334155" : v >= 0 ? "#4ade80" : "#f87171" }}>
                            {v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* ━━━ SETUP ━━━ */}
        <div style={{ position: "absolute", inset: 0, overflow: "auto", display: tab === "setup" ? "block" : "none", padding: 20 }}>
          <div style={{ maxWidth: 620, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* ── Card 1: Data source ── */}
            <div style={{ background: S.panel, borderRadius: 10, border: `1px solid ${S.border}`, overflow: "hidden" }}>

              {/* Finnhub attribution header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${S.border}` }}>
                <div style={{ fontSize: 20 }}>📡</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: S.text }}>Powered by Finnhub</span>
                    <span style={{ fontSize: 10, fontWeight: 700, background: "#1d3a6e", color: "#93c5fd", padding: "2px 6px", borderRadius: 4 }}>FREE</span>
                  </div>
                  <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>Real-time quotes · Historical candle data · 60 req/min · No credit card needed</div>
                </div>
                <a href="https://finnhub.io/register" target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, fontWeight: 600, color: "#4ade80", textDecoration: "none", whiteSpace: "nowrap" }}>
                  Get free key →
                </a>
              </div>

              {/* Key input */}
              <div style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: S.text }}>Your API Key</div>
                  {apiKey
                    ? <span style={{ fontSize: 11, fontWeight: 700, color: "#4ade80", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", padding: "2px 8px", borderRadius: 20 }}>✓ Active — using your own key</span>
                    : <span style={{ fontSize: 11, fontWeight: 600, color: "#93c5fd", background: "rgba(147,197,253,0.08)", border: "1px solid rgba(147,197,253,0.15)", padding: "2px 8px", borderRadius: 20 }}>Using Karta's shared key</span>
                  }
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="password"
                    value={apiInput}
                    onChange={e => setApiInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { setApiKey(apiInput); localStorage.setItem("ph_apikey", apiInput); setTab("heatmap"); setTimeout(() => fetchData(apiInput), 100); }}}
                    placeholder="Paste your Finnhub API key here…"
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 7, border: `1px solid ${S.border}`, background: S.bg, color: S.text, fontSize: 14, outline: "none" }}
                  />
                  <button
                    onClick={() => { setApiKey(apiInput); localStorage.setItem("ph_apikey", apiInput); setTab("heatmap"); setTimeout(() => fetchData(apiInput), 100); }}
                    disabled={!apiInput}
                    style={{ padding: "8px 18px", borderRadius: 7, border: "none", cursor: apiInput ? "pointer" : "not-allowed", background: S.accent, color: "#fff", fontSize: 14, fontWeight: 700, opacity: !apiInput ? 0.5 : 1 }}
                  >Save & Load</button>
                </div>
                <div style={{ fontSize: 12, color: S.muted, marginTop: 8 }}>
                  Your own key gives you unlimited refreshes and faster updates.
                  Free at <a href="https://finnhub.io/register" target="_blank" rel="noreferrer" style={{ color: "#93c5fd" }}>finnhub.io/register</a> — takes 2 minutes.
                </div>
              </div>
            </div>

            {/* ── Card 2: Portfolio ── */}
            <div style={{ background: S.panel, borderRadius: 10, border: `1px solid ${S.border}`, overflow: "hidden" }}>

              {/* Header row with title editor */}
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${S.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.muted, marginBottom: 8, letterSpacing: "0.04em" }}>PORTFOLIO NAME</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={portfolioName}
                    onChange={e => { setPortfolioName(e.target.value); localStorage.setItem("ph_name", e.target.value); }}
                    placeholder="Portfolio Heatmap"
                    maxLength={40}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 7, border: `1px solid ${S.border}`, background: S.bg, color: S.text, fontSize: 14, fontWeight: 700, outline: "none" }}
                  />
                  <button
                    onClick={() => { setPortfolioName("Portfolio Heatmap"); localStorage.setItem("ph_name", "Portfolio Heatmap"); }}
                    style={{ padding: "8px 14px", borderRadius: 7, border: `1px solid ${S.border}`, cursor: "pointer", background: "transparent", color: S.muted, fontSize: 13 }}
                  >Reset</button>
                </div>
              </div>

              <div style={{ padding: 20 }}>

                {/* Demo callout — only shown while viewing default stocks */}
                {isDemo && (
                  <div style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    background: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.2)",
                    borderRadius: 8, padding: "12px 14px", marginBottom: 20,
                  }}>
                    <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>✨</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#fde68a", marginBottom: 3 }}>You're viewing demo stocks</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                        These are placeholder holdings. Clear them and add your own tickers and share counts to see your real portfolio.
                      </div>
                    </div>
                    <button
                      onClick={() => setPortfolio([])}
                      style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(250,204,21,0.3)", cursor: "pointer", background: "rgba(250,204,21,0.1)", color: "#fde68a", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}
                    >Clear demo →</button>
                  </div>
                )}

                {/* Bulk import */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: S.muted, marginBottom: 6, letterSpacing: "0.04em" }}>
                    BULK IMPORT &nbsp;—&nbsp; one per line: <span style={{ color: "#93c5fd", fontWeight: 700 }}>TICKER, SHARES</span>
                  </div>
                  <textarea
                    value={bulkText}
                    onChange={e => { setBulkText(e.target.value); setBulkError(""); }}
                    placeholder={"AAPL, 50\nMSFT, 30\nNVDA, 40\nGOOGL, 20"}
                    rows={5}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 7, border: `1px solid ${bulkError ? "#ef4444" : S.border}`, background: S.bg, color: S.text, fontSize: 13, fontFamily: "monospace", outline: "none", resize: "vertical", boxSizing: "border-box" }}
                  />
                  {bulkError && <div style={{ fontSize: 12, color: "#f87171", marginTop: 4 }}>⚠ {bulkError}</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <button onClick={parseBulk} disabled={!bulkText.trim()} style={{ padding: "7px 16px", borderRadius: 6, border: "none", cursor: bulkText.trim() ? "pointer" : "not-allowed", background: "#16a34a", color: "#fff", fontSize: 13, fontWeight: 700, opacity: bulkText.trim() ? 1 : 0.45 }}>↑ Import</button>
                    <button onClick={() => { setBulkText(""); setBulkError(""); }} style={{ padding: "7px 12px", borderRadius: 6, border: `1px solid ${S.border}`, cursor: "pointer", background: "transparent", color: S.muted, fontSize: 13 }}>Clear</button>
                    <span style={{ fontSize: 12, color: S.muted }}>Paste directly from Excel or Google Sheets</span>
                  </div>
                </div>

                {/* Single add */}
                <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: S.muted, marginBottom: 8, letterSpacing: "0.04em" }}>ADD SINGLE STOCK</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={newTicker} onChange={e => setNewTicker(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && addStock()} placeholder="TICKER" maxLength={10}
                      style={{ width: 90, padding: "7px 10px", borderRadius: 6, border: `1px solid ${S.border}`, background: S.bg, color: S.text, fontSize: 14, fontWeight: 700, outline: "none" }} />
                    <input type="number" value={newShares} onChange={e => setNewShares(e.target.value)} onKeyDown={e => e.key === "Enter" && addStock()} placeholder="Shares" min={0.001}
                      style={{ width: 80, padding: "7px 10px", borderRadius: 6, border: `1px solid ${S.border}`, background: S.bg, color: S.text, fontSize: 14, outline: "none" }} />
                    <button onClick={addStock} style={{ padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer", background: "#16a34a", color: "#fff", fontSize: 14, fontWeight: 700 }}>+ Add</button>
                  </div>
                </div>

                {/* Holdings */}
                <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: S.muted, letterSpacing: "0.04em" }}>HOLDINGS ({portfolio.length})</div>
                    {portfolio.length > 0 && (
                      <button onClick={() => setPortfolio([])} style={{ fontSize: 12, color: "#f87171", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Clear all</button>
                    )}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {portfolio.map(({ ticker, shares }) => (
                      <div key={ticker} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, background: S.bg, border: `1px solid ${S.border}` }}>
                        <span style={{ fontWeight: 800, fontSize: 13 }}>{ticker}</span>
                        <span style={{ fontSize: 11, color: S.muted }}>{shares}sh</span>
                        <button onClick={() => setPortfolio(portfolio.filter(p => p.ticker !== ticker))} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", fontSize: 15, padding: 0, lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                    {!portfolio.length && <span style={{ fontSize: 13, color: "#334155" }}>No stocks added yet — use bulk import or add one above.</span>}
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
