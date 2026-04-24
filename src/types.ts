// ─── Domain types ─────────────────────────────────────────────────

export interface PortfolioItem {
  ticker: string;
  shares: number;
  demoPerf?: number;
}

export interface StockData {
  price: number;
  prevClose: number;
  today: number | null;
  ytd: number | null;
  "3m": number | null;
  "6m": number | null;
  "1y": number | null;
  "5y": number | null;
}

export interface HistoryEntry {
  date: string;   // ISO date string, e.g. "2026-04-15"
  value: number;
  change: number | null;
}

export type EventType = "add" | "remove" | "update";

export interface PortfolioEvent {
  date: string;
  time?: string;
  type: EventType;
  ticker: string;
  shares: number;
  prevShares?: number;
  note?: string;
}

export interface Mutation {
  type: "create" | "update" | "remove";
  ticker: string;
  shares?: number;
  prevShares?: number;
}

// ─── Treemap types ────────────────────────────────────────────────

export interface TreemapItem {
  id: string;
  ticker?: string;
  weight: number;
  perf?: number | null;
  price?: number | null;
}

export interface TreemapRect extends TreemapItem {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ─── Theme types ──────────────────────────────────────────────────

export type ThemeKey = "dark" | "warm" | "light";

export interface Theme {
  bg: string;
  panel: string;
  border: string;
  rowBorder: string;
  overlay: string;
  tooltip: string;
  inputBg: string;
  text: string;
  muted: string;
  subtext: string;
  strong: string;
  emphasis: string;
  code: string;
  accent: string;
  link: string;
  green: string;
  greenDim: string;
  chartGrid: string;
  chartLabel: string;
  chartCross: string;
  tabActiveBg: string;
  tabActiveBorder: string;
  tabActiveText: string;
  badgeFreeBg: string;
  badgeFreeText: string;
  navBg: string;
  heroGrad: string;
  demoWin: string;
  demoBar: string;
  demoUrl: string;
  etymBg: string;
  featureCard: string;
  statsBg: string;
  privBoxBg: string;
  privBoxBorder: string;
  privBarBg: string;
  privItemBg: string;
  tickerBg: string;
  logoGlow: string;
  pageGlow: string;
  grain: boolean;
}

export interface Swatch {
  key: ThemeKey;
  dot: string;
  label: string;
}

// ─── SmartInput parser types ──────────────────────────────────────

export type OpType = "set" | "add" | "sub";

export interface ParsedLine {
  op: OpType;
  ticker: string;
  count: number;
  raw: string;
}

export interface ParseError {
  error: string;
  raw: string;
  ticker?: string;
}

export type ParseResult = ParsedLine | ParseError | null;

export interface TouchedEntry {
  before: number | undefined;
  after: number;
  op: OpType;
}

export interface ApplyResult {
  next: Record<string, number>;
  touched: Record<string, TouchedEntry>;
  errors: ParseError[];
}

// ─── Tab types ────────────────────────────────────────────────────

export type TabKey = "heatmap" | "correlation" | "table" | "history" | "setup";

// ─── Correlation types ────────────────────────────────────────────

export interface CandleSeries {
  timestamps: number[];  // Unix seconds, sorted ascending
  closes: number[];
}
