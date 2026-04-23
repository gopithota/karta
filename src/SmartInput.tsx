import { useState, useMemo } from "react";
import type { Theme, ParseResult, ParsedLine, ParseError, ApplyResult, TouchedEntry, Mutation } from "./types";

// ─── Parser ───────────────────────────────────────────────────────

const ADD_WORDS = ["add", "added", "bought", "buy", "plus", "+"];
const SUB_WORDS = ["sold", "sell", "drop", "dropped", "remove", "removed", "-", "minus"];

// Returns null for blank lines, { error, raw } for unparseable lines,
// or { op, ticker, count, raw } for valid commands.
export function parseLine(raw: string): ParseResult {
  const line = raw.trim();
  if (!line) return null;
  const normalized = line
    .replace(/^\+(?!\s)/, "+ ")
    .replace(/^-(?!\s)/, "- ");
  const tokens = normalized.split(/\s+/);
  let op: "set" | "add" | "sub" = "set", start = 0;
  const first = tokens[0].toLowerCase();
  if (ADD_WORDS.includes(first)) { op = "add"; start = 1; }
  else if (SUB_WORDS.includes(first)) { op = "sub"; start = 1; }
  if (tokens.length < start + 2)
    return { error: "needs ticker and count", raw: line };
  let tickerIdx = start, countIdx = start + 1;
  if (!isNaN(parseInt(tokens[start].replace(/,/g, ""), 10))) {
    tickerIdx = start + 1;
    countIdx  = start;
  }
  const ticker = tokens[tickerIdx].toUpperCase().replace(/[^A-Z]/g, "");
  const count  = parseInt(tokens[countIdx].replace(/,/g, ""), 10);
  if (!ticker || isNaN(count) || count < 0)
    return { error: "cannot parse", raw: line };
  return { op, ticker, count, raw: line };
}

// Applies a list of parsed commands to currentMap ({ TICKER: shares }).
export function applyAll(
  parsedList: ParseResult[],
  currentMap: Record<string, number>
): ApplyResult {
  const next: Record<string, number> = { ...currentMap };
  const touched: Record<string, TouchedEntry> = {};
  const errors: ParseError[] = [];
  for (const p of parsedList) {
    if (!p || "error" in p) { if (p) errors.push(p as ParseError); continue; }
    const pl = p as ParsedLine;
    const before = next[pl.ticker];
    if (pl.op === "set") {
      next[pl.ticker] = pl.count;
    } else if (pl.op === "add") {
      next[pl.ticker] = (before ?? 0) + pl.count;
    } else if (pl.op === "sub") {
      if (before === undefined) {
        errors.push({ ...pl, error: "not in portfolio" });
        continue;
      }
      next[pl.ticker] = Math.max(0, before - pl.count);
    }
    const after = next[pl.ticker];
    touched[pl.ticker] = { before, after, op: pl.op };
    if (after === 0) delete next[pl.ticker];
  }
  return { next, touched, errors };
}

// ─── SmartInput component ─────────────────────────────────────────

const EXAMPLE_TEXT = "AAPL 100\nadd NVDA 25\nsold META 3";

type RowState = "create" | "update" | "remove" | "noop";

function rowStyle(state: RowState, S: Theme) {
  switch (state) {
    case "create": return { bg: S.greenDim,                   marker: "＋", color: S.green,   strike: false };
    case "update": return { bg: `${S.link}18`,                marker: "↻",  color: S.link,    strike: false };
    case "remove": return { bg: "rgba(248,113,113,0.12)",     marker: "✕",  color: "#f87171", strike: true  };
    default:       return { bg: "transparent",                 marker: "",   color: S.muted,   strike: false };
  }
}

interface SmartInputProps {
  portfolio: Array<{ ticker: string; shares: number }>;
  onApply: (mutations: Mutation[]) => void;
  S: Theme;
  isMobile: boolean;
}

export default function SmartInput({ portfolio, onApply, S, isMobile }: SmartInputProps) {
  const [text, setText] = useState("");

  const currentMap = useMemo(
    () => Object.fromEntries(portfolio.map(({ ticker, shares }) => [ticker, shares])),
    [portfolio]
  );

  const { next: _next, touched, errors } = useMemo(() => {
    if (!text.trim()) return { next: { ...currentMap }, touched: {}, errors: [] };
    const lines = text.split("\n").map(parseLine).filter(Boolean);
    return applyAll(lines, currentMap);
  }, [text, currentMap]);

  const allTickers = useMemo(() => {
    const s = new Set([
      ...Object.keys(touched),
      ...errors.map(e => e.ticker).filter((t): t is string => Boolean(t)),
    ]);
    return [...s].sort();
  }, [touched, errors]);

  const getState = (ticker: string): RowState => {
    if (!(ticker in touched)) return "noop";
    const { before, after } = touched[ticker];
    if (before === undefined && after > 0) return "create";
    if (before !== undefined && after === 0) return "remove";
    if (before !== undefined && after > 0 && after !== before) return "update";
    return "noop";
  };

  const { creates, updates, removes } = useMemo(() => {
    let creates = 0, updates = 0, removes = 0;
    for (const { before, after } of Object.values(touched)) {
      if (before === undefined && after > 0) creates++;
      else if (before !== undefined && after === 0) removes++;
      else if (before !== undefined && after > 0 && after !== before) updates++;
    }
    return { creates, updates, removes };
  }, [touched]);
  const total = creates + updates + removes;

  const hasErrors = errors.length > 0;
  const hasText = Boolean(text.trim());
  let footerText: string, footerColor: string;
  if (!hasText) {
    footerText = "Ready"; footerColor = S.muted;
  } else if (hasErrors && total === 0) {
    footerText = `${errors.length} line${errors.length > 1 ? "s" : ""} couldn't be parsed`;
    footerColor = "#f87171";
  } else if (hasErrors) {
    footerText = `${total} command${total > 1 ? "s" : ""} ready · ${errors.length} skipped`;
    footerColor = "#facc15";
  } else if (total === 0) {
    footerText = "No changes to apply"; footerColor = S.muted;
  } else {
    footerText = `${total} command${total > 1 ? "s" : ""} ready to apply`;
    footerColor = S.text;
  }

  const summaryParts = [
    creates && `${creates} new`,
    updates && `${updates} updated`,
    removes && `${removes} removed`,
  ].filter(Boolean);

  const handleApply = () => {
    const mutations: Mutation[] = [];
    for (const [ticker, { before, after }] of Object.entries(touched)) {
      if (before === undefined && after > 0)
        mutations.push({ type: "create", ticker, shares: after });
      else if (before !== undefined && after === 0)
        mutations.push({ type: "remove", ticker, prevShares: before });
      else if (before !== undefined && after > 0 && after !== before)
        mutations.push({ type: "update", ticker, shares: after, prevShares: before });
    }
    if (!mutations.length) return;
    onApply(mutations);
    setText("");
  };

  return (
    <div style={{ borderRadius: 8, border: `1px solid ${S.border}`, overflow: "hidden" }}>
      <style>{`.karta-smart-ta::placeholder { font-style: italic; color: ${S.subtext}; }`}</style>

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row" }}>
        {/* Left — command input */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          borderRight: isMobile ? "none" : `1px solid ${S.border}`,
          borderBottom: isMobile ? `1px solid ${S.border}` : "none",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", borderBottom: `1px solid ${S.border}`, background: S.bg }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: S.muted, letterSpacing: "0.04em" }}>INPUT</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setText(EXAMPLE_TEXT)} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: `1px solid ${S.border}`, background: "transparent", color: S.muted, cursor: "pointer" }}>Example</button>
              <button onClick={() => setText("")} disabled={!text} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: `1px solid ${S.border}`, background: "transparent", color: text ? S.muted : S.subtext, cursor: text ? "pointer" : "default" }}>Clear</button>
            </div>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={"AAPL 100\nadd NVDA 25\nsold META 3"}
            className="karta-smart-ta"
            style={{ flex: 1, minHeight: 168, padding: "12px", background: S.inputBg, color: S.text, fontFamily: "'JetBrains Mono', 'Fira Mono', monospace", fontSize: 13, lineHeight: 1.7, border: "none", outline: "none", resize: "none", boxSizing: "border-box", width: "100%" }}
          />
        </div>

        {/* Right — live diff */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: S.panel }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", borderBottom: `1px solid ${S.border}`, background: S.bg }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: S.muted, letterSpacing: "0.04em" }}>PORTFOLIO AFTER APPLY</span>
            {summaryParts.length > 0 && <span style={{ fontSize: 11, color: S.muted }}>{summaryParts.join(" · ")}</span>}
          </div>
          <div style={{ overflowY: "auto", maxHeight: 200, padding: "6px 8px" }}>
            {allTickers.length === 0 && (
              <div style={{ padding: "32px 0", textAlign: "center", color: S.subtext, fontSize: 12, fontStyle: "italic" }}>
                Type commands on the left to preview
              </div>
            )}
            {allTickers.map(ticker => {
              const state = getState(ticker);
              const { bg, marker, color, strike } = rowStyle(state, S);
              const t = touched[ticker];
              const sharesDisplay =
                state === "create" ? String(t.after) :
                state === "remove" ? String(t.before) :
                state === "update" ? `${t.before} → ${t.after}` :
                String(currentMap[ticker]);
              return (
                <div key={ticker} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 8px", borderRadius: 5, marginBottom: 2, background: bg }}>
                  <span style={{ width: 14, fontSize: 12, color, flexShrink: 0, textAlign: "center" }}>{marker}</span>
                  <span style={{ fontWeight: 700, fontSize: 12, fontFamily: "monospace", color, flex: 1, textDecoration: strike ? "line-through" : "none" }}>{ticker}</span>
                  <span style={{ fontSize: 12, fontFamily: "monospace", color, textDecoration: strike ? "line-through" : "none" }}>{sharesDisplay}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${S.border}`, background: S.bg }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px" }}>
          <span style={{ fontSize: 12, color: footerColor }}>{footerText}</span>
          <button
            onClick={handleApply}
            disabled={total === 0}
            style={{ padding: "5px 16px", borderRadius: 6, border: "none", background: total > 0 ? S.accent : S.panel, color: total > 0 ? "#fff" : S.subtext, fontSize: 13, fontWeight: 700, cursor: total > 0 ? "pointer" : "not-allowed", transition: "background 0.15s" }}
          >Apply changes</button>
        </div>
        {errors.length > 0 && (
          <div style={{ padding: "0 12px 8px", display: "flex", flexWrap: "wrap", gap: 4 }}>
            {errors.map((e, i) => (
              <span key={i} style={{ fontSize: 11, color: "#f87171", background: "rgba(248,113,113,0.08)", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>
                ⚠ {e.raw} — {e.error}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
