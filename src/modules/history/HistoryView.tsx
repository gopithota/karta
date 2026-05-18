import { useState } from "react";
import { usePortfolioStore } from "../../store/usePortfolioStore";
import HistoryChart from "./HistoryChart";

export default function HistoryView() {
  const S                = usePortfolioStore(s => s.S);
  const history          = usePortfolioStore(s => s.history);
  const portfolioEvents  = usePortfolioStore(s => s.portfolioEvents);
  const setHistory         = usePortfolioStore(s => s.setHistory);
  const setPortfolioEvents = usePortfolioStore(s => s.setPortfolioEvents);
  const seedDemoHistory    = usePortfolioStore(s => s.seedDemoHistory);
  const saveEventNote      = usePortfolioStore(s => s.saveEventNote);

  const [editingGroupDate, setEditingGroupDate] = useState<string | null>(null);
  const [groupNote, setGroupNote] = useState("");

  const saveGroupNote = (indices: number[], note: string) => {
    indices.forEach(idx => saveEventNote(idx, note));
    setEditingGroupDate(null);
  };

  const first = history[0];
  const last  = history[history.length - 1];

  const lastEventDate = portfolioEvents.length > 0
    ? portfolioEvents.reduce((max, ev) => ev.date > max ? ev.date : max, portfolioEvents[0].date)
    : null;
  const baseEntry = lastEventDate ? history.find(h => h.date > lastEventDate) : null;
  const changeSinceLastPortfolioChange = baseEntry && last && baseEntry.date !== last.date
    ? ((last.value - baseEntry.value) / baseEntry.value) * 100
    : null;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "auto", padding: 20 }}>
      <div style={{ maxWidth: 1020, margin: "0 auto" }}>

        {/* Summary stat cards */}
        {history.length >= 2 && first && last && (() => {
          const totalChange = ((last.value - first.value) / first.value) * 100;
          const cards = [
            { label: "Current Value", value: `$${last.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}` },
            { label: "Since First Record", value: `${totalChange >= 0 ? "+" : ""}${totalChange.toFixed(2)}%`, color: totalChange >= 0 ? S.green : "#f87171" },
            ...(changeSinceLastPortfolioChange !== null ? [{
              label: "Since Last Portfolio Change",
              value: `${changeSinceLastPortfolioChange >= 0 ? "+" : ""}${changeSinceLastPortfolioChange.toFixed(2)}%`,
              color: changeSinceLastPortfolioChange >= 0 ? S.green : "#f87171",
              sub: baseEntry ? new Date(baseEntry.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : undefined,
            }] : []),
            { label: "Tracking Since", value: new Date(first.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) },
            { label: "Days Recorded", value: `${history.length}` },
          ];
          return (
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              {cards.map(card => (
                <div key={card.label} style={{ background: S.panel, borderRadius: 8, border: `1px solid ${S.border}`, padding: "10px 16px", flex: "1 1 140px" }}>
                  <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{card.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: (card as { color?: string }).color || S.text }}>{card.value}</div>
                  {(card as { sub?: string }).sub && <div style={{ fontSize: 10, color: S.subtext, marginTop: 2 }}>from {(card as { sub?: string }).sub}</div>}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Chart card */}
        <div style={{ background: S.panel, borderRadius: 10, border: `1px solid ${S.border}`, padding: "16px 4px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 12px", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S.text }}>Portfolio Value — 1 Year</div>
              {history.length === 0 && (
                <button onClick={seedDemoHistory} style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 5, border: "1px solid rgba(250,204,21,0.3)", background: "rgba(250,204,21,0.08)", color: "#fde68a", cursor: "pointer" }}>Load demo data</button>
              )}
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 11, color: S.muted }}>
              {[["#4ade80", "Added"], ["#f87171", "Removed"], ["#facc15", "Mixed"]].map(([color, label]) => (
                <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block" }} />{label}
                </span>
              ))}
            </div>
          </div>
          <HistoryChart history={history} events={portfolioEvents} S={S} />
        </div>

        {/* Portfolio changes list — grouped by date */}
        {portfolioEvents.length > 0 && (() => {
          const groups: { date: string; evts: typeof portfolioEvents; indices: number[] }[] = [];
          [...portfolioEvents].reverse().forEach((ev, revI) => {
            const origIdx = portfolioEvents.length - 1 - revI;
            const last = groups[groups.length - 1];
            if (last && last.date === ev.date) {
              last.evts.push(ev);
              last.indices.push(origIdx);
            } else {
              groups.push({ date: ev.date, evts: [ev], indices: [origIdx] });
            }
          });

          return (
            <div style={{ background: S.panel, borderRadius: 10, border: `1px solid ${S.border}`, marginTop: 16, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${S.border}`, fontSize: 13, fontWeight: 700, color: S.text }}>
                Portfolio Changes ({groups.length} {groups.length === 1 ? "session" : "sessions"})
              </div>
              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                {groups.map(({ date, evts, indices }) => {
                  const isEditing = editingGroupDate === date;
                  const blockNote = evts[0].note ?? null;
                  return (
                    <div key={date} style={{ padding: "10px 16px", borderBottom: `1px solid ${S.rowBorder}` }}>
                      <div style={{ fontSize: 11, color: S.muted, fontWeight: 600, marginBottom: 6 }}>
                        {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "2-digit" })}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
                        {evts.map((ev, i) => (
                          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: ev.type === "add" ? `${S.green}18` : ev.type === "remove" ? "#f8717118" : `${S.link}18`, fontSize: 12 }}>
                            <span style={{ fontWeight: 800, color: ev.type === "add" ? S.green : ev.type === "remove" ? "#f87171" : S.link }}>
                              {ev.type === "add" ? "+" : ev.type === "remove" ? "−" : "~"}
                            </span>
                            <span style={{ fontWeight: 700, color: S.text }}>{ev.ticker}</span>
                            <span style={{ color: S.muted, fontSize: 11 }}>
                              {ev.type === "update" ? `${ev.prevShares}→${ev.shares}sh` : `${ev.shares}sh`}
                            </span>
                          </span>
                        ))}
                      </div>
                      {isEditing ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <input
                            autoFocus
                            value={groupNote}
                            onChange={e => setGroupNote(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") saveGroupNote(indices, groupNote);
                              if (e.key === "Escape") setEditingGroupDate(null);
                            }}
                            placeholder="Add a note…"
                            maxLength={160}
                            style={{ flex: 1, padding: "3px 8px", borderRadius: 5, border: `1px solid ${S.green}55`, background: S.inputBg, color: S.text, fontSize: 12, outline: "none", fontStyle: "italic" }}
                          />
                          <button onClick={() => saveGroupNote(indices, groupNote)} title="Save (Enter)" style={{ background: "none", border: "none", cursor: "pointer", color: S.green, fontSize: 15, padding: "0 2px", lineHeight: 1 }}>✓</button>
                          <button onClick={() => setEditingGroupDate(null)} title="Cancel (Esc)" style={{ background: "none", border: "none", cursor: "pointer", color: S.muted, fontSize: 13, padding: "0 2px", lineHeight: 1 }}>✕</button>
                        </div>
                      ) : (
                        <div
                          onClick={() => { setEditingGroupDate(date); setGroupNote(blockNote || ""); }}
                          style={{ fontSize: 11, color: blockNote ? S.muted : S.subtext, fontStyle: "italic", cursor: "text", opacity: blockNote ? 1 : 0.45 }}
                        >
                          {blockNote || "add note…"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Clear history */}
        {(history.length > 0 || portfolioEvents.length > 0) && (
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => {
                setHistory([]);
                setPortfolioEvents([]);
                localStorage.removeItem("ph_history");
                localStorage.removeItem("ph_events");
              }}
              style={{ fontSize: 12, color: S.muted, background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Clear all history data
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
