import { useRef, useEffect, useMemo } from "react";
import { usePortfolioStore, DEFAULT_PORTFOLIO } from "../../store/usePortfolioStore";
import { computeTreemap, perfColor, tileFgColor } from "../../utils";
import { LEGEND_STOPS } from "../../constants";

export default function HeatmapView() {
  const S          = usePortfolioStore(s => s.S);
  const portfolio  = usePortfolioStore(s => s.portfolio);
  const stockData  = usePortfolioStore(s => s.stockData);
  const loading    = usePortfolioStore(s => s.loading);
  const isDemo     = usePortfolioStore(s => s.isDemo);
  const tooltip    = usePortfolioStore(s => s.tooltip);
  const setTooltip = usePortfolioStore(s => s.setTooltip);
  const setTab     = usePortfolioStore(s => s.setTab);
  const setPrivacyMode = usePortfolioStore(s => s.setPrivacyMode);
  const boxSize    = usePortfolioStore(s => s.boxSize);
  const setBoxSize = usePortfolioStore(s => s.setBoxSize);
  const isMobile   = usePortfolioStore(s => s.isMobile);
  const fetchData  = usePortfolioStore(s => s.fetchData);
  const privacyMode = usePortfolioStore(s => s.privacyMode);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([e]) =>
      setBoxSize({ w: e.contentRect.width, h: e.contentRect.height })
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [setBoxSize]);

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

  const treemapItems = useMemo(() => portfolio.map(({ ticker }) => {
    const realPerf  = stockData[ticker]?.today ?? null;
    const demoEntry = DEFAULT_PORTFOLIO.find(d => d.ticker === ticker);
    const perf = realPerf !== null ? realPerf : (isDemo && demoEntry ? demoEntry.demoPerf ?? null : null);
    return { id: ticker, ticker, weight: getWeight(ticker), perf, price: stockData[ticker]?.price ?? null };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [portfolio, stockData, isDemo]);

  const rects = useMemo(
    () => computeTreemap(treemapItems, boxSize.w, boxSize.h),
    [treemapItems, boxSize.w, boxSize.h]
  );

  return (
    <div style={{ position: "absolute", inset: 0, padding: isMobile ? 8 : 16 }}>
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: isMobile ? 10 : 16, border: `1px solid ${S.border}`, overflow: "hidden", background: S.panel, boxShadow: "0 4px 32px rgba(0,0,0,0.18), 0 1px 6px rgba(0,0,0,0.10)" }}>

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
          <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 20, whiteSpace: "nowrap", background: S.overlay, backdropFilter: "blur(10px)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 10, padding: "9px 18px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
            <span style={{ fontSize: 14 }}>✨</span>
            <span style={{ fontSize: 13, color: "#fde68a", fontWeight: 600 }}>Demo portfolio</span>
            <span style={{ color: S.subtext, fontSize: 13 }}>·</span>
            <span style={{ fontSize: 13, color: S.muted }}>Customize it for your holdings</span>
            <span style={{ color: S.subtext, fontSize: 13 }}>—</span>
            <button onClick={() => setTab("setup")} style={{ fontSize: 12, fontWeight: 700, color: S.green, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", textUnderlineOffset: 3 }}>Set up yours →</button>
          </div>
        )}

        {/* Onboarding hints */}
        {isDemo && !loading && (
          <div style={{ position: "absolute", top: 52, left: 12, zIndex: 25, display: "flex", flexDirection: "column", gap: 7, alignItems: "flex-start" }}>
            {[
              { icon: "👁", label: "Toggle portfolio value", action: () => setPrivacyMode(p => !p) },
              { icon: "⊞", label: "See table view",          action: () => setTab("table")  },
              { icon: "✏️", label: "Customize your portfolio", action: () => setTab("setup") },
            ].map(hint => (
              <button key={hint.label} onClick={hint.action} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 8, background: S.overlay, backdropFilter: "blur(8px)", border: `1px solid ${S.border}`, color: S.muted, fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "color 0.15s, border-color 0.15s" }}
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
                style={{ position: "absolute", left: bx, top: by, width: bw, height: bh, background: perfColor(rect.perf), borderRadius: 7, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", transition: "filter .15s", cursor: isMobile ? "pointer" : "default", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.10)" }}
                onMouseEnter={isMobile ? undefined : e => { e.currentTarget.style.filter = "brightness(0.93)"; setTooltip(rect); }}
                onMouseLeave={isMobile ? undefined : e => { e.currentTarget.style.filter = ""; setTooltip(null); }}
                onClick={isMobile ? e => { e.stopPropagation(); setTooltip(tooltip?.id === rect.id ? null : rect); } : undefined}
              >
                {showTicker && <div style={{ fontSize: Math.max(9, Math.min(20, bw / 5.5)), fontWeight: 700, color: fg.primary, lineHeight: 1.1, letterSpacing: "-0.01em" }}>{rect.ticker}</div>}
                {showPerf && rect.perf != null && <div style={{ fontSize: Math.max(8, Math.min(14, bw / 7.5)), fontWeight: 600, color: fg.secondary, lineHeight: 1.3 }}>{rect.perf >= 0 ? "+" : ""}{rect.perf.toFixed(2)}%</div>}
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
              {tooltip.perf != null && <div style={{ fontSize: 13, color: tooltip.perf >= 0 ? S.green : "#f87171", fontWeight: 700, marginTop: 2 }}>Today: {tooltip.perf >= 0 ? "+" : ""}{tooltip.perf.toFixed(2)}%</div>}
              <div style={{ fontSize: 12, color: S.muted, marginTop: 5, paddingTop: 5, borderTop: `1px solid ${S.border}` }}>
                {((getWeight(tooltip.ticker ?? "") / (totalValue || 1)) * 100).toFixed(1)}% of portfolio
              </div>
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
  );
}
