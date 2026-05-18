import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { usePortfolioStore, DEFAULT_PORTFOLIO } from "../../store/usePortfolioStore";
import { computeTreemap, perfColor, tileFgColor } from "../../utils";
import { LEGEND_STOPS } from "../../constants";
import WatchlistView from "../watchlist/WatchlistView";

export default function HeatmapView() {
  const S               = usePortfolioStore(s => s.S);
  const portfolio       = usePortfolioStore(s => s.portfolio);
  const stockData       = usePortfolioStore(s => s.stockData);
  const loading         = usePortfolioStore(s => s.loading);
  const isDemo          = usePortfolioStore(s => s.isDemo);
  const tooltip         = usePortfolioStore(s => s.tooltip);
  const setTooltip      = usePortfolioStore(s => s.setTooltip);
  const setTab          = usePortfolioStore(s => s.setTab);
  const setPrivacyMode  = usePortfolioStore(s => s.setPrivacyMode);
  const boxSize         = usePortfolioStore(s => s.boxSize);
  const setBoxSize      = usePortfolioStore(s => s.setBoxSize);
  const isMobile        = usePortfolioStore(s => s.isMobile);
  const fetchData       = usePortfolioStore(s => s.fetchData);
  const watchlists      = usePortfolioStore(s => s.watchlists);
  const heatmapView     = usePortfolioStore(s => s.heatmapView);
  const setHeatmapView  = usePortfolioStore(s => s.setHeatmapView);
  const fetchWatchlistData = usePortfolioStore(s => s.fetchWatchlistData);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([e]) =>
      setBoxSize({ w: e.contentRect.width, h: e.contentRect.height })
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [setBoxSize, heatmapView]);

  // Trigger data fetch and clear tooltip when switching to a watchlist
  useEffect(() => {
    if (heatmapView !== "portfolio") fetchWatchlistData();
    setTooltip(null);
  }, [heatmapView, fetchWatchlistData, setTooltip]);

  // Reset to portfolio if the active watchlist becomes empty
  useEffect(() => {
    if (heatmapView === "watchlist1" && watchlists[0].tickers.length === 0) setHeatmapView("portfolio");
    if (heatmapView === "watchlist2" && watchlists[1].tickers.length === 0) setHeatmapView("portfolio");
  }, [watchlists, heatmapView, setHeatmapView]);

  // ── Portfolio treemap data (computed unconditionally — hooks rule) ─

  const getWeight = (ticker: string) => {
    const d = stockData[ticker];
    const h = portfolio.find(p => p.ticker === ticker);
    if (d && h) return d.price * h.shares;
    return h ? h.shares * 100 : 100;
  };

  const totalValue = portfolio.reduce((s, { ticker }) => s + getWeight(ticker), 0);

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

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(() => {
    if (isExporting || rects.length === 0) return;
    setIsExporting(true);

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const W = boxSize.w;
    const H = boxSize.h;

    const canvas = document.createElement("canvas");
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((ctx as any).roundRect) { (ctx as any).roundRect(x, y, w, h, r); }
      else { ctx.rect(x, y, w, h); }
    };

    // Panel background
    ctx.fillStyle = S.panel;
    roundRect(0, 0, W, H, 16);
    ctx.fill();

    // Tiles — redacted: ticker + perf% + weight badge; no price, no share counts
    rects.forEach(rect => {
      const gap = 3;
      const bx = rect.x + gap, by = rect.y + gap;
      const bw = rect.w - gap * 2, bh = rect.h - gap * 2;
      if (bw < 4 || bh < 4) return;

      ctx.fillStyle = perfColor(rect.perf);
      roundRect(bx, by, bw, bh, 7);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.10)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const showTicker = bw > 30 && bh > 20;
      const showPerf   = bw > 55 && bh > 42;
      const showWeight = bw > 60 && bh > 60;
      if (!showTicker) return;

      const fg = tileFgColor(rect.perf);
      const tickerSize = Math.max(9, Math.min(20, bw / 5.5));
      const perfSize   = Math.max(8, Math.min(14, bw / 7.5));

      type Line = { text: string; size: number; color: string; weight: number };
      const lines: Line[] = [];
      if (rect.ticker) lines.push({ text: rect.ticker, size: tickerSize, color: fg.primary, weight: 700 });
      if (showPerf && rect.perf != null)
        lines.push({ text: `${rect.perf >= 0 ? "+" : ""}${rect.perf.toFixed(2)}%`, size: perfSize, color: fg.secondary, weight: 600 });

      const spacing = 1.25;
      const totalH  = lines.reduce((s, l) => s + l.size * spacing, 0);
      let ty = by + bh / 2 - totalH / 2;

      ctx.textAlign    = "center";
      ctx.textBaseline = "top";
      lines.forEach(line => {
        ctx.font      = `${line.weight} ${line.size}px -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
        ctx.fillStyle = line.color;
        ctx.fillText(line.text, bx + bw / 2, ty, bw - 6);
        ty += line.size * spacing;
      });

      // Portfolio weight badge — bottom-right corner (pie icon + %) with backdrop
      if (showWeight) {
        const pct       = (rect.weight / (totalValue || 1)) * 100;
        const pctText   = pct.toFixed(1) + "%";
        const pctFontSz = Math.max(8, Math.min(11, bw / 10));
        const iconR     = 5;
        const gap2      = 3;
        const padH      = 2, padV = 2;
        ctx.font = `700 ${pctFontSz}px -apple-system, system-ui, sans-serif`;
        const textW   = ctx.measureText(pctText).width;
        const badgeW  = padH + iconR * 2 + gap2 + textW + padH;
        const badgeH  = Math.max(iconR * 2, pctFontSz) + padV * 2;
        const badgeRX = bx + bw - 4;
        const badgeBY = by + bh - 4;
        const badgeLX = badgeRX - badgeW;
        const badgeTY = badgeBY - badgeH;
        if (badgeLX > bx + 2) {               // only if badge fits
          const iconCX = badgeLX + padH + iconR;
          const iconCY = badgeTY + badgeH / 2;
          // Backdrop pill
          ctx.fillStyle   = "rgba(0,0,0,0.28)";
          ctx.globalAlpha = 1;
          roundRect(badgeLX, badgeTY, badgeW, badgeH, 5);
          ctx.fill();
          // Outline circle
          ctx.strokeStyle = fg.primary;
          ctx.lineWidth   = 1;
          ctx.globalAlpha = 0.45;
          ctx.beginPath();
          ctx.arc(iconCX, iconCY, iconR, 0, Math.PI * 2);
          ctx.stroke();
          // Filled pie
          if (pct >= 0.5) {
            ctx.fillStyle   = fg.primary;
            ctx.globalAlpha = 0.95;
            ctx.beginPath();
            if (pct >= 99.5) {
              ctx.arc(iconCX, iconCY, iconR, 0, Math.PI * 2);
            } else {
              const angle = (pct / 100) * Math.PI * 2;
              ctx.moveTo(iconCX, iconCY);
              ctx.arc(iconCX, iconCY, iconR, -Math.PI / 2, -Math.PI / 2 + angle);
            }
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          // Text
          ctx.font         = `700 ${pctFontSz}px -apple-system, system-ui, sans-serif`;
          ctx.fillStyle    = fg.primary;
          ctx.textAlign    = "right";
          ctx.textBaseline = "middle";
          ctx.fillText(pctText, badgeRX - padH, iconCY, bw / 2.5);
          ctx.globalAlpha = 1;
        }
      }
    });

    // Legend (left side, matching moved UI legend)
    const swatchSz  = 13;
    const swatchGap = 3;
    const padX      = 10;
    const padY      = 5;
    const labelW    = 30;
    const legendW   = padX + labelW + LEGEND_STOPS.length * (swatchSz + swatchGap) - swatchGap + labelW + padX;
    const legendH   = swatchSz + padY * 2;
    const lx        = 14;
    const ly        = H - 12 - legendH;

    ctx.fillStyle = "rgba(0,0,0,0.40)";
    roundRect(lx, ly, legendW, legendH, 8);
    ctx.fill();

    ctx.font         = "10px -apple-system, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillStyle    = "rgba(255,255,255,0.55)";
    ctx.textAlign    = "left";
    ctx.fillText("−8%", lx + padX, ly + legendH / 2);
    ctx.textAlign = "right";
    ctx.fillText("+8%", lx + legendW - padX, ly + legendH / 2);

    LEGEND_STOPS.forEach((v, i) => {
      const sx = lx + padX + labelW + i * (swatchSz + swatchGap);
      ctx.fillStyle = perfColor(v);
      roundRect(sx, ly + padY, swatchSz, swatchSz, 3);
      ctx.fill();
    });

    // Branding pill — bottom-right, bold and visible for discovery
    {
      const nameSize = 16, urlSize = 11;
      const padX = 10, padY = 7, gap = 4;
      ctx.font = `800 ${nameSize}px -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
      const nameW = ctx.measureText("karta").width;
      ctx.font = `400 ${urlSize}px -apple-system, system-ui, sans-serif`;
      const urlW  = ctx.measureText("getkarta.app").width;
      const pillW = padX * 2 + Math.max(nameW, urlW);
      const pillH = padY * 2 + nameSize + gap + urlSize;
      const px    = W - 14 - pillW;
      const py    = H - 14 - pillH;
      // Pill backdrop
      ctx.fillStyle   = "rgba(0,0,0,0.42)";
      ctx.globalAlpha = 1;
      roundRect(px, py, pillW, pillH, 9);
      ctx.fill();
      // "karta" — bold, high contrast
      ctx.font         = `800 ${nameSize}px -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
      ctx.fillStyle    = "rgba(255,255,255,0.92)";
      ctx.textAlign    = "center";
      ctx.textBaseline = "top";
      ctx.fillText("karta", px + pillW / 2, py + padY);
      // URL — lighter
      ctx.font      = `500 ${urlSize}px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.60)";
      ctx.fillText("getkarta.app", px + pillW / 2, py + padY + nameSize + gap);
      ctx.globalAlpha = 1;
    }

    // Download
    const link    = document.createElement("a");
    link.download = `karta-${new Date().toISOString().slice(0, 10)}.png`;
    link.href     = canvas.toDataURL("image/png");
    link.click();

    setIsExporting(false);
  }, [isExporting, rects, boxSize, S]);

  // ── Delegate to WatchlistView when a watchlist is active ──────────
  if (heatmapView !== "portfolio") {
    return <WatchlistView />;
  }

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
              { icon: "👁",  label: "Toggle portfolio value",   action: () => setPrivacyMode(p => !p) },
              { icon: "⊞",  label: "See table view",            action: () => setTab("table") },
              { icon: "✏️", label: "Customize your portfolio",  action: () => setTab("setup") },
            ].map(hint => (
              <button key={hint.label} onClick={hint.action}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 8, background: S.overlay, backdropFilter: "blur(8px)", border: `1px solid ${S.border}`, color: S.muted, fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "color 0.15s, border-color 0.15s" }}
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

        {/* Tiles + tooltip + legend */}
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }}
          onClick={isMobile ? () => setTooltip(null) : undefined}
        >
          {rects.map(rect => {
            const gap = 3;
            const bx = rect.x + gap, by = rect.y + gap;
            const bw = rect.w - gap * 2, bh = rect.h - gap * 2;
            if (bw < 4 || bh < 4) return null;
            const showTicker = bw > 30 && bh > 20;
            const showPerf   = bw > 55 && bh > 42;
            const showPrice  = bw > 76 && bh > 60;
            const showWeight = bw > 60 && bh > 60;
            const fg = tileFgColor(rect.perf);
            const holdingPctNum = (rect.weight / (totalValue || 1)) * 100;
            const holdingPct    = holdingPctNum.toFixed(1);
            const pieAngle    = (holdingPctNum / 100) * Math.PI * 2;
            const pieEndX     = (5 + 4 * Math.sin(pieAngle)).toFixed(3);
            const pieEndY     = (5 - 4 * Math.cos(pieAngle)).toFixed(3);
            const pieLargeArc = holdingPctNum > 50 ? 1 : 0;
            return (
              <div key={rect.id}
                style={{ position: "absolute", left: bx, top: by, width: bw, height: bh, background: perfColor(rect.perf), borderRadius: 7, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", transition: "filter .15s", cursor: isMobile ? "pointer" : "default", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.10)" }}
                onMouseEnter={isMobile ? undefined : e => { e.currentTarget.style.filter = "brightness(0.93)"; setTooltip(rect); }}
                onMouseLeave={isMobile ? undefined : e => { e.currentTarget.style.filter = ""; setTooltip(null); }}
                onClick={isMobile ? e => { e.stopPropagation(); setTooltip(tooltip?.id === rect.id ? null : rect); } : undefined}
              >
                {showTicker && <div style={{ fontSize: Math.max(9, Math.min(20, bw / 5.5)), fontWeight: 700, color: fg.primary, lineHeight: 1.1, letterSpacing: "-0.01em" }}>{rect.ticker}</div>}
                {showPerf && rect.perf != null && <div style={{ fontSize: Math.max(8, Math.min(14, bw / 7.5)), fontWeight: 600, color: fg.secondary, lineHeight: 1.3 }}>{rect.perf >= 0 ? "+" : ""}{rect.perf.toFixed(2)}%</div>}
                {showPrice && rect.price && <div style={{ fontSize: Math.max(7, Math.min(11, bw / 10)), color: fg.tertiary, lineHeight: 1.3 }}>${rect.price.toFixed(2)}</div>}
                {/* Portfolio weight badge — bottom-right corner, out of center flow */}
                {showWeight && (
                  <div style={{ position: "absolute", bottom: 4, right: 4, display: "flex", alignItems: "center", gap: 3, background: "rgba(0,0,0,0.22)", backdropFilter: "blur(2px)", borderRadius: 5, padding: "2px 5px 2px 4px", pointerEvents: "none" }}>
                    <svg width="12" height="12" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
                      <circle cx="5" cy="5" r="4" fill="none" stroke={fg.primary} strokeWidth="1.2" opacity="0.45" />
                      {holdingPctNum >= 99.5
                        ? <circle cx="5" cy="5" r="4" fill={fg.primary} opacity="0.95" />
                        : holdingPctNum >= 0.5 && <path d={`M 5 5 L 5 1 A 4 4 0 ${pieLargeArc} 1 ${pieEndX} ${pieEndY} Z`} fill={fg.primary} opacity="0.95" />
                      }
                    </svg>
                    <span style={{ fontSize: Math.max(8, Math.min(11, bw / 10)), color: fg.primary, lineHeight: 1, fontWeight: 700 }}>{holdingPct}%</span>
                  </div>
                )}
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

          {/* Legend — left side (right has small tiles) */}
          {rects.length > 0 && (
            <div style={{ position: "absolute", bottom: 12, left: 14, display: "flex", alignItems: "center", gap: 3, background: S.overlay, backdropFilter: "blur(6px)", padding: "5px 10px", borderRadius: 8, fontSize: 10, color: S.muted, letterSpacing: "0.03em" }}>
              <span>−8%</span>
              {LEGEND_STOPS.map(v => <div key={v} style={{ width: 13, height: 13, background: perfColor(v), borderRadius: 3 }} />)}
              <span>+8%</span>
            </div>
          )}

          {/* Share / redacted export */}
          {rects.length > 0 && (
            <button
              onClick={handleExport}
              disabled={isExporting}
              style={{ position: "absolute", bottom: 12, right: 14, display: "flex", alignItems: "center", gap: 5, background: S.overlay, backdropFilter: "blur(6px)", padding: "5px 11px", borderRadius: 8, fontSize: 10, color: S.muted, letterSpacing: "0.03em", border: `1px solid ${S.border}`, cursor: isExporting ? "default" : "pointer", transition: "color 0.15s, border-color 0.15s" }}
              onMouseEnter={e => { if (!isExporting) { e.currentTarget.style.color = S.text; e.currentTarget.style.borderColor = S.green + "55"; } }}
              onMouseLeave={e => { e.currentTarget.style.color = S.muted; e.currentTarget.style.borderColor = S.border; }}
            >
              {isExporting ? "Capturing…" : "↓ Share"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
