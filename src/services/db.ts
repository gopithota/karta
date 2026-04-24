import Dexie, { type Table } from "dexie";
import type { StockData, CandleSeries } from "../types";

// ─── Schema ───────────────────────────────────────────────────────

export interface PriceCacheEntry {
  ticker: string;       // primary key
  data: StockData;
  fetchedAt: number;    // Date.now() timestamp
}

export interface CandleCacheEntry {
  ticker: string;       // primary key
  series: CandleSeries; // timestamps + closes arrays
  fetchedAt: number;    // Date.now() timestamp
}

// ─── Database ─────────────────────────────────────────────────────

class KartaDB extends Dexie {
  priceCache!: Table<PriceCacheEntry, string>;
  candleCache!: Table<CandleCacheEntry, string>;

  constructor() {
    super("karta-db");
    this.version(1).stores({
      priceCache: "ticker, fetchedAt",
    });
    this.version(2).stores({
      priceCache: "ticker, fetchedAt",
      candleCache: "ticker, fetchedAt",
    });
  }
}

export const db = new KartaDB();

// ─── Price cache helpers ──────────────────────────────────────────

/** Load all cached price entries and return as a Record keyed by ticker. */
export async function loadPriceCache(): Promise<Record<string, StockData>> {
  const all = await db.priceCache.toArray();
  const result: Record<string, StockData> = {};
  for (const entry of all) result[entry.ticker] = entry.data;
  return result;
}

/** Persist a batch of stock data entries. */
export async function savePriceCache(
  stockData: Record<string, StockData>
): Promise<void> {
  const now = Date.now();
  const entries: PriceCacheEntry[] = Object.entries(stockData).map(
    ([ticker, data]) => ({ ticker, data, fetchedAt: now })
  );
  await db.priceCache.bulkPut(entries);
}

/** One-time migration: move ph_stockdata from localStorage into Dexie, then clear. */
export async function migrateLocalStoragePriceCache(): Promise<void> {
  const raw = localStorage.getItem("ph_stockdata");
  if (!raw) return;
  try {
    const parsed: Record<string, StockData> = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
      await savePriceCache(parsed);
    }
  } catch {
    // ignore corrupt data
  }
  localStorage.removeItem("ph_stockdata");
}

// ─── Candle cache helpers ─────────────────────────────────────────

/** Save a single ticker's daily candle series. */
export async function saveCandleCache(
  ticker: string,
  timestamps: number[],
  closes: number[]
): Promise<void> {
  await db.candleCache.put({ ticker, series: { timestamps, closes }, fetchedAt: Date.now() });
}

/** Load all cached candle series as a Record keyed by ticker. */
export async function loadCandleCache(): Promise<Record<string, CandleSeries>> {
  const all = await db.candleCache.toArray();
  const result: Record<string, CandleSeries> = {};
  for (const entry of all) result[entry.ticker] = entry.series;
  return result;
}
