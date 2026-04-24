import { describe, it, expect } from "vitest";
import {
  alignSeries,
  dailyLogReturns,
  pearson,
  buildMatrix,
  reorderTickers,
  corrColor,
  corrTextColor,
} from "../modules/correlation/engine";
import type { CandleSeries } from "../types";

// ─── Fixtures ─────────────────────────────────────────────────────

const DAY = 86400;

/** Build a simple series with consecutive timestamps. */
function makeSeries(closes: number[], startTs = 1_000_000): CandleSeries {
  return {
    timestamps: closes.map((_, i) => startTs + i * DAY),
    closes,
  };
}

// ─── alignSeries ──────────────────────────────────────────────────

describe("alignSeries", () => {
  it("returns matching closes when timestamps are identical", () => {
    const a = makeSeries([100, 101, 102]);
    const b = makeSeries([200, 202, 204]);
    const [ac, bc] = alignSeries(a, b);
    expect(ac).toEqual([100, 101, 102]);
    expect(bc).toEqual([200, 202, 204]);
  });

  it("skips timestamps present in a but not in b", () => {
    const a = makeSeries([100, 101, 102, 103]);
    // b only has timestamps 0 and 2 (skips 1 and 3)
    const b: CandleSeries = {
      timestamps: [1_000_000, 1_000_000 + 2 * DAY],
      closes: [200, 204],
    };
    const [ac, bc] = alignSeries(a, b);
    expect(ac).toEqual([100, 102]);
    expect(bc).toEqual([200, 204]);
  });

  it("returns empty arrays when no timestamps overlap", () => {
    const a = makeSeries([100, 101], 1_000_000);
    const b = makeSeries([200, 201], 9_000_000);
    const [ac, bc] = alignSeries(a, b);
    expect(ac).toHaveLength(0);
    expect(bc).toHaveLength(0);
  });

  it("handles empty inputs gracefully", () => {
    const empty: CandleSeries = { timestamps: [], closes: [] };
    const b = makeSeries([100, 101]);
    const [ac, bc] = alignSeries(empty, b);
    expect(ac).toHaveLength(0);
    expect(bc).toHaveLength(0);
  });
});

// ─── dailyLogReturns ──────────────────────────────────────────────

describe("dailyLogReturns", () => {
  it("returns n-1 values", () => {
    expect(dailyLogReturns([100, 110, 121])).toHaveLength(2);
  });

  it("computes correct log returns", () => {
    const r = dailyLogReturns([100, 110]);
    expect(r[0]).toBeCloseTo(Math.log(110 / 100));
  });

  it("returns empty array for single price", () => {
    expect(dailyLogReturns([100])).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(dailyLogReturns([])).toHaveLength(0);
  });
});

// ─── pearson ─────────────────────────────────────────────────────

describe("pearson", () => {
  it("returns 1 for perfectly positively correlated series", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    expect(pearson(x, y)).toBeCloseTo(1);
  });

  it("returns -1 for perfectly negatively correlated series", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [10, 8, 6, 4, 2];
    expect(pearson(x, y)).toBeCloseTo(-1);
  });

  it("returns 0 for uncorrelated series", () => {
    // x = [1,2,3,4], y alternates → zero correlation
    const x = [1, 2, 3, 4];
    const y = [1, 3, 1, 3]; // zero-mean: [-1,1,-1,1], cross terms cancel with x = [-1.5,-0.5,0.5,1.5]
    // dot product: 1.5 - 0.5 - 0.5 + 1.5 = 2 — not exactly 0, use proper orthogonal
    const a = [1, -1, 1, -1];
    const b = [1,  1, -1, -1];
    // These have zero dot product: (1)(1)+(-1)(1)+(1)(-1)+(-1)(-1) = 1-1-1+1 = 0
    expect(pearson(a, b)).toBeCloseTo(0);
  });

  it("returns NaN for fewer than 2 points", () => {
    expect(pearson([1], [1])).toBeNaN();
    expect(pearson([], [])).toBeNaN();
  });

  it("returns NaN for zero-variance series", () => {
    expect(pearson([5, 5, 5], [1, 2, 3])).toBeNaN();
    expect(pearson([1, 2, 3], [5, 5, 5])).toBeNaN();
  });

  it("is symmetric", () => {
    const x = [1, 3, 2, 5, 4];
    const y = [2, 3, 5, 4, 6];
    expect(pearson(x, y)).toBeCloseTo(pearson(y, x));
  });
});

// ─── buildMatrix ─────────────────────────────────────────────────

describe("buildMatrix", () => {
  it("diagonal is always 1", () => {
    const tickers = ["A", "B", "C"];
    const candleMap: Record<string, CandleSeries> = {
      A: makeSeries([100, 102, 104, 106, 108]),
      B: makeSeries([200, 204, 208, 212, 216]),
      C: makeSeries([50, 49, 51, 50, 52]),
    };
    const { matrix } = buildMatrix(tickers, candleMap);
    expect(matrix[0][0]).toBe(1);
    expect(matrix[1][1]).toBe(1);
    expect(matrix[2][2]).toBe(1);
  });

  it("matrix is symmetric", () => {
    const tickers = ["A", "B"];
    const candleMap: Record<string, CandleSeries> = {
      A: makeSeries([100, 102, 98, 105, 103]),
      B: makeSeries([200, 204, 196, 210, 206]),
    };
    const { matrix } = buildMatrix(tickers, candleMap);
    expect(matrix[0][1]).toBeCloseTo(matrix[1][0]);
  });

  it("perfectly correlated series yields matrix[i][j] ≈ 1", () => {
    const tickers = ["A", "B"];
    const base    = [100, 110, 108, 115, 120];
    const candleMap: Record<string, CandleSeries> = {
      A: makeSeries(base),
      B: makeSeries(base.map(v => v * 2)), // same returns
    };
    const { matrix } = buildMatrix(tickers, candleMap);
    expect(matrix[0][1]).toBeCloseTo(1, 5);
  });

  it("returns NaN for missing tickers in candleMap", () => {
    const tickers = ["A", "B"];
    const candleMap: Record<string, CandleSeries> = {
      A: makeSeries([100, 102, 104]),
      // B is missing
    };
    const { matrix } = buildMatrix(tickers, candleMap);
    expect(matrix[0][1]).toBeNaN();
    expect(matrix[1][0]).toBeNaN();
  });

  it("returns NaN for series with insufficient overlap (< 3 points)", () => {
    const tickers = ["A", "B"];
    const candleMap: Record<string, CandleSeries> = {
      A: { timestamps: [1_000_000], closes: [100] },
      B: { timestamps: [1_000_000], closes: [200] },
    };
    const { matrix } = buildMatrix(tickers, candleMap);
    expect(matrix[0][1]).toBeNaN();
  });

  it("reports correct minDays for overlapping series", () => {
    const tickers = ["A", "B"];
    const candleMap: Record<string, CandleSeries> = {
      A: makeSeries([100, 101, 102, 103, 104]),
      B: makeSeries([200, 202, 204, 206, 208]),
    };
    const { minDays } = buildMatrix(tickers, candleMap);
    expect(minDays).toBe(5); // full 5-point overlap
  });

  it("reports 0 minDays when no valid pairs", () => {
    const tickers = ["A", "B"];
    const candleMap: Record<string, CandleSeries> = {
      A: makeSeries([100, 101]),
      // B missing
    };
    const { minDays } = buildMatrix(tickers, candleMap);
    expect(minDays).toBe(0);
  });

  it("handles single ticker (1×1 matrix)", () => {
    const { matrix, minDays } = buildMatrix(["A"], { A: makeSeries([100, 101, 102]) });
    expect(matrix).toHaveLength(1);
    expect(matrix[0][0]).toBe(1);
    expect(minDays).toBe(0);
  });
});

// ─── reorderTickers ───────────────────────────────────────────────

describe("reorderTickers", () => {
  it("returns [0, 1] for two tickers", () => {
    const matrix = [[1, 0.8], [0.8, 1]];
    expect(reorderTickers(["A", "B"], matrix)).toEqual([0, 1]);
  });

  it("returns identity order for single ticker", () => {
    expect(reorderTickers(["A"], [[1]])).toEqual([0]);
  });

  it("includes every index exactly once", () => {
    const n = 5;
    const tickers = ["A", "B", "C", "D", "E"];
    const matrix = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 1 : Math.random() * 2 - 1))
    );
    const order = reorderTickers(tickers, matrix);
    expect(order.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });

  it("places highest-corr pair first when all others are low", () => {
    // A and D are highly correlated, rest are near 0
    const tickers = ["A", "B", "C", "D"];
    const matrix = [
      [1,    0.0,  0.0,  0.9],
      [0.0,  1,    0.0,  0.0],
      [0.0,  0.0,  1,    0.0],
      [0.9,  0.0,  0.0,  1  ],
    ];
    const order = reorderTickers(tickers, matrix);
    // A (idx 0) and D (idx 3) should be adjacent at the start
    const posA = order.indexOf(0);
    const posD = order.indexOf(3);
    expect(Math.abs(posA - posD)).toBe(1);
  });
});

// ─── corrColor ────────────────────────────────────────────────────

describe("corrColor", () => {
  it("returns a non-empty string for valid inputs", () => {
    expect(corrColor(1)).toBeTruthy();
    expect(corrColor(0)).toBeTruthy();
    expect(corrColor(-1)).toBeTruthy();
  });

  it("positive values produce red-ish colors (r > b)", () => {
    const color = corrColor(1);
    const [r, g] = color.match(/\d+/g)!.map(Number);
    expect(r).toBeGreaterThan(g); // red channel dominant
  });

  it("negative values produce blue-ish colors (b > r)", () => {
    const color = corrColor(-1);
    const channels = color.match(/\d+/g)!.map(Number);
    const [r, , b] = channels;
    expect(b).toBeGreaterThan(r); // blue channel dominant
  });

  it("returns rgba string for NaN", () => {
    expect(corrColor(NaN)).toContain("rgba");
  });
});

// ─── corrTextColor ────────────────────────────────────────────────

describe("corrTextColor", () => {
  it("returns white for strong correlations (|r| > 0.55)", () => {
    expect(corrTextColor(0.9)).toBe("#fff");
    expect(corrTextColor(-0.9)).toBe("#fff");
  });

  it("returns dark color for weak correlations", () => {
    expect(corrTextColor(0.2)).toBe("#374151");
    expect(corrTextColor(-0.2)).toBe("#374151");
  });

  it("returns muted string for NaN", () => {
    expect(corrTextColor(NaN)).toContain("rgba");
  });
});
