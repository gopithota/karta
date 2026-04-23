import { useState, useRef } from "react";
import type { HistoryEntry, PortfolioEvent, Theme } from "../../types";

interface Props {
  history: HistoryEntry[];
  events: PortfolioEvent[];
  S: Theme;
}

export default function HistoryChart({ history, events, S }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [hovEvent, setHovEvent] = useState<EventMarker | null>(null);
  const hovEventRef = useRef<EventMarker | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const fmtVal = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  };
  const fmtDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const setHovEventSync = (v: EventMarker | null) => { hovEventRef.current = v; setHovEvent(v); };

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

  // Date-based X scale
  const minMs = new Date(history[0].date + "T12:00:00").getTime();
  const maxMs = new Date(history[history.length - 1].date + "T12:00:00").getTime();
  const xScale = (dateStr: string) => {
    if (maxMs === minMs) return PAD.left + cW / 2;
    return PAD.left + ((new Date(dateStr + "T12:00:00").getTime() - minMs) / (maxMs - minMs)) * cW;
  };
  const yScale = (v: number) => PAD.top + cH - ((v - minVal) / valRange) * cH;

  const pts = history.map(h => ({ x: xScale(h.date), y: yScale(h.value) }));
  const yTicks = Array.from({ length: 5 }, (_, i) => minVal + (i / 4) * valRange);

  const xLabels: { x: number; label: string }[] = [];
  if (history.length <= 6) {
    history.forEach(h => xLabels.push({ x: xScale(h.date), label: fmtDate(h.date) }));
  } else {
    let prevMonth: string | null = null;
    history.forEach(h => {
      const m = h.date.slice(0, 7);
      if (m !== prevMonth) { xLabels.push({ x: xScale(h.date), label: fmtDate(h.date) }); prevMonth = m; }
    });
  }

  // Segment line at portfolio event boundaries
  const evtDates = [...new Set(events.map(e => e.date))].sort();
  const segRanges: { start: number; end: number }[] = [];
  let segStart = 0;
  for (let i = 1; i < history.length; i++) {
    const crosses = evtDates.some(ed => ed > history[i - 1].date && ed <= history[i].date);
    if (crosses) { segRanges.push({ start: segStart, end: i - 1 }); segStart = i; }
  }
  segRanges.push({ start: segStart, end: history.length - 1 });
  const validRanges = segRanges.filter(r => r.start <= r.end);

  const lastRange = validRanges[validRanges.length - 1];
  const lastSegTrend = lastRange && lastRange.end > lastRange.start
    ? history[lastRange.end].value - history[lastRange.start].value
    : (vals.length >= 2 ? vals[vals.length - 1] - vals[0] : 0);
  const lineColor = lastSegTrend >= 0 ? S.green : "#f87171";

  interface EventMarker {
    date: string;
    evts: PortfolioEvent[];
    x: number;
    color: string;
  }

  const eventMarkers: EventMarker[] = [];
  const seenEvtDates = new Set<string>();
  events.forEach(ev => {
    if (seenEvtDates.has(ev.date)) return;
    seenEvtDates.add(ev.date);
    const dateEvts = events.filter(e => e.date === ev.date);
    const hasAdd    = dateEvts.some(e => e.type === "add" || e.type === "update");
    const hasRemove = dateEvts.some(e => e.type === "remove");
    const color = hasAdd && hasRemove ? "#facc15" : hasRemove ? "#f87171" : S.green;
    eventMarkers.push({ date: ev.date, evts: dateEvts, x: xScale(ev.date), color });
  });

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || history.length === 0 || hovEventRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width * W;
    let closest = 0, closestDist = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(p.x - mx); if (d < closestDist) { closestDist = d; closest = i; } });
    setHover(closest);
  };

  const hovPt = hover != null && !hovEvent ? pts[hover] : null;
  const hovH  = hover != null && !hovEvent ? history[hover] : null;

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

        {xLabels.map(({ x, label }) => (
          <text key={label} x={x} y={H - 6} textAnchor="middle" fill={S.chartLabel} fontSize={10}>{label}</text>
        ))}

        {eventMarkers.map((em) => (
          <g
            key={em.date}
            onMouseEnter={() => { setHover(null); setHovEventSync(em); }}
            onMouseLeave={() => setHovEventSync(null)}
            onMouseMove={e => e.stopPropagation()}
            style={{ cursor: "default" }}
          >
            <line x1={em.x} x2={em.x} y1={PAD.top} y2={PAD.top + cH} stroke={em.color} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.65} />
            <line x1={em.x} x2={em.x} y1={PAD.top} y2={PAD.top + cH} stroke="transparent" strokeWidth={14} />
            <circle cx={em.x} cy={PAD.top + 2} r={5} fill={em.color} />
          </g>
        ))}

        {validRanges.map(({ start, end }, si) => {
          const segPts = pts.slice(start, end + 1);
          if (segPts.length === 1) {
            return <circle key={si} cx={segPts[0].x} cy={segPts[0].y} r={5} fill={lineColor} />;
          }
          const segLine = segPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
          const baseline = (PAD.top + cH).toFixed(1);
          return (
            <g key={si}>
              <path d={`${segLine} L${segPts[segPts.length - 1].x.toFixed(1)},${baseline} L${segPts[0].x.toFixed(1)},${baseline} Z`} fill="url(#histAreaGrad)" />
              <path d={segLine} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}

        {hovPt && (
          <g>
            <line x1={hovPt.x} x2={hovPt.x} y1={PAD.top} y2={PAD.top + cH} stroke={S.chartCross} strokeWidth={1} strokeDasharray="3,3" />
            <circle cx={hovPt.x} cy={hovPt.y} r={5} fill={lineColor} stroke={S.bg} strokeWidth={2} />
          </g>
        )}
      </svg>

      {hovEvent && (() => {
        const leftPct = (hovEvent.x / W) * 100;
        return (
          <div style={{ position: "absolute", top: "13%", left: leftPct > 65 ? "auto" : `${leftPct}%`, right: leftPct > 65 ? `${100 - leftPct}%` : "auto", transform: leftPct <= 65 ? "translateX(-50%)" : "none", background: S.tooltip, border: `1px solid ${hovEvent.color}44`, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", borderRadius: 8, padding: "8px 12px", pointerEvents: "none", zIndex: 10, minWidth: 148 }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 5 }}>
              {new Date(hovEvent.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </div>
            {hovEvent.evts.map((ev, i) => (
              <div key={i} style={{ lineHeight: 1.7 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5, fontSize: 12, fontWeight: 600, color: ev.type === "add" ? S.green : ev.type === "remove" ? "#f87171" : S.link }}>
                  <span style={{ fontWeight: 800 }}>{ev.type === "add" ? "+" : ev.type === "remove" ? "−" : "~"}</span>
                  <span>{ev.ticker}</span>
                  <span style={{ color: S.muted, fontWeight: 400 }}>
                    {ev.type === "update" ? `${ev.prevShares} → ${ev.shares}sh` : `${ev.shares}sh`}
                  </span>
                </div>
                {ev.note && <div style={{ fontSize: 10, color: S.muted, fontStyle: "italic", marginTop: -2, maxWidth: 180, lineHeight: 1.4 }}>{ev.note}</div>}
              </div>
            ))}
          </div>
        );
      })()}

      {hovH && hovPt && (() => {
        const leftPct = (hovPt.x / W) * 100;
        return (
          <div style={{ position: "absolute", top: 8, left: leftPct > 65 ? "auto" : `${leftPct}%`, right: leftPct > 65 ? `${100 - leftPct}%` : "auto", transform: leftPct <= 65 ? "translateX(-50%)" : "none", background: S.tooltip, border: `1px solid ${S.border}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", padding: "8px 12px", pointerEvents: "none", zIndex: 10, minWidth: 148 }}>
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
