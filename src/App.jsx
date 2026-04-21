import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { computeTreemap, perfColor, tileFgColor, IS_DEMO, applySnapshot, applyEvent } from "./utils.js";
import { THEMES, SWATCHES, useTheme } from "./theme.js";
import SmartInput from "./SmartInput.jsx";

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

// ─── History Chart ────────────────────────────────────────────────
function HistoryChart({ history, events, S }) {
  const [hover, setHover] = useState(null);       // index of hovered line point
  const [hovEvent, setHovEvent] = useState(null); // hovered event marker object
  const hovEventRef = useRef(null);               // sync ref so handleMouseMove can read it
  const svgRef = useRef(null);

  const fmtVal = (v) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  };
  const fmtDate = (d) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const setHovEventSync = (v) => { hovEventRef.current = v; setHovEvent(v); };

  if (history.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "60px 20px", color: S.muted, textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>📈</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: S.muted }}>No history yet</div>
        <div style={{ fontSize: 13, maxWidth: 340, lineHeight: 1.6 }}>
          Portfolio value is recorded each weekday after a refresh. Hit Refresh on a market day to start tracking.
        </div>
      </div>
    );
  }

  const W = 800, H = 260;
  const PAD = { top: 24, right: 24, bottom: 44, left: 78 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const vals = history.map(h => h.value);
  const rawMin = Math.min(...vals), rawMax = Math.max(...vals);
  const pad = (rawMax - rawMin) * 0.12 || rawMax * 0.05 || 1000;
  const minVal = rawMin - pad, maxVal = rawMax + pad;
  const valRange = maxVal - minVal;

  const xScale = (i) => PAD.left + (history.length <= 1 ? cW / 2 : (i / (history.length - 1)) * cW);
  const yScale = (v) => PAD.top + cH - ((v - minVal) / valRange) * cH;

  const pts = history.map((h, i) => ({ x: xScale(i), y: yScale(h.value) }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const yTicks = Array.from({ length: 5 }, (_, i) => minVal + (i / 4) * valRange);

  const xLabels = [];
  if (history.length <= 6) {
    history.forEach((h, i) => xLabels.push({ i, label: fmtDate(h.date) }));
  } else {
    let prevMonth = null;
    history.forEach((h, i) => {
      const m = h.date.slice(0, 7);
      if (m !== prevMonth) { xLabels.push({ i, label: fmtDate(h.date) }); prevMonth = m; }
    });
  }

  const eventMarkers = [];
  const seenEvtDates = new Set();
  events.forEach(ev => {
    if (seenEvtDates.has(ev.date)) return;
    seenEvtDates.add(ev.date);
    let nearestIdx = 0, nearestDiff = Infinity;
    history.forEach((h, i) => {
      const diff = Math.abs(new Date(h.date + "T12:00:00") - new Date(ev.date + "T12:00:00"));
      if (diff < nearestDiff) { nearestDiff = diff; nearestIdx = i; }
    });
    const dateEvts = events.filter(e => e.date === ev.date);
    const hasAdd = dateEvts.some(e => e.type === "add" || e.type === "update");
    const hasRemove = dateEvts.some(e => e.type === "remove");
    const color = hasAdd && hasRemove ? "#facc15" : hasRemove ? "#f87171" : S.green;
    eventMarkers.push({ date: ev.date, evts: dateEvts, x: xScale(nearestIdx), color });
  });

  // Only track the line hover when not over an event bubble
  const handleMouseMove = (e) => {
    if (!svgRef.current || history.length === 0 || hovEventRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width * W;
    let closest = 0, closestDist = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(p.x - mx); if (d < closestDist) { closestDist = d; closest = i; } });
    setHover(closest);
  };

  const hovPt = hover != null && !hovEvent ? pts[hover] : null;
  const hovH  = hover != null && !hovEvent ? history[hover] : null;
  const trend = vals.length >= 2 ? vals[vals.length - 1] - vals[0] : 0;
  const lineColor = trend >= 0 ? S.green : "#f87171";

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setHover(null); setHovEventSync(null); }}
      >
        <defs>
          <linearGradient id="histAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.18} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        {yTicks.map((v, i) => {
          const y = yScale(v);
          return (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke={S.chartGrid} strokeWidth={1} />
              <text x={PAD.left - 8} y={y} textAnchor="end" dominantBaseline="middle" fill={S.chartLabel} fontSize={10}>{fmtVal(v)}</text>
            </g>
          );
        })}
        {xLabels.map(({ i, label }) => (
          <text key={i} x={xScale(i)} y={H - 6} textAnchor="middle" fill={S.chartLabel} fontSize={10}>{label}</text>
        ))}
        {/* Event marker lines + bubbles — intercept mouse so line hover stays off */}
        {eventMarkers.map((em) => (
          <g
            key={em.date}
            onMouseEnter={() => { setHover(null); setHovEventSync(em); }}
            onMouseLeave={() => setHovEventSync(null)}
            onMouseMove={e => e.stopPropagation()}
            style={{ cursor: "default" }}
          >
            <line x1={em.x} x2={em.x} y1={PAD.top} y2={PAD.top + cH} stroke={em.color} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.65} />
            {/* wider invisible hit area for easier targeting */}
            <line x1={em.x} x2={em.x} y1={PAD.top} y2={PAD.top + cH} stroke="transparent" strokeWidth={14} />
            <circle cx={em.x} cy={PAD.top + 2} r={5} fill={em.color} />
          </g>
        ))}
        {history.length > 1 && (
          <path
            d={`${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(PAD.top + cH).toFixed(1)} L${pts[0].x.toFixed(1)},${(PAD.top + cH).toFixed(1)} Z`}
            fill="url(#histAreaGrad)"
          />
        )}
        {history.length > 1 && (
          <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {history.length === 1 && <circle cx={pts[0].x} cy={pts[0].y} r={5} fill={lineColor} />}
        {hovPt && (
          <g>
            <line x1={hovPt.x} x2={hovPt.x} y1={PAD.top} y2={PAD.top + cH} stroke={S.chartCross} strokeWidth={1} strokeDasharray="3,3" />
            <circle cx={hovPt.x} cy={hovPt.y} r={5} fill={lineColor} stroke={S.bg} strokeWidth={2} />
          </g>
        )}
      </svg>

      {/* Event bubble tooltip — shows portfolio changes only */}
      {hovEvent && (() => {
        const leftPct = (hovEvent.x / W) * 100;
        return (
          <div style={{
            position: "absolute", top: "13%",
            left: leftPct > 65 ? "auto" : `${leftPct}%`,
            right: leftPct > 65 ? `${100 - leftPct}%` : "auto",
            transform: leftPct <= 65 ? "translateX(-50%)" : "none",
            background: S.tooltip, border: `1px solid ${hovEvent.color}44`,
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            borderRadius: 8, padding: "8px 12px", pointerEvents: "none", zIndex: 10, minWidth: 148,
          }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 5 }}>
              {new Date(hovEvent.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </div>
            {hovEvent.evts.map((ev, i) => (
              <div key={i} style={{ lineHeight: 1.7 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5, fontSize: 12, fontWeight: 600,
                  color: ev.type === "add" ? S.green : ev.type === "remove" ? "#f87171" : S.link }}>
                  <span style={{ fontWeight: 800 }}>{ev.type === "add" ? "+" : ev.type === "remove" ? "−" : "~"}</span>
                  <span>{ev.ticker}</span>
                  <span style={{ color: S.muted, fontWeight: 400 }}>
                    {ev.type === "update" ? `${ev.prevShares} → ${ev.shares}sh` : `${ev.shares}sh`}
                  </span>
                </div>
                {ev.note && (
                  <div style={{ fontSize: 10, color: S.muted, fontStyle: "italic", marginTop: -2, maxWidth: 180, lineHeight: 1.4 }}>
                    {ev.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Line tooltip — shows value + daily % change only, no events */}
      {hovH && hovPt && (() => {
        const leftPct = (hovPt.x / W) * 100;
        return (
          <div style={{
            position: "absolute", top: 8,
            left: leftPct > 65 ? "auto" : `${leftPct}%`,
            right: leftPct > 65 ? `${100 - leftPct}%` : "auto",
            transform: leftPct <= 65 ? "translateX(-50%)" : "none",
            background: S.tooltip, border: `1px solid ${S.border}`, borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: "8px 12px", pointerEvents: "none", zIndex: 10, minWidth: 148,
          }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 2 }}>
              {new Date(hovH.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: S.text }}>{fmtVal(hovH.value)}</div>
            {hovH.change != null && (
              <div style={{ fontSize: 12, fontWeight: 700, color: hovH.change >= 0 ? S.green : "#f87171" }}>
                {hovH.change >= 0 ? "▲" : "▼"} {Math.abs(hovH.change).toFixed(2)}% today
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}


// S is now instantiated per-render inside App() based on theme

// ─── Main ─────────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useTheme();
  const S = THEMES[theme];

  // Sync body background with theme
  useEffect(() => { document.body.style.background = S.bg; }, [S.bg]);

  const [apiKey,        setApiKey]        = useState(() => localStorage.getItem("ph_apikey") || "");
  const [apiInput,      setApiInput]      = useState(() => localStorage.getItem("ph_apikey") || "");
  const [portfolioName, setPortfolioName] = useState(() => localStorage.getItem("ph_name") || "Portfolio Heatmap");
  const [portfolio,     setPortfolio]     = useState(() => {
    try { return JSON.parse(localStorage.getItem("ph_portfolio")) || DEFAULT_PORTFOLIO; }
    catch { return DEFAULT_PORTFOLIO; }
  });
  const [editingEventIdx,  setEditingEventIdx]  = useState(null);
  const [editingNote,      setEditingNote]      = useState("");
  const [hoveredEventIdx,  setHoveredEventIdx]  = useState(null);
  const [stockData,    setStockData]    = useState({});
  const [loading,      setLoading]      = useState(false);
  const [fetchErrors,  setFetchErrors]  = useState({});
  const [tab,          setTab]          = useState("heatmap");
  const [tooltip,      setTooltip]      = useState(null);
  const [privacyMode,  setPrivacyMode]  = useState(true);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(
    () => !localStorage.getItem("ph_privacy_seen")
  );
  const [isDemo, setIsDemo] = useState(() => IS_DEMO("ph_portfolio"));
  const [rateLimitSecs, setRateLimitSecs] = useState(0);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ph_history")) || []; }
    catch { return []; }
  });
  const [portfolioEvents, setPortfolioEvents] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ph_events")) || []; }
    catch { return []; }
  });
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
    const collected = {}; // accumulate locally to compute snapshot after loop

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
          prevClose: q.pc,
          today: q.dp,
          ytd:   ret(c1y, ts.ytd),
          "3m":  ret(c1y, ts["3m"]),
          "6m":  ret(c1y, ts["6m"]),
          "1y":  ret(c1y, ts["1y"]),
          "5y":  ret(c5y, ts["5y"]),
        };
        collected[ticker] = entry;
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

    // Snapshot: record current value + prev-close value so history % matches header
    {
      let currentVal = 0, prevCloseVal = 0;
      for (const { ticker, shares } of portfolio) {
        const d = collected[ticker];
        if (d?.price)    currentVal  += d.price    * shares;
        if (d?.prevClose) prevCloseVal += d.prevClose * shares;
      }
      recordDailySnapshot(currentVal, prevCloseVal);
    }

    if (!silent) {
      setFetchErrors(errs);
      setLoading(false);
    }
  }, [apiKey, portfolio, isDemo]); // recordDailySnapshot omitted — declared after fetchData, dep on isDemo covers it

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
    let currentVal = 0, prevCloseVal = 0;
    for (const { ticker, shares } of portfolio) {
      const d = stockData[ticker];
      if (!d?.price || !d?.prevClose) continue;
      currentVal  += d.price    * shares;
      prevCloseVal += d.prevClose * shares;
    }
    return prevCloseVal > 0 ? ((currentVal - prevCloseVal) / prevCloseVal) * 100 : null;
  }, [stockData, portfolio]);

  // Record today's snapshot and retroactively correct yesterday's entry to its
  // official EOD value — so history % always uses the same baseline as the header.
  //
  // Header formula:  (currentVal − prevCloseVal) / prevCloseVal
  // History formula: same — prevCloseVal = sum(q.pc × shares) for all stocks
  //
  // Retroactive correction: q.pc is yesterday's official close, so each refresh
  // patches yesterday's entry to that close price, keeping past chart values EOD-accurate.
  const recordDailySnapshot = useCallback((currentVal, prevCloseVal) => {
    if (isDemo || currentVal <= 0) return;
    const now = new Date();
    if (now.getDay() === 0 || now.getDay() === 6) return; // skip weekends
    const dateStr = now.toISOString().split("T")[0];

    setHistory(prev => {
      let base = prev;

      // Patch the previous trading day's entry to its official close value
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

      // Today: change vs official prev close = exact same number as the header
      const todayChange = prevCloseVal > 0
        ? ((currentVal - prevCloseVal) / prevCloseVal) * 100
        : null;
      const next = applySnapshot(base, dateStr, currentVal, todayChange);
      localStorage.setItem("ph_history", JSON.stringify(next));
      return next;
    });
  }, [isDemo]);

  // Seed realistic demo history + events for visual testing
  const seedDemoHistory = useCallback(() => {
    const demoHistory = [];
    const demoEvents = [];
    let value = 68400;
    const today = new Date();
    // Walk back 60 calendar days, collect ~42 weekday entries
    for (let daysBack = 59; daysBack >= 0; daysBack--) {
      const d = new Date(today);
      d.setDate(d.getDate() - daysBack);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends
      const dateStr = d.toISOString().split("T")[0];
      // Simulate daily drift: slight upward bias + noise
      const dailyChange = (Math.random() - 0.44) * 3.2;
      value = value * (1 + dailyChange / 100);
      demoHistory.push({ date: dateStr, value: Math.round(value * 100) / 100, change: +dailyChange.toFixed(2) });
    }
    // Scatter 6 portfolio events on random weekdays
    const eventDefs = [
      { type: "add",    ticker: "NVDA",  shares: 5,  note: "AI momentum, added on dip" },
      { type: "add",    ticker: "MSFT",  shares: 10, note: "Rebalancing tech allocation" },
      { type: "remove", ticker: "XOM",   shares: 20, note: "Rotating out of energy" },
      { type: "update", ticker: "AAPL",  shares: 15, prevShares: 8, note: "Doubled down after earnings" },
      { type: "add",    ticker: "META",  shares: 3  },
      { type: "remove", ticker: "F",     shares: 50, note: "Cut losses, EV thesis failed" },
    ];
    const weekdays = demoHistory.map(h => h.date);
    // Space events evenly across the weekdays
    const step = Math.floor(weekdays.length / (eventDefs.length + 1));
    eventDefs.forEach((ev, i) => {
      const date = weekdays[step * (i + 1)];
      if (!date) return;
      demoEvents.push({ date, time: "10:32:00", ...ev });
    });
    setHistory(demoHistory);
    setPortfolioEvents(demoEvents);
    localStorage.setItem("ph_history", JSON.stringify(demoHistory));
    localStorage.setItem("ph_events",  JSON.stringify(demoEvents));
  }, []);

  // Record a portfolio change event (add / remove / update)
  const recordPortfolioEvent = useCallback((type, ticker, shares, prevShares = null, note = null) => {
    if (isDemo) return;
    const now = new Date();
    const event = {
      date: now.toISOString().split("T")[0],
      time: now.toTimeString().split(" ")[0],
      type, ticker, shares,
      ...(prevShares != null ? { prevShares } : {}),
      ...(note ? { note } : {}),
    };
    setPortfolioEvents(prev => {
      const next = applyEvent(prev, event);
      localStorage.setItem("ph_events", JSON.stringify(next));
      return next;
    });
  }, [isDemo]);

  const saveEventNote = useCallback((idx, noteText) => {
    setPortfolioEvents(prev => {
      const next = prev.map((ev, i) => {
        if (i !== idx) return ev;
        const trimmed = noteText.trim();
        const updated = { ...ev };
        if (trimmed) updated.note = trimmed;
        else delete updated.note;
        return updated;
      });
      localStorage.setItem("ph_events", JSON.stringify(next));
      return next;
    });
    setEditingEventIdx(null);
    setHoveredEventIdx(null);
  }, []);

  const handleSmartApply = useCallback((mutations) => {
    let next = [...portfolio];
    for (const m of mutations) {
      if (m.type === "create") {
        next = [...next, { ticker: m.ticker, shares: m.shares }];
        recordPortfolioEvent("add", m.ticker, m.shares);
      } else if (m.type === "update") {
        next = next.map(p => p.ticker === m.ticker ? { ...p, shares: m.shares } : p);
        recordPortfolioEvent("update", m.ticker, m.shares, m.prevShares);
      } else if (m.type === "remove") {
        next = next.filter(p => p.ticker !== m.ticker);
        recordPortfolioEvent("remove", m.ticker, m.prevShares);
      }
    }
    setPortfolio(next);
  }, [portfolio, recordPortfolioEvent]);

  const btnBase = (active) => ({
    padding: "5px 13px", borderRadius: 6,
    border: active ? `1px solid ${S.tabActiveBorder}` : `1px solid ${S.border}`,
    cursor: "pointer", fontSize: 13, fontWeight: 500, transition: "all .15s",
    background: active ? S.tabActiveBg : S.panel,
    color: active ? S.tabActiveText : S.muted,
  });

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: S.bg, color: S.text, height: "100vh", display: "flex", flexDirection: "column", userSelect: "none" }}>

      {/* First-run privacy notice */}
      {showPrivacyNotice && (
        <div style={{
          position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 200, width: "min(580px, calc(100vw - 40px))",
          background: S.tooltip, border: "1px solid rgba(74,222,128,0.25)",
          borderRadius: 14, padding: "18px 20px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          display: "flex", alignItems: "flex-start", gap: 14,
        }}>
          <div style={{ fontSize: 22, flexShrink: 0 }}>🔒</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: S.strong, marginBottom: 4 }}>
              Your portfolio never leaves your device
            </div>
            <div style={{ fontSize: 13, color: S.muted, lineHeight: 1.6 }}>
              Your tickers, share counts, and API key are stored only in <strong style={{ color: S.code }}>your browser's localStorage</strong>.
              Stock prices are fetched directly from Finnhub — nothing passes through our servers.
              We never see your holdings.
            </div>
          </div>
          <button
            onClick={() => { setShowPrivacyNotice(false); localStorage.setItem("ph_privacy_seen", "1"); }}
            style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer", background: S.greenDim, color: S.green, fontSize: 12, fontWeight: 700 }}
          >Got it</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "8px 12px" : "12px 18px", borderBottom: `1px solid ${S.border}`, flexShrink: 0, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 12, minWidth: 0 }}>
          <a href="/" title="Back to Karta home" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none", color: "inherit", minWidth: 0 }}>
            <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              {[["#2a6040","#3a7a52","#4a9966"],["#3a7a52","#4a9966","#5ab878"],["#4a9966","#5ab878","#4ade80"],["#235238","#4a9966","#22c55e"]].map((row, ri) =>
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
            <span style={{ fontSize: 13, fontWeight: 700, color: aggReturn >= 0 ? S.green : "#f87171", flexShrink: 0 }}>
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
              background: S.greenDim,
              fontSize: 11, color: S.green, fontWeight: 600,
              cursor: "default", letterSpacing: "0.02em",
            }}>
              🔒 Local only
            </div>
          )}
          {[
            { key: "heatmap",  label: "Heatmap",  short: "Map"  },
            { key: "table",    label: "Table",     short: "Table" },
            { key: "history",  label: "History",   short: "Hist" },
            { key: "setup",    label: "Setup",     short: "Setup" },
          ].map(({ key, label, short }) => (
            <button key={key} onClick={() => {
              setTab(key);
              if (key === "heatmap" && !loading && rateLimitSecs <= 0) fetchData(apiKey, true);
            }} style={{ ...btnBase(tab === key), textTransform: "capitalize", padding: isMobile ? "5px 9px" : "5px 13px", fontSize: isMobile ? 12 : 13 }}>
              {isMobile ? short : label}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      {tab !== "setup" && tab !== "history" && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderBottom: `1px solid ${S.border}`, flexShrink: 0 }}>
          <div style={{ flex: 1 }} />
          {Object.keys(fetchErrors).length > 0 && (
            <span style={{ fontSize: 12, color: "#f87171" }}>⚠ {Object.keys(fetchErrors).length} error(s)</span>
          )}
          <button
            onClick={() => fetchData(apiKey, true)}
            disabled={loading || rateLimitSecs > 0}
            style={{ padding: "5px 14px", borderRadius: 6, border: "none", cursor: loading || rateLimitSecs > 0 ? "not-allowed" : "pointer", background: loading ? S.panel : S.accent, color: loading ? S.muted : "#fff", fontSize: 13, fontWeight: 600, opacity: rateLimitSecs > 0 ? 0.5 : 1 }}
          >
            {loading ? "⟳ Loading…" : rateLimitSecs > 0
              ? `⟳ ${Math.floor(rateLimitSecs / 60)}:${String(rateLimitSecs % 60).padStart(2, "0")}`
              : "⟳ Refresh"}
          </button>
        </div>
      )}

      {/* Shared-key nudge — visible when user hasn't set their own API key */}
      {!apiKey && tab !== "setup" && tab !== "history" && (
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
              <span style={{ color: S.subtext }}>·</span>
              <button onClick={() => setTab("setup")} style={{ background: "none", border: "none", cursor: "pointer", color: S.link, fontSize: 12, fontWeight: 600, padding: 0 }}>
                Get your own key for unlimited refreshes →
              </button>
            </>
          ) : (
            <>
              <span>{isMobile ? "Shared key · 15 min cache" : "Using Karta's shared key — prices cached every 15 min"}</span>
              <span style={{ color: S.subtext }}>·</span>
              <button onClick={() => setTab("setup")} style={{ background: "none", border: "none", cursor: "pointer", color: S.link, fontSize: 12, fontWeight: 600, padding: 0 }}>
                {isMobile ? "Get your own key →" : "Get your own free key →"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Content — all tabs always mounted, toggled via CSS display */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>

        {/* ━━━ HEATMAP ━━━ */}
        <div style={{ position: "absolute", inset: 0, display: tab === "heatmap" ? "block" : "none", padding: isMobile ? 8 : 16 }}>
          {/* Floating card that contains the entire heatmap */}
          <div style={{
            position: "relative", width: "100%", height: "100%",
            borderRadius: isMobile ? 10 : 16,
            border: `1px solid ${S.border}`,
            overflow: "hidden",
            background: S.panel,
            boxShadow: "0 4px 32px rgba(0,0,0,0.18), 0 1px 6px rgba(0,0,0,0.10)",
          }}>

            {/* Loading overlay */}
            {loading && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, background: S.overlay, pointerEvents: "none" }}>
                <div style={{ background: S.panel, border: `1px solid ${S.border}`, padding: "12px 24px", borderRadius: 10, fontSize: 14, color: S.muted }}>
                  Fetching {portfolio.length} stocks…
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loading && Object.keys(stockData).length === 0 && !isDemo && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <div style={{ fontSize: 36 }}>📊</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>No data loaded yet</div>
                <button onClick={() => fetchData()} style={{ marginTop: 4, padding: "7px 20px", borderRadius: 6, border: "none", cursor: "pointer", background: S.accent, color: "#fff", fontSize: 13, fontWeight: 600 }}>Load Portfolio Data</button>
              </div>
            )}

            {/* Demo banner */}
            {isDemo && !loading && (
              <div style={{
                position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
                zIndex: 20, whiteSpace: "nowrap",
                background: S.overlay, backdropFilter: "blur(10px)",
                border: "1px solid rgba(250,204,21,0.3)",
                borderRadius: 10, padding: "9px 18px",
                display: "flex", alignItems: "center", gap: 10,
                boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
              }}>
                <span style={{ fontSize: 14 }}>✨</span>
                <span style={{ fontSize: 13, color: "#fde68a", fontWeight: 600 }}>Demo portfolio</span>
                <span style={{ color: S.subtext, fontSize: 13 }}>·</span>
                <span style={{ fontSize: 13, color: S.muted }}>Customize it for your holdings</span>
                <span style={{ color: S.subtext, fontSize: 13 }}>—</span>
                <button
                  onClick={() => setTab("setup")}
                  style={{ fontSize: 12, fontWeight: 700, color: S.green, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", textUnderlineOffset: 3 }}
                >Set up yours →</button>
              </div>
            )}

            {/* Onboarding hints */}
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
                    background: S.overlay, backdropFilter: "blur(8px)",
                    border: `1px solid ${S.border}`,
                    color: S.muted, fontSize: 12, fontWeight: 500,
                    cursor: "pointer", transition: "color 0.15s, border-color 0.15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.color = S.text; e.currentTarget.style.borderColor = S.green + "44"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = S.muted; e.currentTarget.style.borderColor = S.border; }}
                  >
                    <span style={{ fontSize: 13 }}>{hint.icon}</span>
                    {hint.label}
                    <span style={{ color: S.green, fontSize: 11 }}>→</span>
                  </button>
                ))}
              </div>
            )}

            {/* Tiles */}
            <div ref={containerRef} style={{ position: "absolute", inset: 0 }} onClick={isMobile ? () => setTooltip(null) : undefined}>
              {rects.map(rect => {
                const gap = 3;
                const bx = rect.x + gap, by = rect.y + gap;
                const bw = rect.w - gap * 2, bh = rect.h - gap * 2;
                if (bw < 4 || bh < 4) return null;
                const showTicker = bw > 30 && bh > 20;
                const showPerf   = bw > 55 && bh > 42;
                const showPrice  = bw > 76 && bh > 60;
                const fg = tileFgColor(rect.perf);
                return (
                  <div
                    key={rect.id}
                    style={{
                      position: "absolute", left: bx, top: by, width: bw, height: bh,
                      background: perfColor(rect.perf),
                      borderRadius: 7,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      overflow: "hidden",
                      transition: "filter .15s",
                      cursor: isMobile ? "pointer" : "default",
                      boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.10)",
                    }}
                    onMouseEnter={isMobile ? undefined : e => { e.currentTarget.style.filter = "brightness(0.93)"; setTooltip(rect); }}
                    onMouseLeave={isMobile ? undefined : e => { e.currentTarget.style.filter = ""; setTooltip(null); }}
                    onClick={isMobile ? e => { e.stopPropagation(); setTooltip(tooltip?.id === rect.id ? null : rect); } : undefined}
                  >
                    {showTicker && <div style={{ fontSize: Math.max(9, Math.min(20, bw / 5.5)), fontWeight: 700, color: fg.primary, lineHeight: 1.1, letterSpacing: "-0.01em" }}>{rect.ticker}</div>}
                    {showPerf  && rect.perf !== null && <div style={{ fontSize: Math.max(8, Math.min(14, bw / 7.5)), fontWeight: 600, color: fg.secondary, lineHeight: 1.3 }}>{rect.perf >= 0 ? "+" : ""}{rect.perf.toFixed(2)}%</div>}
                    {showPrice && rect.price && <div style={{ fontSize: Math.max(7, Math.min(11, bw / 10)), color: fg.tertiary, lineHeight: 1.3 }}>${rect.price.toFixed(2)}</div>}
                  </div>
                );
              })}

              {/* Tooltip */}
              {tooltip && (
                <div style={{ position: "absolute", bottom: 52, left: 16, background: S.tooltip, border: `1px solid ${S.border}`, boxShadow: "0 6px 24px rgba(0,0,0,0.18)", borderRadius: 10, padding: "11px 15px", pointerEvents: isMobile ? "auto" : "none", zIndex: 20, minWidth: 164 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.01em" }}>{tooltip.ticker}</div>
                    {isMobile && <button onClick={() => setTooltip(null)} style={{ background: "none", border: "none", color: S.muted, fontSize: 18, cursor: "pointer", padding: "0 0 0 12px", lineHeight: 1 }}>×</button>}
                  </div>
                  {tooltip.price && <div style={{ fontSize: 13, color: S.muted }}>Price: <strong style={{ color: S.text }}>${tooltip.price.toFixed(2)}</strong></div>}
                  {tooltip.perf !== null && <div style={{ fontSize: 13, color: tooltip.perf >= 0 ? S.green : "#f87171", fontWeight: 700, marginTop: 2 }}>Today: {tooltip.perf >= 0 ? "+" : ""}{tooltip.perf.toFixed(2)}%</div>}
                  <div style={{ fontSize: 12, color: S.muted, marginTop: 5, paddingTop: 5, borderTop: `1px solid ${S.border}` }}>{((getWeight(tooltip.ticker) / totalValue) * 100).toFixed(1)}% of portfolio</div>
                </div>
              )}

              {/* Legend */}
              {rects.length > 0 && (
                <div style={{ position: "absolute", bottom: 12, right: 14, display: "flex", alignItems: "center", gap: 3, background: S.overlay, backdropFilter: "blur(6px)", padding: "5px 10px", borderRadius: 8, fontSize: 10, color: S.muted, letterSpacing: "0.03em" }}>
                  <span>−8%</span>
                  {LEGEND_STOPS.map(v => <div key={v} style={{ width: 13, height: 13, background: perfColor(v), borderRadius: 3 }} />)}
                  <span>+8%</span>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ━━━ TABLE ━━━ */}
        <div style={{ position: "absolute", inset: 0, overflow: "auto", display: tab === "table" ? "block" : "none", padding: "20px" }}>
          {Object.keys(stockData).length === 0 ? (
            <div style={{ textAlign: "center", color: S.muted, padding: 48, fontSize: 14 }}>Load data using the Refresh button above.</div>
          ) : (
            <div style={{ maxWidth: 1020, margin: "0 auto", overflowX: "auto", WebkitOverflowScrolling: "touch", background: S.panel, borderRadius: 10, border: `1px solid ${S.border}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${S.border}`, position: "sticky", top: 0, background: S.panel }}>
                  {["Ticker", "Price", "Shares", "Value", "Weight", "Today"].map((h, i) => (
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
                    <tr key={ticker} style={{ borderBottom: `1px solid ${S.rowBorder}` }}>
                      <td style={{ padding: "9px 14px", fontWeight: 800, fontSize: 14 }}>{ticker}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right" }}>${d.price.toFixed(2)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", color: S.muted }}>{shares}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 600 }}>${val.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", color: S.muted }}>{w.toFixed(1)}%</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", color: d.today == null ? S.subtext : d.today >= 0 ? S.green : "#f87171", fontWeight: 600 }}>
                        {d.today == null ? "—" : `${d.today >= 0 ? "+" : ""}${d.today.toFixed(2)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* ━━━ HISTORY ━━━ */}
        <div style={{ position: "absolute", inset: 0, overflow: "auto", display: tab === "history" ? "block" : "none", padding: 20 }}>
          <div style={{ maxWidth: 1020, margin: "0 auto" }}>

            {/* Summary stat cards */}
            {history.length >= 2 && (() => {
              const first = history[0], last = history[history.length - 1];
              const totalChange = ((last.value - first.value) / first.value) * 100;

              // % change since last portfolio composition change (last add/remove/update event)
              const lastEventDate = portfolioEvents.length > 0
                ? portfolioEvents.reduce((max, ev) => ev.date > max ? ev.date : max, portfolioEvents[0].date)
                : null;
              // First history entry AFTER the last event date (skip the change day itself)
              const baseEntry = lastEventDate ? history.find(h => h.date > lastEventDate) : null;
              // Only show if the baseline isn't the same as the most recent entry (needs at least 1 day of data after the change)
              const changeSinceLastPortfolioChange = baseEntry && baseEntry.date !== last.date
                ? ((last.value - baseEntry.value) / baseEntry.value) * 100
                : null;

              const cards = [
                { label: "Current Value", value: `$${last.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}` },
                { label: "Since First Record", value: `${totalChange >= 0 ? "+" : ""}${totalChange.toFixed(2)}%`, color: totalChange >= 0 ? S.green : "#f87171" },
                ...(changeSinceLastPortfolioChange !== null ? [{
                  label: "Since Last Portfolio Change",
                  value: `${changeSinceLastPortfolioChange >= 0 ? "+" : ""}${changeSinceLastPortfolioChange.toFixed(2)}%`,
                  color: changeSinceLastPortfolioChange >= 0 ? S.green : "#f87171",
                  sub: new Date(baseEntry.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                }] : []),
                { label: "Tracking Since", value: new Date(first.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) },
                { label: "Days Recorded", value: `${history.length}` },
              ];

              return (
                <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                  {cards.map(s => (
                    <div key={s.label} style={{ background: S.panel, borderRadius: 8, border: `1px solid ${S.border}`, padding: "10px 16px", flex: "1 1 140px" }}>
                      <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: s.color || S.text }}>{s.value}</div>
                      {s.sub && <div style={{ fontSize: 10, color: S.subtext, marginTop: 2 }}>from {s.sub}</div>}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Chart card */}
            <div style={{ background: S.panel, borderRadius: 10, border: `1px solid ${S.border}`, padding: "16px 4px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 12px", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.text }}>Portfolio Value — 1 Year</div>
                  {history.length === 0 && (
                    <button
                      onClick={seedDemoHistory}
                      style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 5, border: "1px solid rgba(250,204,21,0.3)", background: "rgba(250,204,21,0.08)", color: "#fde68a", cursor: "pointer" }}
                    >Load demo data</button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 11, color: S.muted }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />Added
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f87171", display: "inline-block" }} />Removed
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#facc15", display: "inline-block" }} />Mixed
                  </span>
                </div>
              </div>
              <HistoryChart history={history} events={portfolioEvents} S={S} />
            </div>

            {/* Portfolio changes list */}
            {portfolioEvents.length > 0 && (
              <div style={{ background: S.panel, borderRadius: 10, border: `1px solid ${S.border}`, marginTop: 16, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${S.border}`, fontSize: 13, fontWeight: 700, color: S.text }}>
                  Portfolio Changes ({portfolioEvents.length})
                </div>
                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {[...portfolioEvents].reverse().map((ev, i) => {
                    const origIdx = portfolioEvents.length - 1 - i;
                    const isEditing = editingEventIdx === origIdx;
                    const isHovered = hoveredEventIdx === origIdx;
                    return (
                      <div
                        key={i}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderBottom: `1px solid ${S.rowBorder}`, background: isEditing ? S.bg : "transparent", transition: "background 0.12s" }}
                        onMouseEnter={() => setHoveredEventIdx(origIdx)}
                        onMouseLeave={() => setHoveredEventIdx(null)}
                      >
                        <span style={{ fontSize: 15, fontWeight: 800, color: ev.type === "add" ? S.green : ev.type === "remove" ? "#f87171" : S.link, minWidth: 14 }}>
                          {ev.type === "add" ? "+" : ev.type === "remove" ? "−" : "~"}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: 13, minWidth: 56 }}>{ev.ticker}</span>
                        <span style={{ fontSize: 12, color: S.muted, whiteSpace: "nowrap" }}>
                          {ev.type === "add"    ? `Added ${ev.shares} shares`
                            : ev.type === "remove" ? `Removed ${ev.shares} shares`
                            : `Updated: ${ev.prevShares} → ${ev.shares} shares`}
                        </span>

                        {/* Note — static text or inline edit input */}
                        {isEditing ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
                            <input
                              autoFocus
                              value={editingNote}
                              onChange={e => setEditingNote(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") saveEventNote(origIdx, editingNote);
                                if (e.key === "Escape") { setEditingEventIdx(null); }
                              }}
                              placeholder="Add a note…"
                              maxLength={160}
                              style={{ flex: 1, minWidth: 0, padding: "3px 8px", borderRadius: 5, border: `1px solid ${S.green}55`, background: S.inputBg, color: S.text, fontSize: 12, outline: "none", fontStyle: "italic" }}
                            />
                            <button
                              onClick={() => saveEventNote(origIdx, editingNote)}
                              title="Save (Enter)"
                              style={{ background: "none", border: "none", cursor: "pointer", color: S.green, fontSize: 15, padding: "0 2px", lineHeight: 1, flexShrink: 0 }}
                            >✓</button>
                            <button
                              onClick={() => setEditingEventIdx(null)}
                              title="Cancel (Esc)"
                              style={{ background: "none", border: "none", cursor: "pointer", color: S.muted, fontSize: 13, padding: "0 2px", lineHeight: 1, flexShrink: 0 }}
                            >✕</button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
                            <span
                              onClick={() => { setEditingEventIdx(origIdx); setEditingNote(ev.note || ""); }}
                              title={ev.note || "Click to add note"}
                              style={{ fontSize: 11, color: ev.note ? S.muted : S.subtext, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: isHovered ? "text" : "default", opacity: ev.note ? 1 : isHovered ? 0.6 : 0, transition: "opacity 0.15s" }}
                            >
                              {ev.note || "add note…"}
                            </span>
                            {isHovered && (
                              <button
                                onClick={() => { setEditingEventIdx(origIdx); setEditingNote(ev.note || ""); }}
                                title="Edit note"
                                style={{ background: "none", border: "none", cursor: "pointer", color: S.emphasis, fontSize: 13, padding: "0 2px", lineHeight: 1, flexShrink: 0, opacity: 0.75, transform: "scaleX(-1)", display: "inline-block" }}
                              >✎</button>
                            )}
                          </div>
                        )}

                        <span style={{ fontSize: 11, color: S.muted, whiteSpace: "nowrap", flexShrink: 0 }}>
                          {new Date(ev.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Clear history */}
            {(history.length > 0 || portfolioEvents.length > 0) && (
              <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    setHistory([]);
                    setPortfolioEvents([]);
                    localStorage.removeItem("ph_history");
                    localStorage.removeItem("ph_events");
                  }}
                  style={{ fontSize: 12, color: S.muted, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Clear all history data
                </button>
              </div>
            )}

          </div>
        </div>

        {/* ━━━ SETUP ━━━ */}
        <div style={{ position: "absolute", inset: 0, overflow: "auto", display: tab === "setup" ? "block" : "none", padding: 20 }}>
          <div style={{ maxWidth: 1020, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 220px", gap: 16, alignItems: "start" }}>

            {/* ── Left column: Data source + Portfolio ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* ── Card 1: Data source ── */}
            <div style={{ background: S.panel, borderRadius: 10, border: `1px solid ${S.border}`, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>

              {/* Finnhub attribution header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${S.border}` }}>
                <div style={{ fontSize: 20 }}>📡</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: S.text }}>Powered by Finnhub</span>
                    <span style={{ fontSize: 10, fontWeight: 700, background: S.badgeFreeBg, color: S.badgeFreeText, padding: "2px 6px", borderRadius: 4 }}>FREE</span>
                  </div>
                  <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>Real-time quotes · Historical candle data · 60 req/min · No credit card needed</div>
                </div>
                <a href="https://finnhub.io/register" target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, fontWeight: 600, color: S.green, textDecoration: "none", whiteSpace: "nowrap" }}>
                  Get free key →
                </a>
              </div>

              {/* Key input */}
              <div style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: S.text }}>Your API Key</div>
                  {apiKey
                    ? <span style={{ fontSize: 11, fontWeight: 700, color: S.green, background: S.greenDim, border: `1px solid ${S.green}33`, padding: "2px 8px", borderRadius: 20 }}>✓ Active — using your own key</span>
                    : <span style={{ fontSize: 11, fontWeight: 600, color: S.link, background: `${S.link}14`, border: `1px solid ${S.link}26`, padding: "2px 8px", borderRadius: 20 }}>Using Karta's shared key</span>
                  }
                </div>
                {!apiKey && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 8, background: "rgba(147,197,253,0.06)", border: "1px solid rgba(147,197,253,0.14)", marginBottom: 10 }}>
                    <span style={{ fontSize: 15, lineHeight: 1 }}>ℹ️</span>
                    <div style={{ fontSize: 12, color: S.code, lineHeight: 1.6 }}>
                      Karta's <strong style={{ color: S.link }}>shared key</strong> is active by default, but it's rate-limited — heavy traffic can temporarily pause refreshes.
                      {" "}<strong style={{ color: S.strong }}>Get your own free key</strong> for uninterrupted, unlimited access to your portfolio data.
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="password"
                    value={apiInput}
                    onChange={e => setApiInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { setApiKey(apiInput); localStorage.setItem("ph_apikey", apiInput); setTab("heatmap"); setTimeout(() => fetchData(apiInput), 100); }}}
                    placeholder="Paste your Finnhub API key here…"
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 7, border: `1px solid ${S.border}`, background: S.inputBg, color: S.text, fontSize: 14, outline: "none" }}
                  />
                  <button
                    onClick={() => { setApiKey(apiInput); localStorage.setItem("ph_apikey", apiInput); setTab("heatmap"); setTimeout(() => fetchData(apiInput), 100); }}
                    disabled={!apiInput}
                    style={{ padding: "8px 18px", borderRadius: 7, border: "none", cursor: apiInput ? "pointer" : "not-allowed", background: S.accent, color: "#fff", fontSize: 14, fontWeight: 700, opacity: !apiInput ? 0.5 : 1 }}
                  >Save & Load</button>
                </div>
                <div style={{ fontSize: 12, color: S.muted, marginTop: 8 }}>
                  Your own key gives you unlimited refreshes and faster updates.
                  Free at <a href="https://finnhub.io/register" target="_blank" rel="noreferrer" style={{ color: S.link }}>finnhub.io/register</a> — takes 2 minutes.
                </div>
              </div>
            </div>

            {/* ── Card 2: Portfolio ── */}
            <div style={{ background: S.panel, borderRadius: 10, border: `1px solid ${S.border}`, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>

              {/* Header row with title editor */}
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${S.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.muted, marginBottom: 8, letterSpacing: "0.04em" }}>PORTFOLIO NAME</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={portfolioName}
                    onChange={e => { setPortfolioName(e.target.value); localStorage.setItem("ph_name", e.target.value); }}
                    placeholder="Portfolio Heatmap"
                    maxLength={40}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 7, border: `1px solid ${S.border}`, background: S.inputBg, color: S.text, fontSize: 14, fontWeight: 700, outline: "none" }}
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

                {/* Smart input */}
                <div style={{ marginBottom: 20 }}>
                  <SmartInput
                    portfolio={portfolio}
                    onApply={handleSmartApply}
                    S={S}
                    isMobile={isMobile}
                  />
                </div>

                {/* Holdings */}
                <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: S.muted, letterSpacing: "0.04em" }}>HOLDINGS ({portfolio.length})</div>
                    {portfolio.length > 0 && (
                      <button onClick={() => { portfolio.forEach(({ ticker, shares }) => recordPortfolioEvent("remove", ticker, shares)); setPortfolio([]); }} style={{ fontSize: 12, color: "#f87171", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Clear all</button>
                    )}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {portfolio.map(({ ticker, shares }) => (
                      <div key={ticker} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, background: S.bg, border: `1px solid ${S.border}` }}>
                        <span style={{ fontWeight: 800, fontSize: 13 }}>{ticker}</span>
                        <span style={{ fontSize: 11, color: S.muted }}>{shares}sh</span>
                        <button onClick={() => { recordPortfolioEvent("remove", ticker, shares); setPortfolio(portfolio.filter(p => p.ticker !== ticker)); }} style={{ background: "none", border: "none", cursor: "pointer", color: S.muted, fontSize: 15, padding: 0, lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                    {!portfolio.length && <span style={{ fontSize: 13, color: S.subtext }}>No stocks added yet — use bulk import or add one above.</span>}
                  </div>
                </div>

              </div>
            </div>

            </div>{/* end left column */}

            {/* ── Card 3: Appearance (right column) ── */}
            <div style={{ background: S.panel, borderRadius: 10, border: `1px solid ${S.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${S.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.muted, letterSpacing: "0.04em" }}>APPEARANCE</div>
              </div>
              <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                {SWATCHES.map(sw => (
                  <button
                    key={sw.key}
                    onClick={() => setTheme(sw.key)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                      border: theme === sw.key ? `2px solid ${S.green}` : `2px solid ${S.border}`,
                      background: theme === sw.key ? S.greenDim : S.bg,
                      boxShadow: theme === sw.key ? `0 0 0 1px ${S.green}33` : "none",
                      transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
                    }}
                  >
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: sw.dot, flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.25)" }} />
                    <span style={{ fontSize: 13, fontWeight: theme === sw.key ? 700 : 500, color: theme === sw.key ? S.green : S.muted }}>{sw.label}</span>
                    {theme === sw.key && <span style={{ marginLeft: "auto", fontSize: 13, color: S.green }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
