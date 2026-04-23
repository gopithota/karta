import type { TreemapItem, TreemapRect, HistoryEntry, PortfolioEvent } from "./types";

// Internal type used during treemap layout — TreemapItem + computed area
type TreemapNode = TreemapItem & { area: number };

// ─── Squarified Treemap ────────────────────────────────────────────
export function computeTreemap(
  items: TreemapItem[],
  W: number,
  H: number
): TreemapRect[] {
  if (!items.length || W <= 0 || H <= 0) return [];
  const total = items.reduce((s, i) => s + Math.max(i.weight, 0.001), 0);
  const nodes: TreemapNode[] = items
    .map(i => ({ ...i, area: (Math.max(i.weight, 0.001) / total) * W * H }))
    .sort((a, b) => b.area - a.area);
  const result: TreemapRect[] = [];

  function worst(row: TreemapNode[], rowArea: number, axisLen: number): number {
    const sv = rowArea / axisLen;
    let w = 0;
    for (const n of row) {
      const ia = (n.area / rowArea) * axisLen;
      w = Math.max(w, Math.max(sv / ia, ia / sv));
    }
    return w;
  }

  function squarify(
    nodes: TreemapNode[],
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    if (!nodes.length || w < 1 || h < 1) return;
    if (nodes.length === 1) { result.push({ ...nodes[0], x, y, w, h }); return; }
    const leftStrip = w >= h;
    const axisLen = leftStrip ? h : w;
    let row: TreemapNode[] = [], rowArea = 0, nextIdx = 0;
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
// Google Finance-inspired palette: light pastels for small moves,
// deep saturated for strong ones. Light tiles use dark text (see tileFgColor).
// Green: #E6F4EA (Google green-light) → #137333 (Google green-dark)
// Red:   #FCE8E6 (Google red-light)   → #A50E0E (Google red-dark)
export function perfColor(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || isNaN(pct)) return "#D1D5DB";
  if (Math.abs(pct) < 0.2) return "#E8EAED";
  const t = Math.max(-1, Math.min(1, pct / 8));
  if (t < 0) {
    const i = -t;
    // #FCE8E6 (rgb 252,232,230) → #A50E0E (rgb 165,14,14)
    return `rgb(${Math.round(252 - 87 * i)},${Math.round(232 - 218 * i)},${Math.round(230 - 216 * i)})`;
  }
  // #E6F4EA (rgb 230,244,234) → #137333 (rgb 19,115,51)
  return `rgb(${Math.round(230 - 211 * t)},${Math.round(244 - 129 * t)},${Math.round(234 - 183 * t)})`;
}

// ─── Tile text colors ─────────────────────────────────────────────
// Dark on light backgrounds, white on dark ones.
// Tiles stronger than |pct| > 6% (t > 0.75) are dark enough for white text.
export interface TileFgColor {
  primary: string;
  secondary: string;
  tertiary: string;
}

export function tileFgColor(pct: number | null | undefined): TileFgColor {
  const t = (pct != null && !isNaN(pct as number)) ? Math.abs(pct as number) / 8 : 0;
  if (t > 0.75) {
    return { primary: "rgba(255,255,255,0.92)", secondary: "rgba(255,255,255,0.78)", tertiary: "rgba(255,255,255,0.50)" };
  }
  if (pct == null || isNaN(pct as number) || Math.abs(pct as number) < 0.2) {
    return { primary: "rgba(60,64,67,0.80)", secondary: "rgba(60,64,67,0.60)", tertiary: "rgba(60,64,67,0.38)" };
  }
  if ((pct as number) > 0) {
    return { primary: "rgba(7,46,21,0.90)", secondary: "rgba(7,46,21,0.72)", tertiary: "rgba(7,46,21,0.45)" };
  }
  return { primary: "rgba(66,6,6,0.90)", secondary: "rgba(66,6,6,0.72)", tertiary: "rgba(66,6,6,0.45)" };
}

// ─── Demo detection ───────────────────────────────────────────────
export const IS_DEMO = (key: string): boolean => {
  const saved = localStorage.getItem(key);
  if (!saved) return true;
  try {
    const parsed = JSON.parse(saved);
    return !parsed || parsed.length === 0;
  } catch { return true; }
};

// ─── History helpers (pure transforms, no side effects) ───────────

// Add or overwrite today's snapshot; cap at 365 entries sorted by date.
export function applySnapshot(
  prev: HistoryEntry[],
  dateStr: string,
  value: number,
  change: number | null
): HistoryEntry[] {
  return [...prev.filter(h => h.date !== dateStr), { date: dateStr, value, change }]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-365);
}

// Append an event; prune anything older than 1 year.
export function applyEvent(
  prev: PortfolioEvent[],
  event: PortfolioEvent
): PortfolioEvent[] {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return [...prev.filter(e => e.date >= cutoffStr), event];
}
