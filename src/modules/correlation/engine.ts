import type { CandleSeries } from "../../types";

// ─── Series alignment ─────────────────────────────────────────────

/**
 * Align two candle series by common timestamps.
 * Returns parallel arrays of closing prices for days both tickers traded.
 */
export function alignSeries(
  a: CandleSeries,
  b: CandleSeries
): [number[], number[]] {
  const bMap = new Map<number, number>();
  for (let i = 0; i < b.timestamps.length; i++) {
    bMap.set(b.timestamps[i], b.closes[i]);
  }
  const aAligned: number[] = [];
  const bAligned: number[] = [];
  for (let i = 0; i < a.timestamps.length; i++) {
    const bc = bMap.get(a.timestamps[i]);
    if (bc !== undefined) {
      aAligned.push(a.closes[i]);
      bAligned.push(bc);
    }
  }
  return [aAligned, bAligned];
}

// ─── Returns ──────────────────────────────────────────────────────

/**
 * Compute daily log returns from a chronological closing price series.
 * Returns n-1 values.
 */
export function dailyLogReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  return returns;
}

// ─── Pearson correlation ──────────────────────────────────────────

/**
 * Pearson correlation between two same-length arrays.
 * Returns NaN if fewer than 2 data points or zero variance.
 */
export function pearson(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return NaN;
  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) { sumX += x[i]; sumY += y[i]; }
  const mx = sumX / n, my = sumY / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    num  += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? NaN : num / den;
}

// ─── Matrix builder ───────────────────────────────────────────────

export interface MatrixResult {
  matrix: number[][];  // symmetric N×N, values in [-1, 1]; NaN = insufficient overlap
  minDays: number;     // minimum trading-day overlap across all pairs
}

/**
 * Build an N×N Pearson correlation matrix from daily log returns.
 * Tickers missing from candleMap produce NaN rows/columns.
 */
export function buildMatrix(
  tickers: string[],
  candleMap: Record<string, CandleSeries>
): MatrixResult {
  const n = tickers.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(NaN));
  let minDays = Infinity;

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const a = candleMap[tickers[i]];
      const b = candleMap[tickers[j]];
      if (!a || !b) continue;

      const [ac, bc] = alignSeries(a, b);
      if (ac.length < 3) continue;  // need at least 3 prices → 2 returns

      minDays = Math.min(minDays, ac.length);
      const r = pearson(dailyLogReturns(ac), dailyLogReturns(bc));
      matrix[i][j] = matrix[j][i] = r;
    }
  }

  return { matrix, minDays: isFinite(minDays) ? minDays : 0 };
}

// ─── Ticker reordering ────────────────────────────────────────────

/**
 * Cluster-aware reordering: all members of each correlation cluster appear
 * consecutively, clusters sorted largest-first, solos at the end.
 * Within each cluster, members are ordered by greedy nearest-neighbour
 * so the highest-correlated pair leads.
 *
 * Returns the new index order into `tickers`.
 */
export function reorderTickers(
  tickers: string[],
  matrix: number[][]
): number[] {
  const n = tickers.length;
  if (n <= 2) return tickers.map((_, i) => i);

  const { clusters } = clusterTickers(tickers, matrix);
  const tickerPos = new Map(tickers.map((tk, i) => [tk, i]));

  const order: number[] = [];

  for (const group of clusters) {
    const indices = group.map(tk => tickerPos.get(tk)!);
    if (indices.length === 1) continue; // solos appended below

    // Greedy nearest-neighbour within the cluster
    let seedA = indices[0], seedB = indices[1], best = -Infinity;
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const r = isNaN(matrix[indices[a]][indices[b]]) ? 0 : matrix[indices[a]][indices[b]];
        if (r > best) { best = r; seedA = indices[a]; seedB = indices[b]; }
      }
    }

    const visited = new Set<number>([seedA, seedB]);
    const clusterOrder = [seedA, seedB];
    while (clusterOrder.length < indices.length) {
      const tail = clusterOrder[clusterOrder.length - 1];
      let next = -1, nextScore = -Infinity;
      for (const idx of indices) {
        if (visited.has(idx)) continue;
        const score = isNaN(matrix[tail][idx]) ? -1 : matrix[tail][idx];
        if (score > nextScore) { nextScore = score; next = idx; }
      }
      clusterOrder.push(next);
      visited.add(next);
    }
    order.push(...clusterOrder);
  }

  // Append solos (single-member clusters)
  for (let i = 0; i < n; i++) {
    if (!order.includes(i)) order.push(i);
  }

  return order;
}

// ─── Cluster detection ───────────────────────────────────────────

export interface ClusterResult {
  clusters: string[][];  // sorted largest-first; each array is a group of tickers
  threshold: number;
}

/**
 * Union-find clustering: two tickers are in the same cluster if their
 * Pearson correlation >= threshold. Returns clusters sorted largest-first.
 */
export function clusterTickers(
  tickers: string[],
  matrix: number[][],
  threshold = 0.6
): ClusterResult {
  const n = tickers.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(i: number): number {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!isNaN(matrix[i][j]) && matrix[i][j] >= threshold) {
        parent[find(i)] = find(j);
      }
    }
  }

  const groups = new Map<number, string[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(tickers[i]);
  }

  const clusters = Array.from(groups.values()).sort((a, b) => b.length - a.length);
  return { clusters, threshold };
}

// ─── Color scale ──────────────────────────────────────────────────

/**
 * Map a correlation value in [-1, 1] to an RGB string.
 * Indigo → warm off-white → crimson diverging scale.
 */
export function corrColor(r: number): string {
  if (isNaN(r)) return "rgba(100,100,100,0.12)";

  const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
  // Zero-point: warm off-white so the grid looks neutral, not clinical
  const mid = [245, 243, 238] as const;

  if (r >= 0) {
    const t = Math.min(r, 1);
    // warm off-white → deep crimson (via rich red)
    return `rgb(${lerp(mid[0], 192, t)},${lerp(mid[1], 22, t)},${lerp(mid[2], 22, t)})`;
  } else {
    const t = Math.min(-r, 1);
    // warm off-white → deep indigo (via strong blue)
    return `rgb(${lerp(mid[0], 49, t)},${lerp(mid[1], 46, t)},${lerp(mid[2], 229, t)})`;
  }
}

/** Text color to display on top of a correlation cell. */
export function corrTextColor(r: number): string {
  if (isNaN(r)) return "rgba(150,150,150,0.6)";
  return Math.abs(r) > 0.45 ? "#fff" : "#374151";
}
