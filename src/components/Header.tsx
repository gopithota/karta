import { useMemo } from "react";
import { usePortfolioStore } from "../store/usePortfolioStore";
import type { TabKey } from "../types";

export default function Header() {
  const S             = usePortfolioStore(s => s.S);
  const tab           = usePortfolioStore(s => s.tab);
  const setTab        = usePortfolioStore(s => s.setTab);
  const portfolioName = usePortfolioStore(s => s.portfolioName);
  const portfolio     = usePortfolioStore(s => s.portfolio);
  const stockData     = usePortfolioStore(s => s.stockData);
  const loading       = usePortfolioStore(s => s.loading);
  const privacyMode   = usePortfolioStore(s => s.privacyMode);
  const setPrivacyMode = usePortfolioStore(s => s.setPrivacyMode);
  const isMobile      = usePortfolioStore(s => s.isMobile);
  const rateLimitSecs = usePortfolioStore(s => s.rateLimitSecs);
  const fetchData     = usePortfolioStore(s => s.fetchData);
  const fetchErrors   = usePortfolioStore(s => s.fetchErrors);
  const apiKey        = usePortfolioStore(s => s.apiKey);
  const tryAutoFetch  = usePortfolioStore(s => s.tryAutoFetch);

  const getWeight = (ticker: string) => {
    const d = stockData[ticker];
    const h = portfolio.find(p => p.ticker === ticker);
    if (d && h) return d.price * h.shares;
    return h ? h.shares * 100 : 100;
  };

  const totalValue = useMemo(
    () => portfolio.reduce((s, { ticker }) => s + getWeight(ticker), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [portfolio, stockData]
  );

  const aggReturn = useMemo(() => {
    if (!Object.keys(stockData).length) return null;
    let currentVal = 0, prevCloseVal = 0;
    for (const { ticker, shares } of portfolio) {
      const d = stockData[ticker];
      if (!d?.price || !d?.prevClose) continue;
      currentVal   += d.price    * shares;
      prevCloseVal += d.prevClose * shares;
    }
    return prevCloseVal > 0 ? ((currentVal - prevCloseVal) / prevCloseVal) * 100 : null;
  }, [stockData, portfolio]);

  const btnBase = (active: boolean) => ({
    padding: "5px 13px", borderRadius: 6,
    border: active ? `1px solid ${S.tabActiveBorder}` : `1px solid ${S.border}`,
    cursor: "pointer" as const, fontSize: 13, fontWeight: 500, transition: "all .15s",
    background: active ? S.tabActiveBg : S.panel,
    color: active ? S.tabActiveText : S.muted,
  });

  const handleTabClick = (key: TabKey) => {
    setTab(key);
    // force=true: show loading overlay on tab switch (matches old behavior)
    if (key === "heatmap") tryAutoFetch(true);
  };

  const showToolbar = tab !== "setup" && tab !== "history";
  const showNudge   = !apiKey && showToolbar;

  return (
    <>
      {/* Header bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "8px 12px" : "12px 18px", borderBottom: `1px solid ${S.border}`, flexShrink: 0, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 12, minWidth: 0 }}>
          <a href="/" title="Back to Karta home" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none", color: "inherit", minWidth: 0 }}>
            <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              {([["#2a6040","#3a7a52","#4a9966"],["#3a7a52","#4a9966","#5ab878"],["#4a9966","#5ab878","#4ade80"],["#235238","#4a9966","#22c55e"]] as string[][]).map((row, ri) =>
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
            <div title="Your portfolio is stored locally in your browser only. Nothing is sent to our servers." style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(74,222,128,0.2)", background: S.greenDim, fontSize: 11, color: S.green, fontWeight: 600, cursor: "default", letterSpacing: "0.02em" }}>
              🔒 Local only
            </div>
          )}
          {(["heatmap", "table", "history", "setup"] as TabKey[]).map(key => {
            const labels: Record<TabKey, { label: string; short: string }> = {
              heatmap: { label: "Heatmap", short: "Map"   },
              table:   { label: "Table",   short: "Table" },
              history: { label: "History", short: "Hist"  },
              setup:   { label: "Setup",   short: "Setup" },
            };
            return (
              <button key={key} onClick={() => handleTabClick(key)} style={{ ...btnBase(tab === key), textTransform: "capitalize", padding: isMobile ? "5px 9px" : "5px 13px", fontSize: isMobile ? 12 : 13 }}>
                {isMobile ? labels[key].short : labels[key].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      {showToolbar && (
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

      {/* Shared-key nudge */}
      {showNudge && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "5px 18px", flexShrink: 0, background: "rgba(59,130,246,0.05)", borderBottom: "1px solid rgba(59,130,246,0.1)", fontSize: 12, color: S.muted }}>
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
    </>
  );
}
