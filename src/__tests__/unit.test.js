import { describe, test, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { computeTreemap, perfColor, IS_DEMO, applySnapshot, applyEvent } from "../utils.js";
import { THEMES, SWATCHES, useTheme } from "../theme.js";

// ─── computeTreemap ───────────────────────────────────────────────
describe("computeTreemap", () => {
  test("returns empty array for empty input", () => {
    expect(computeTreemap([], 800, 600)).toEqual([]);
  });

  test("returns empty for zero width or height", () => {
    const item = [{ id: "A", weight: 10 }];
    expect(computeTreemap(item, 0, 600)).toEqual([]);
    expect(computeTreemap(item, 800, 0)).toEqual([]);
  });

  test("single item fills the entire canvas", () => {
    const [r] = computeTreemap([{ id: "A", weight: 100 }], 400, 300);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(0);
    expect(r.w).toBeCloseTo(400);
    expect(r.h).toBeCloseTo(300);
  });

  test("output length matches input length", () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ id: `S${i}`, weight: 10 + i * 8 }));
    expect(computeTreemap(items, 800, 600)).toHaveLength(6);
  });

  test("total area of rects equals W × H", () => {
    const items = [
      { id: "A", weight: 40 }, { id: "B", weight: 30 },
      { id: "C", weight: 20 }, { id: "D", weight: 10 },
    ];
    const rects = computeTreemap(items, 800, 600);
    const totalArea = rects.reduce((s, r) => s + r.w * r.h, 0);
    expect(totalArea).toBeCloseTo(800 * 600, -2); // within ~1%
  });

  test("all rects stay within canvas bounds", () => {
    const items = [{ id: "A", weight: 50 }, { id: "B", weight: 30 }, { id: "C", weight: 20 }];
    computeTreemap(items, 800, 600).forEach(r => {
      expect(r.x).toBeGreaterThanOrEqual(-0.01);
      expect(r.y).toBeGreaterThanOrEqual(-0.01);
      expect(r.x + r.w).toBeLessThanOrEqual(800.01);
      expect(r.y + r.h).toBeLessThanOrEqual(600.01);
    });
  });

  test("small-weight item gets proportionally smaller area than large-weight item", () => {
    // weight:1 vs weight:99 — both should appear, small one has much less area
    const rects = computeTreemap([{ id: "A", weight: 99 }, { id: "B", weight: 1 }], 800, 600);
    const a = rects.find(r => r.id === "A");
    const b = rects.find(r => r.id === "B");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a.w * a.h).toBeGreaterThan(b.w * b.h);
  });

  test("extra properties are forwarded to output rects", () => {
    const [r] = computeTreemap([{ id: "AAPL", weight: 100, ticker: "AAPL", perf: 2.5 }], 400, 300);
    expect(r.ticker).toBe("AAPL");
    expect(r.perf).toBe(2.5);
  });

  test("larger weight gets larger area than smaller weight", () => {
    const rects = computeTreemap([{ id: "BIG", weight: 80 }, { id: "SML", weight: 20 }], 800, 600);
    const big = rects.find(r => r.id === "BIG");
    const sml = rects.find(r => r.id === "SML");
    expect(big.w * big.h).toBeGreaterThan(sml.w * sml.h);
  });
});

// ─── perfColor ────────────────────────────────────────────────────
describe("perfColor", () => {
  test("null / undefined / NaN → dark background sentinel", () => {
    expect(perfColor(null)).toBe("#1e293b");
    expect(perfColor(undefined)).toBe("#1e293b");
    expect(perfColor(NaN)).toBe("#1e293b");
  });

  test("values within ±0.2 → grey", () => {
    expect(perfColor(0)).toBe("#334155");
    expect(perfColor(0.19)).toBe("#334155");
    expect(perfColor(-0.19)).toBe("#334155");
  });

  test("positive value → green channel dominant", () => {
    const [r, g] = perfColor(5).match(/\d+/g).map(Number);
    expect(g).toBeGreaterThan(r);
  });

  test("negative value → red channel dominant", () => {
    const [r, g] = perfColor(-5).match(/\d+/g).map(Number);
    expect(r).toBeGreaterThan(g);
  });

  test("values beyond ±10 clamp (same output as ±10)", () => {
    expect(perfColor(10)).toBe(perfColor(20));
    expect(perfColor(-10)).toBe(perfColor(-20));
  });

  test("all rgb channels are in 0–255 range", () => {
    [-10, -5, -1, 0.5, 1, 5, 10].forEach(v => {
      const color = perfColor(v);
      if (color.startsWith("rgb")) {
        color.match(/\d+/g).map(Number).forEach(ch => {
          expect(ch).toBeGreaterThanOrEqual(0);
          expect(ch).toBeLessThanOrEqual(255);
        });
      }
    });
  });

  test("stronger positive → more green than weaker positive", () => {
    const g1 = perfColor(2).match(/\d+/g).map(Number)[1];
    const g10 = perfColor(10).match(/\d+/g).map(Number)[1];
    expect(g10).toBeGreaterThan(g1);
  });
});

// ─── IS_DEMO ─────────────────────────────────────────────────────
describe("IS_DEMO", () => {
  beforeEach(() => localStorage.clear());

  test("returns true when nothing stored", () => {
    expect(IS_DEMO("ph_portfolio")).toBe(true);
  });

  test("returns true for stored empty array", () => {
    localStorage.setItem("ph_portfolio", JSON.stringify([]));
    expect(IS_DEMO("ph_portfolio")).toBe(true);
  });

  test("returns true for stored null", () => {
    localStorage.setItem("ph_portfolio", "null");
    expect(IS_DEMO("ph_portfolio")).toBe(true);
  });

  test("returns false when portfolio has items", () => {
    localStorage.setItem("ph_portfolio", JSON.stringify([{ ticker: "AAPL", shares: 10 }]));
    expect(IS_DEMO("ph_portfolio")).toBe(false);
  });

  test("returns true for invalid JSON", () => {
    localStorage.setItem("ph_portfolio", "{bad json{{");
    expect(IS_DEMO("ph_portfolio")).toBe(true);
  });
});

// ─── applySnapshot ────────────────────────────────────────────────
describe("applySnapshot", () => {
  test("adds a new entry to empty history", () => {
    const result = applySnapshot([], "2026-04-15", 70000, 1.5);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ date: "2026-04-15", value: 70000, change: 1.5 });
  });

  test("overwrites an existing entry for the same date", () => {
    const prev = [{ date: "2026-04-15", value: 50000, change: 0.5 }];
    const result = applySnapshot(prev, "2026-04-15", 51000, 2.0);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(51000);
    expect(result[0].change).toBe(2.0);
  });

  test("keeps entries sorted by date", () => {
    const prev = [
      { date: "2026-04-10", value: 50000, change: 1.0 },
      { date: "2026-04-15", value: 52000, change: 2.0 },
    ];
    const result = applySnapshot(prev, "2026-04-12", 51000, -0.5);
    expect(result.map(h => h.date)).toEqual(["2026-04-10", "2026-04-12", "2026-04-15"]);
  });

  test("caps history at 365 entries, dropping the oldest", () => {
    const prev = Array.from({ length: 365 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(3, "0")}`.slice(0, 10), // rough dates
      value: 50000 + i,
      change: 0.1,
    })).map((e, i) => ({ ...e, date: new Date(2025, 0, i + 1).toISOString().split("T")[0] }));
    const result = applySnapshot(prev, "2026-04-15", 99999, 5.0);
    expect(result).toHaveLength(365);
    expect(result[result.length - 1].value).toBe(99999);
  });
});

// ─── THEMES / SWATCHES ───────────────────────────────────────────
describe("THEMES", () => {
  const REQUIRED_KEYS = ["bg", "panel", "border", "text", "muted", "green", "accent", "link"];

  test("all three themes are defined", () => {
    expect(THEMES).toHaveProperty("dark");
    expect(THEMES).toHaveProperty("warm");
    expect(THEMES).toHaveProperty("light");
  });

  test.each(["dark", "warm", "light"])("%s theme has all required style keys", (name) => {
    const theme = THEMES[name];
    REQUIRED_KEYS.forEach(key => {
      expect(theme, `${name}.${key} missing`).toHaveProperty(key);
      expect(typeof theme[key]).toBe("string");
    });
  });
});

describe("SWATCHES", () => {
  test("has an entry for each theme", () => {
    const keys = SWATCHES.map(s => s.key);
    expect(keys).toContain("dark");
    expect(keys).toContain("warm");
    expect(keys).toContain("light");
  });

  test("every swatch has key, dot, and label", () => {
    SWATCHES.forEach(sw => {
      expect(typeof sw.key).toBe("string");
      expect(typeof sw.dot).toBe("string");
      expect(typeof sw.label).toBe("string");
    });
  });
});

// ─── useTheme ─────────────────────────────────────────────────────
describe("useTheme", () => {
  test("defaults to 'dark' when nothing is stored", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe("dark");
  });

  test("reads persisted theme from localStorage on init", () => {
    localStorage.setItem("ph_theme", "light");
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe("light");
  });

  test("setTheme updates the returned theme value", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current[1]("warm"));
    expect(result.current[0]).toBe("warm");
  });

  test("setTheme persists the selection to localStorage", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current[1]("light"));
    expect(localStorage.getItem("ph_theme")).toBe("light");
  });
});

// ─── applyEvent ──────────────────────────────────────────────────
describe("applyEvent", () => {
  test("appends a new event", () => {
    const event = { date: "2026-04-15", time: "10:00:00", type: "add", ticker: "NVDA", shares: 5 };
    const result = applyEvent([], event);
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe("NVDA");
  });

  test("prunes events older than 1 year", () => {
    const oldDate = new Date();
    oldDate.setFullYear(oldDate.getFullYear() - 2);
    const oldEvent = { date: oldDate.toISOString().split("T")[0], type: "add", ticker: "OLD", shares: 1 };
    const newEvent = { date: "2026-04-15", type: "add", ticker: "NEW", shares: 1 };
    const result = applyEvent([oldEvent], newEvent);
    expect(result.find(e => e.ticker === "OLD")).toBeUndefined();
    expect(result.find(e => e.ticker === "NEW")).toBeDefined();
  });

  test("keeps events from within the past year", () => {
    const recentDate = new Date();
    recentDate.setMonth(recentDate.getMonth() - 6);
    const recentEvent = { date: recentDate.toISOString().split("T")[0], type: "add", ticker: "KEEP", shares: 10 };
    const newEvent = { date: "2026-04-15", type: "remove", ticker: "NEW", shares: 5 };
    const result = applyEvent([recentEvent], newEvent);
    expect(result).toHaveLength(2);
  });
});
