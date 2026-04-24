import { useEffect, useMemo, useRef, useState } from "react";
import { usePortfolioStore } from "../../store/usePortfolioStore";
import {
  buildMatrix,
  reorderTickers,
  clusterTickers,
  corrColor,
  corrTextColor,
} from "./engine";
import type { ClusterResult } from "./engine";

interface CellTooltip {
  i: number;
  j: number;
  r: number;
  x: number;
  y: number;
}

export default function CorrelationView() {
  const S          = usePortfolioStore(s => s.S);
  const tab        = usePortfolioStore(s => s.tab);
  const portfolio  = usePortfolioStore(s => s.portfolio);
  const stockData  = usePortfolioStore(s => s.stockData);
  const sectorData = usePortfolioStore(s => s.sectorData);
  const candleData = usePortfolioStore(s => s.candleData);
  const isMobile   = usePortfolioStore(s => s.isMobile);
  const setTab     = usePortfolioStore(s => s.setTab);

  const [tickers, setTickers]   = useState<string[]>([]);
  const [matrix, setMatrix]     = useState<number[][]>([]);
  const [minDays, setMinDays]   = useState(0);
  const [clusters, setClusters] = useState<ClusterResult | null>(null);
  const [tooltip, setTooltip]   = useState<CellTooltip | null>(null);
  const [status, setStatus]     = useState<"idle" | "loading" | "ready" | "no-data" | "too-few">("idle");
  const containerRef = useRef<HTMLDivElement>(null);

  // Recompute whenever the correlation tab becomes active or candle data arrives
  useEffect(() => {
    if (tab !== "correlation") return;

    const tks = portfolio.map(p => p.ticker);
    console.log("[Corr] tab=correlation tickers:", tks, "candleData keys:", Object.keys(candleData));

    if (tks.length < 2) { setStatus("too-few"); return; }

    const available = tks.filter(t => candleData[t]);
    console.log("[Corr] available (have candles):", available);
    if (available.length < 2) { setStatus("no-data"); return; }

    setStatus("loading");

    const { matrix: mat, minDays: md } = buildMatrix(available, candleData);
    const order = reorderTickers(available, mat);
    const orderedTickers = order.map(i => available[i]);
    const orderedMatrix  = order.map(i => order.map(j => mat[i][j]));

    setTickers(orderedTickers);
    setMatrix(orderedMatrix);
    setMinDays(md);
    setClusters(clusterTickers(orderedTickers, orderedMatrix));
    setStatus("ready");
  }, [tab, portfolio, candleData]);

  // ── Cell sizing ───────────────────────────────────────────────────
  const n        = tickers.length;
  const maxLabel = tickers.reduce((m, t) => Math.max(m, t.length), 0);
  const labelW   = Math.max(36, maxLabel * 7 + 8);
  const cellSize = isMobile ? 32 : 44;
  const gridW    = labelW + n * cellSize;
  const gridH    = labelW + n * cellSize;

  // ── Render helpers ────────────────────────────────────────────────
  const fmt = (r: number) => isNaN(r) ? "—" : r.toFixed(2);

  const handleCellEnter = (
    e: React.MouseEvent<HTMLDivElement>,
    i: number,
    j: number,
    r: number
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ i, j, r, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  // ── Cluster color palette — warm glow, distinct from blue/red corr scale ──
  const CLUSTER_COLORS = [
    "#00d4aa", // aqua-teal
    "#ffa94d", // warm amber
    "#c792ea", // soft violet
    "#ff7b72", // coral
    "#3be092", // mint
    "#f78166", // terra-cotta
    "#79c0ff", // periwinkle
    "#d2a8ff", // lavender
  ];

  // Map each clustered ticker → color (solos get undefined). Before early returns (hooks rule).
  const tickerColor = useMemo(() => {
    const map = new Map<string, string>();
    if (!clusters) return map;
    let ci = 0;
    for (const group of clusters.clusters) {
      if (group.length > 1) {
        const color = CLUSTER_COLORS[ci++ % CLUSTER_COLORS.length];
        for (const tk of group) map.set(tk, color);
      }
    }
    return map;
  }, [clusters]);


  // ── Empty states ──────────────────────────────────────────────────
  const emptyStyle: React.CSSProperties = {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: 12, color: S.muted, textAlign: "center", padding: 32,
  };

  if (status === "too-few") return (
    <div style={emptyStyle}>
      <span style={{ fontSize: 32 }}>📊</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: S.text }}>Need at least 2 stocks</span>
      <span style={{ fontSize: 13 }}>Add more tickers in Setup to see correlations.</span>
      <button
        onClick={() => setTab("setup")}
        style={{ marginTop: 4, padding: "7px 18px", borderRadius: 8, border: "none", background: S.accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
      >
        Go to Setup →
      </button>
    </div>
  );

  if (status === "no-data") return (
    <div style={emptyStyle}>
      <span style={{ fontSize: 32 }}>📡</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: S.text }}>No price history yet</span>
      <span style={{ fontSize: 13 }}>Hit Refresh above to load daily candle data — correlation needs at least 2 tickers with price history.</span>
    </div>
  );

  if (status === "loading" || status === "idle") return (
    <div style={emptyStyle}>
      <span style={{ fontSize: 13 }}>Computing correlations…</span>
    </div>
  );

  // ── Gap helpers ───────────────────────────────────────────────────
  // A gap is inserted between ticker[i] and ticker[i+1] when they belong to
  // different clusters. Solo→solo never gets a gap.
  const gapSize = 4;
  const isBoundaryAfter = (i: number): boolean => {
    if (i >= tickers.length - 1) return false;
    const a = tickerColor.get(tickers[i]);
    const b = tickerColor.get(tickers[i + 1]);
    if (a === undefined && b === undefined) return false; // both solo
    return a !== b;
  };
  const gapCount  = tickers.reduce((c, _, i) => c + (isBoundaryAfter(i) ? 1 : 0), 0);
  const totalGridW = labelW + n * cellSize + gapCount * gapSize;

  // ── Main matrix view ──────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{ position: "relative", flex: 1, overflow: "auto", padding: isMobile ? "12px 8px" : "20px 24px" }}
    >
      {/* Title */}
      <div style={{ marginBottom: 14, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: S.text }}>Return Correlation</span>
        <span style={{ fontSize: 12, color: S.muted }}>
          daily log returns · {minDays} trading days
        </span>
      </div>

      {/* Cluster summary card */}
      {clusters && clusters.clusters.length > 0 && (() => {
        const groups  = clusters.clusters.filter(g => g.length > 1);
        const solos   = clusters.clusters.filter(g => g.length === 1).flatMap(g => g);
        const allSolo = groups.length === 0;

        // Portfolio value helpers — shares × price for each ticker
        const tickerVal = (tk: string) => {
          const item = portfolio.find(p => p.ticker === tk);
          return (item?.shares ?? 0) * (stockData[tk]?.price ?? 0);
        };
        const totalVal = portfolio.reduce(
          (s, p) => s + p.shares * (stockData[p.ticker]?.price ?? 0), 0
        );
        const pct = (group: string[]) =>
          totalVal > 0
            ? (group.reduce((s, tk) => s + tickerVal(tk), 0) / totalVal * 100).toFixed(1) + "%"
            : null;

        // Cluster label: prefer majority sector from sectorData; fall back to top tickers by value
        const clusterLabel = (group: string[]) => {
          const sectors = group.map(tk => sectorData[tk]).filter(Boolean) as string[];
          if (sectors.length > 0) {
            const freq: Record<string, number> = {};
            for (const s of sectors) freq[s] = (freq[s] || 0) + 1;
            const dominant = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
            return dominant.length > 26 ? dominant.slice(0, 24) + "…" : dominant;
          }
          // Fallback: top tickers sorted by portfolio value
          const sorted = [...group].sort((a, b) => tickerVal(b) - tickerVal(a));
          if (sorted.length <= 3) return sorted.join(" · ");
          return `${sorted[0]} · ${sorted[1]} +${sorted.length - 2}`;
        };

        return (
          <div style={{
            marginBottom: 18,
            background: S.panel,
            border: `1px solid ${S.border}`,
            borderRadius: 12,
            overflow: "hidden",
          }}>
            {/* Card header */}
            <div style={{
              padding: "11px 16px",
              borderBottom: `1px solid ${S.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: S.text }}>
                {allSolo
                  ? `${tickers.length} stocks — all move independently`
                  : `${tickers.length} stocks · ${groups.length} correlated group${groups.length > 1 ? "s" : ""}`}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
                color: S.muted, background: S.bg,
                border: `1px solid ${S.border}`,
                borderRadius: 5, padding: "2px 7px", flexShrink: 0,
              }}>
                r ≥ {clusters.threshold}
              </span>
            </div>

            {/* Group rows */}
            <div style={{ padding: "6px 0" }}>
              {groups.map((group, gi) => {
                const color = CLUSTER_COLORS[gi % CLUSTER_COLORS.length];
                const groupPct = pct(group);
                return (
                  <div key={gi} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "8px 16px 8px 13px",
                    borderLeft: `3px solid ${color}`,
                    background: `linear-gradient(90deg, ${color}10 0%, transparent 65%)`,
                  }}>
                    {/* Derived label (top tickers by value) */}
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color, minWidth: 90, flexShrink: 0,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {clusterLabel(group)}
                    </span>

                    {/* Ticker chips */}
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {group.map(tk => (
                        <span key={tk} style={{
                          fontSize: 11, fontWeight: 700,
                          color,
                          background: `${color}12`,
                          border: `1px solid ${color}55`,
                          borderRadius: 99,
                          padding: "2px 10px",
                          letterSpacing: "0.04em",
                          boxShadow: `0 0 8px ${color}30`,
                        }}>
                          {tk}
                        </span>
                      ))}
                    </div>

                    {/* Portfolio % + count */}
                    <div style={{ marginLeft: "auto", textAlign: "right", flexShrink: 0 }}>
                      {groupPct && (
                        <div style={{ fontSize: 12, fontWeight: 700, color }}>{groupPct}</div>
                      )}
                      <div style={{ fontSize: 10, color: S.muted }}>{group.length} stocks</div>
                    </div>
                  </div>
                );
              })}

              {/* Solo row */}
              {solos.length > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "8px 16px 8px 13px",
                  borderLeft: `3px solid ${S.border}`,
                  borderTop: groups.length > 0 ? `1px solid ${S.border}` : "none",
                  marginTop: groups.length > 0 ? 2 : 0,
                  opacity: 0.7,
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: S.muted, minWidth: 90, flexShrink: 0,
                  }}>
                    Independent
                  </span>

                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {solos.map(tk => (
                      <span key={tk} style={{
                        fontSize: 11, fontWeight: 600, color: S.muted,
                        border: `1px solid ${S.border}`,
                        borderRadius: 99,
                        padding: "2px 10px",
                        letterSpacing: "0.04em",
                      }}>
                        {tk}
                      </span>
                    ))}
                  </div>

                  <div style={{ marginLeft: "auto", textAlign: "right", flexShrink: 0 }}>
                    {pct(solos) && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: S.muted }}>{pct(solos)}</div>
                    )}
                    <div style={{ fontSize: 10, color: S.muted }}>{solos.length} stock{solos.length > 1 ? "s" : ""}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer insight */}
            {!allSolo && (
              <div style={{
                padding: "8px 16px",
                borderTop: `1px solid ${S.border}`,
                fontSize: 11, color: S.muted, lineHeight: 1.5,
              }}>
                Stocks in the same group tend to move together — concentration within a group reduces diversification benefit.
              </div>
            )}
          </div>
        );
      })()}

      {/* Matrix */}
      <div style={{ overflowX: "auto", overflowY: "auto" }}>
        <div style={{ display: "inline-block", minWidth: totalGridW }}>

          {/* Column labels — vertical, with gap columns between clusters */}
          <div style={{ display: "flex", marginLeft: labelW, marginBottom: 4, alignItems: "flex-end", height: labelW }}>
            {tickers.flatMap((tk, j) => {
              const color = tickerColor.get(tk);
              const label = (
                <div key={tk} style={{ width: cellSize, flexShrink: 0, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
                  <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: isMobile ? 9 : 11, fontWeight: 700, color: color ?? S.muted, whiteSpace: "nowrap", lineHeight: 1 }}>
                    {tk}
                  </span>
                </div>
              );
              const gap = isBoundaryAfter(j) ? (
                <div key={`gh-${j}`} style={{ width: gapSize, flexShrink: 0, display: "flex", justifyContent: "center", alignItems: "flex-end", paddingBottom: 4 }}>
                  <div style={{ width: 1, height: "55%", background: S.border }} />
                </div>
              ) : null;
              return [label, ...(gap ? [gap] : [])];
            })}
          </div>

          {/* Rows — with gap rows between clusters and gap columns within each row */}
          {tickers.flatMap((rowTk, i) => {
            const rowColor = tickerColor.get(rowTk);

            const row = (
              <div key={rowTk} style={{ display: "flex", alignItems: "center" }}>
                {/* Row label */}
                <div style={{ width: labelW, flexShrink: 0, textAlign: "right", paddingRight: 8, fontSize: isMobile ? 9 : 11, fontWeight: 700, color: rowColor ?? S.muted }}>
                  {rowTk}
                </div>

                {/* Cells with gap columns */}
                {tickers.flatMap((colTk, j) => {
                  const r = matrix[i]?.[j] ?? NaN;
                  const isDiag = i === j;
                  const cell = (
                    <div
                      key={colTk}
                      onMouseEnter={e => handleCellEnter(e, i, j, r)}
                      onMouseLeave={() => setTooltip(null)}
                      style={{ width: cellSize, height: cellSize, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isDiag ? corrColor(1) : corrColor(r), border: `1px solid ${S.bg}`, cursor: isDiag ? "default" : "crosshair", fontSize: isMobile ? 8 : 10, fontWeight: 700, color: corrTextColor(isDiag ? 1 : r), userSelect: "none", transition: "filter 0.1s", boxSizing: "border-box" }}
                      onMouseOver={e => { if (!isDiag) (e.currentTarget as HTMLDivElement).style.filter = "brightness(1.12)"; }}
                      onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.filter = ""; }}
                    >
                      {!isMobile && (isDiag ? "1.00" : (!isNaN(r) ? fmt(r) : ""))}
                    </div>
                  );
                  const colGap = isBoundaryAfter(j) ? (
                    <div key={`gc-${j}`} style={{ width: gapSize, height: cellSize, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                      <div style={{ width: 1, height: "100%", background: S.border }} />
                    </div>
                  ) : null;
                  return [cell, ...(colGap ? [colGap] : [])];
                })}
              </div>
            );

            // Horizontal gap row between cluster groups
            const rowGap = isBoundaryAfter(i) ? (
              <div key={`gr-${i}`} style={{ display: "flex", height: gapSize, alignItems: "center" }}>
                <div style={{ width: labelW, flexShrink: 0 }} />
                <div style={{ flex: 1, height: 1, background: S.border }} />
              </div>
            ) : null;

            return [row, ...(rowGap ? [rowGap] : [])];
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: S.muted }}>Scale:</span>
        <div style={{ display: "flex", alignItems: "center", borderRadius: 4, overflow: "hidden" }}>
          {[-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map(v => (
            <div
              key={v}
              title={v.toFixed(2)}
              style={{ width: 22, height: 12, background: corrColor(v) }}
            />
          ))}
        </div>
        <span style={{ fontSize: 11, color: S.muted }}>−1 inverse · 0 none · +1 perfect</span>
      </div>

      {/* Tooltip */}
      {tooltip && !isNaN(tooltip.r) && tooltip.i !== tooltip.j && (
        <div style={{
          position: "absolute",
          left: tooltip.x + 14,
          top: tooltip.y - 10,
          background: S.tooltip,
          border: `1px solid ${S.border}`,
          borderRadius: 10,
          padding: "9px 13px",
          fontSize: 12,
          color: S.text,
          pointerEvents: "none",
          zIndex: 50,
          boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
          whiteSpace: "nowrap",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 3, fontSize: 13 }}>
            {tickers[tooltip.i]} × {tickers[tooltip.j]}
          </div>
          <div style={{ color: S.muted }}>
            r =&nbsp;
            <strong style={{
              color: tooltip.r > 0.6 ? "#ff7b72" : tooltip.r < -0.3 ? "#79c0ff" : S.emphasis,
              fontSize: 13,
            }}>
              {tooltip.r.toFixed(3)}
            </strong>
          </div>
          {stockData[tickers[tooltip.i]] && stockData[tickers[tooltip.j]] && (
            <div style={{ marginTop: 5, color: S.subtext, fontSize: 11 }}>
              1y: {stockData[tickers[tooltip.i]]["1y"]?.toFixed(1) ?? "—"}% &nbsp;/&nbsp;
              {stockData[tickers[tooltip.j]]["1y"]?.toFixed(1) ?? "—"}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}
