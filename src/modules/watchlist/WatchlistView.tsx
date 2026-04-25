import { useMemo, useState } from "react";
import { usePortfolioStore } from "../../store/usePortfolioStore";
import { perfColor, tileFgColor } from "../../utils";
import { LEGEND_STOPS } from "../../constants";
import { buildMatrix, alignSeries, dailyLogReturns, pearson, corrTextColor } from "../correlation/engine";
import type { Theme, NewsItem, CandleSeries } from "../../types";

// ── 30-day performance from candle data ───────────────────────────
// Normalised by ÷2.5 when passed to perfColor so ±20% uses the full
// red→green scale (same visual range as ±8% daily).
const PERF_30D_SCALE = 2.5;

function calc30dPerf(
  ticker: string,
  candleData: Record<string, CandleSeries>,
  currentPrice: number | undefined,
): number | null {
  const candle = candleData[ticker];
  if (!candle?.timestamps.length || !currentPrice) return null;
  const cutoff = Date.now() / 1000 - 30 * 86400;
  let idx = -1;
  for (let i = 0; i < candle.timestamps.length; i++) {
    if (candle.timestamps[i] <= cutoff) idx = i;
    else break;
  }
  if (idx < 0 || !candle.closes[idx]) return null;
  return ((currentPrice - candle.closes[idx]) / candle.closes[idx]) * 100;
}

// ─── Correlation colour (mustard ↔ cornflower blue) ───────────────

const C_POS: [number, number, number] = [230, 168, 38];
const C_NEG: [number, number, number] = [65, 140, 210];
const C_MID: [number, number, number] = [245, 243, 238];

function cellColor(r: number): string {
  if (isNaN(r)) return "rgba(120,120,120,0.10)";
  const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
  if (r >= 0) {
    const t = Math.min(r, 1);
    return `rgb(${lerp(C_MID[0], C_POS[0], t)},${lerp(C_MID[1], C_POS[1], t)},${lerp(C_MID[2], C_POS[2], t)})`;
  }
  const t = Math.min(-r, 1);
  return `rgb(${lerp(C_MID[0], C_NEG[0], t)},${lerp(C_MID[1], C_NEG[1], t)},${lerp(C_MID[2], C_NEG[2], t)})`;
}

function corrStrength(r: number): string {
  const a = Math.abs(r);
  const dir = r >= 0 ? "positive" : "negative";
  if (a >= 0.75) return `strong ${dir}`;
  if (a >= 0.5)  return `moderate ${dir}`;
  if (a >= 0.25) return `weak ${dir}`;
  return "uncorrelated";
}

function timeAgo(unix: number): string {
  const h = Math.floor((Date.now() / 1000 - unix) / 3600);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────

function MiniMatrix({
  tickers, matrix, S,
}: {
  tickers: string[];
  matrix: number[][];
  S: Theme;
}) {
  const n = tickers.length;
  const CELL = Math.max(24, Math.min(40, Math.floor(260 / n)));
  const LABEL_W = 36;
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);

  return (
    <div style={{ overflowX: "auto" }}>
      {/* Column labels */}
      <div style={{ display: "flex", paddingLeft: LABEL_W }}>
        {tickers.map(t => (
          <div key={t} style={{ width: CELL, flexShrink: 0, fontSize: 9, fontWeight: 700, color: S.muted, textAlign: "center", overflow: "hidden", paddingBottom: 4 }}>
            {t.slice(0, 4)}
          </div>
        ))}
      </div>

      {/* Rows */}
      {tickers.map((rowT, i) => (
        <div key={rowT} style={{ display: "flex", alignItems: "center" }}>
          {/* Row label */}
          <div style={{ width: LABEL_W, flexShrink: 0, fontSize: 9, fontWeight: 700, color: S.muted, textAlign: "right", paddingRight: 5, overflow: "hidden" }}>
            {rowT.slice(0, 4)}
          </div>
          {/* Cells */}
          {tickers.map((_, j) => {
            const r = matrix[i]?.[j] ?? NaN;
            const isHovered = hover?.i === i && hover?.j === j;
            return (
              <div
                key={j}
                title={i === j ? rowT : `${tickers[i]} ↔ ${tickers[j]}: ${isNaN(r) ? "–" : r.toFixed(2)}`}
                style={{
                  width: CELL, height: CELL, flexShrink: 0,
                  background: cellColor(r),
                  borderRadius: 3, margin: 1,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: Math.min(9, CELL / 4.5),
                  color: corrTextColor(r),
                  fontWeight: 700,
                  cursor: "default",
                  outline: isHovered ? `2px solid ${S.accent}` : undefined,
                  transition: "outline 0.1s",
                }}
                onMouseEnter={() => setHover({ i, j })}
                onMouseLeave={() => setHover(null)}
              >
                {i === j ? "·" : (!isNaN(r) && CELL >= 32) ? r.toFixed(2) : ""}
              </div>
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 8, paddingLeft: LABEL_W }}>
        <span style={{ fontSize: 9, color: S.muted }}>−1</span>
        {[-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map(v => (
          <div key={v} style={{ width: 10, height: 10, background: cellColor(v), borderRadius: 2 }} />
        ))}
        <span style={{ fontSize: 9, color: S.muted }}>+1</span>
      </div>
    </div>
  );
}

function CrossInsights({
  wlTickers, portfolio, candleData, S,
}: {
  wlTickers: string[];
  portfolio: { ticker: string }[];
  candleData: Record<string, { timestamps: number[]; closes: number[] }>;
  S: Theme;
}) {
  const insights = useMemo(() => {
    const pairs: { wl: string; port: string; r: number }[] = [];
    for (const wt of wlTickers) {
      for (const { ticker: pt } of portfolio) {
        if (wt === pt) continue;
        const ca = candleData[wt], cb = candleData[pt];
        if (!ca || !cb) continue;
        const [ac, bc] = alignSeries(ca, cb);
        if (ac.length < 10) continue;
        const r = pearson(dailyLogReturns(ac), dailyLogReturns(bc));
        if (!isNaN(r)) pairs.push({ wl: wt, port: pt, r });
      }
    }
    return pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 5);
  }, [wlTickers, portfolio, candleData]);

  if (!insights.length) return null;

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${S.border}`, paddingTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: S.muted, letterSpacing: "0.06em", marginBottom: 8 }}>
        VS YOUR PORTFOLIO
      </div>
      {insights.map(({ wl, port, r }) => {
        const barPct = Math.abs(r) * 100;
        const color = r >= 0 ? "#d4a017" : "#5a9fd4";
        return (
          <div key={`${wl}-${port}`} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: S.text, width: 80, flexShrink: 0, whiteSpace: "nowrap" }}>
              {wl} ↔ {port}
            </span>
            <div style={{ flex: 1, height: 4, background: S.border, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${barPct}%`, height: "100%", background: color, borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color, width: 36, textAlign: "right", flexShrink: 0 }}>
              {r >= 0 ? "+" : ""}{r.toFixed(2)}
            </span>
            <span style={{ fontSize: 10, color: S.muted, flexShrink: 0, minWidth: 100 }}>
              {corrStrength(r)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function NewsPanel({
  tickers, watchlistNews, watchlistLoading, S, isMobile,
}: {
  tickers: string[];
  watchlistNews: Record<string, NewsItem[]>;
  watchlistLoading: boolean;
  S: Theme;
  isMobile: boolean;
}) {
  const articles = useMemo(() =>
    tickers.flatMap(ticker =>
      (watchlistNews[ticker] ?? []).map(a => ({ ...a, ticker }))
    ).sort((a, b) => b.datetime - a.datetime),
    [tickers, watchlistNews]
  );

  const hasData = articles.length > 0;
  const stillLoading = watchlistLoading && !hasData;

  return (
    <div style={{ background: S.panel, borderRadius: 12, border: `1px solid ${S.border}`, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "12px 18px", borderBottom: `1px solid ${S.border}`, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: S.text }}>Recent News</span>
        <span style={{ fontSize: 11, color: S.muted }}>via Finnhub · last 14 days</span>
      </div>

      {stillLoading && (
        <div style={{ padding: "28px 20px", textAlign: "center", color: S.muted, fontSize: 13 }}>
          Loading news…
        </div>
      )}

      {!stillLoading && !hasData && (
        <div style={{ padding: "28px 20px", textAlign: "center", color: S.muted, fontSize: 13 }}>
          No recent news found for these tickers
        </div>
      )}

      {hasData && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
          {articles.map((a, idx) => {
            const isRightCol = !isMobile && idx % 2 === 1;
            const isLastRow  = idx >= articles.length - (isMobile ? 1 : 2);
            return (
              <a
                key={`${a.ticker}-${a.datetime}-${idx}`}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex", flexDirection: "row", alignItems: "center", gap: 12,
                  padding: "12px 16px",
                  borderBottom: isLastRow ? undefined : `1px solid ${S.border}`,
                  borderLeft: isRightCol ? `1px solid ${S.border}` : undefined,
                  textDecoration: "none", color: "inherit",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = S.bg; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
              >
                {/* Text */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 4, background: S.bg, border: `1px solid ${S.border}`, color: S.muted, letterSpacing: "0.04em", flexShrink: 0 }}>{a.ticker}</span>
                    <span style={{ fontSize: 10, color: S.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.source}</span>
                    <span style={{ fontSize: 10, color: S.subtext, marginLeft: "auto", flexShrink: 0 }}>{timeAgo(a.datetime)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: S.text, lineHeight: 1.45, fontWeight: 500 }}>{a.headline}</div>
                  <div style={{ fontSize: 11, color: S.link, fontWeight: 600 }}>Read →</div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────

export default function WatchlistView() {
  const S                 = usePortfolioStore(s => s.S);
  const isMobile          = usePortfolioStore(s => s.isMobile);
  const watchlists        = usePortfolioStore(s => s.watchlists);
  const heatmapView       = usePortfolioStore(s => s.heatmapView);
  const stockData         = usePortfolioStore(s => s.stockData);
  const candleData        = usePortfolioStore(s => s.candleData);
  const watchlistNews     = usePortfolioStore(s => s.watchlistNews);
  const watchlistLoading  = usePortfolioStore(s => s.watchlistLoading);
  const portfolio         = usePortfolioStore(s => s.portfolio);

  const [tileTooltip, setTileTooltip] = useState<{ ticker: string; perf: number | null; perf30d: number | null; price: number | null } | null>(null);
  const [perfView, setPerfView] = useState<"1D" | "1M">("1D");

  const wlIdx     = heatmapView === "watchlist1" ? 0 : 1;
  const watchlist = watchlists[wlIdx];
  const tickers   = watchlist?.tickers ?? [];

  // ── Tile grid ─────────────────────────────────────────────────────
  const TILE = isMobile ? 88 : 120;
  const GAP  = 6;
  const cols = Math.max(1, Math.ceil(Math.sqrt(tickers.length)));

  // ── Correlation matrix ────────────────────────────────────────────
  const { orderedTickers, orderedMatrix } = useMemo(() => {
    const available = tickers.filter(t => candleData[t]);
    if (available.length < 2) return { orderedTickers: available, orderedMatrix: [] };
    const { matrix } = buildMatrix(available, candleData);
    return { orderedTickers: available, orderedMatrix: matrix };
  }, [tickers, candleData]);

  const hasCorrelationData = orderedMatrix.length >= 2;

  return (
    <div style={{ position: "absolute", inset: 0, overflowY: "auto", background: S.bg, padding: isMobile ? 12 : 20 }}>

      {/* ── Top row: heatmap (left) + correlation (right) ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap: 16,
        marginBottom: 16,
        alignItems: "start",
      }}>

        {/* ── Heatmap card ── */}
        <div style={{ background: S.panel, borderRadius: 12, border: `1px solid ${S.border}`, overflow: "hidden" }}>
          {/* Card header */}
          <div style={{ padding: "12px 18px", borderBottom: `1px solid ${S.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: S.text }}>{watchlist?.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: S.muted }}>{tickers.length} tickers</span>
              {/* 1D / 1M toggle */}
              <div style={{ display: "flex", background: S.bg, border: `1px solid ${S.border}`, borderRadius: 6, padding: 2, gap: 1 }}>
                {(["1D", "1M"] as const).map(v => (
                  <button key={v} onClick={() => setPerfView(v)} style={{
                    padding: "2px 8px", borderRadius: 4, border: "none",
                    cursor: "pointer", fontSize: 11, fontWeight: perfView === v ? 700 : 500,
                    background: perfView === v ? S.tabActiveBg : "transparent",
                    color: perfView === v ? S.tabActiveText : S.muted,
                    transition: "all 0.15s",
                  }}>{v}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Tiles */}
          <div style={{ padding: isMobile ? 16 : 24, display: "flex", justifyContent: "center", alignItems: "center", minHeight: 180, position: "relative" }}>
            {watchlistLoading && !tickers.some(t => stockData[t]) ? (
              <div style={{ color: S.muted, fontSize: 13 }}>Loading…</div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, ${TILE}px)`,
                gap: GAP,
              }}>
                {tickers.map(ticker => {
                  const d      = stockData[ticker];
                  const perf1d = d?.today ?? null;
                  const perf30 = calc30dPerf(ticker, candleData, d?.price);
                  const price  = d?.price ?? null;
                  const perf   = perfView === "1D" ? perf1d : perf30;
                  // For 30d, normalise by PERF_30D_SCALE so ±20% saturates the colour scale
                  const colorPerf = perfView === "1M" && perf != null ? perf / PERF_30D_SCALE : perf;
                  const fg     = tileFgColor(colorPerf);
                  return (
                    <div
                      key={ticker}
                      style={{
                        width: TILE, height: TILE,
                        background: perfColor(colorPerf),
                        borderRadius: 8,
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 3,
                        cursor: "default",
                        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.10)",
                        transition: "filter 0.15s",
                        position: "relative",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.filter = "brightness(0.91)";
                        setTileTooltip({ ticker, perf: perf1d, perf30d: perf30, price });
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.filter = "";
                        setTileTooltip(null);
                      }}
                    >
                      <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: fg.primary, lineHeight: 1, letterSpacing: "-0.02em" }}>{ticker}</div>
                      {perf  != null && <div style={{ fontSize: isMobile ? 10 : 12, fontWeight: 600, color: fg.secondary, lineHeight: 1 }}>{perf >= 0 ? "+" : ""}{perf.toFixed(2)}%</div>}
                      {price != null && <div style={{ fontSize: isMobile ? 9 : 11, color: fg.tertiary, lineHeight: 1 }}>${price.toFixed(2)}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tile tooltip */}
            {tileTooltip && (
              <div style={{ position: "absolute", bottom: 12, left: 16, background: S.tooltip, border: `1px solid ${S.border}`, borderRadius: 9, padding: "9px 13px", pointerEvents: "none", zIndex: 10, minWidth: 140 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{tileTooltip.ticker}</div>
                {tileTooltip.price   != null && <div style={{ fontSize: 12, color: S.muted }}>Price: <strong style={{ color: S.text }}>${tileTooltip.price.toFixed(2)}</strong></div>}
                {tileTooltip.perf    != null && <div style={{ fontSize: 12, fontWeight: 600, color: tileTooltip.perf >= 0 ? S.green : "#f87171", marginTop: 2 }}>Today: {tileTooltip.perf >= 0 ? "+" : ""}{tileTooltip.perf.toFixed(2)}%</div>}
                {tileTooltip.perf30d != null && <div style={{ fontSize: 12, fontWeight: 600, color: tileTooltip.perf30d >= 0 ? S.green : "#f87171", marginTop: 1 }}>30d: {tileTooltip.perf30d >= 0 ? "+" : ""}{tileTooltip.perf30d.toFixed(2)}%</div>}
              </div>
            )}
          </div>

          {/* Colour legend */}
          <div style={{ padding: "8px 18px", borderTop: `1px solid ${S.border}`, display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 9, color: S.muted }}>{perfView === "1M" ? "−20%" : "−8%"}</span>
            {LEGEND_STOPS.map(v => <div key={v} style={{ width: 11, height: 11, background: perfColor(v), borderRadius: 2 }} />)}
            <span style={{ fontSize: 9, color: S.muted }}>{perfView === "1M" ? "+20%" : "+8%"}</span>
          </div>
        </div>

        {/* ── Correlation card ── */}
        <div style={{ background: S.panel, borderRadius: 12, border: `1px solid ${S.border}`, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: `1px solid ${S.border}`, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: S.text }}>Correlations</span>
            <span style={{ fontSize: 11, color: S.muted }}>1Y daily returns</span>
          </div>

          <div style={{ padding: isMobile ? 14 : 18 }}>
            {tickers.length < 2 ? (
              <div style={{ fontSize: 13, color: S.muted }}>Add at least 2 tickers to see correlations.</div>
            ) : !hasCorrelationData ? (
              <div style={{ fontSize: 13, color: S.muted }}>
                {watchlistLoading ? "Loading historical data…" : "Historical data not available yet — try refreshing."}
              </div>
            ) : (
              <MiniMatrix tickers={orderedTickers} matrix={orderedMatrix} S={S} />
            )}

            {/* Cross-portfolio insights */}
            {tickers.length > 0 && portfolio.length > 0 && (
              <CrossInsights
                wlTickers={tickers}
                portfolio={portfolio}
                candleData={candleData}
                S={S}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── News section ── */}
      <NewsPanel
        tickers={tickers}
        watchlistNews={watchlistNews}
        watchlistLoading={watchlistLoading}
        S={S}
        isMobile={isMobile}
      />

    </div>
  );
}
