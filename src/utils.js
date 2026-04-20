// ─── Squarified Treemap ────────────────────────────────────────────
export function computeTreemap(items, W, H) {
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
// Tighter ±8% scale for richer mid-range differentiation.
// Negative: dark burgundy → deep crimson (avoids harsh traffic-light red).
// Positive: dark forest → rich emerald (adds blue-green warmth at extremes).
export function perfColor(pct) {
  if (pct === null || pct === undefined || isNaN(pct)) return "#1e293b";
  if (Math.abs(pct) < 0.2) return "#334155";
  const t = Math.max(-1, Math.min(1, pct / 8));
  if (t < 0) {
    const i = -t;
    return `rgb(${Math.round(42 + 143 * i)},${Math.round(28 - 8 * i)},${Math.round(36 - 16 * i)})`;
  }
  return `rgb(${Math.round(24 - 10 * t)},${Math.round(68 + 107 * t)},${Math.round(42 + 26 * t)})`;
}

// ─── Demo detection ───────────────────────────────────────────────
export const IS_DEMO = (key) => {
  const saved = localStorage.getItem(key);
  if (!saved) return true;
  try {
    const parsed = JSON.parse(saved);
    return !parsed || parsed.length === 0;
  } catch { return true; }
};

// ─── History helpers (pure transforms, no side effects) ───────────

// Add or overwrite today's snapshot; cap at 365 entries sorted by date.
export function applySnapshot(prev, dateStr, value, change) {
  return [...prev.filter(h => h.date !== dateStr), { date: dateStr, value, change }]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-365);
}

// Append an event; prune anything older than 1 year.
export function applyEvent(prev, event) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return [...prev.filter(e => e.date >= cutoffStr), event];
}
