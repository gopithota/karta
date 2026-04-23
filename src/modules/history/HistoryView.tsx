import { usePortfolioStore } from "../../store/usePortfolioStore";
import HistoryChart from "./HistoryChart";

export default function HistoryView() {
  const S                = usePortfolioStore(s => s.S);
  const history          = usePortfolioStore(s => s.history);
  const portfolioEvents  = usePortfolioStore(s => s.portfolioEvents);
  const setHistory       = usePortfolioStore(s => s.setHistory);
  const setPortfolioEvents = usePortfolioStore(s => s.setPortfolioEvents);
  const seedDemoHistory  = usePortfolioStore(s => s.seedDemoHistory);
  const editingEventIdx  = usePortfolioStore(s => s.editingEventIdx);
  const editingNote      = usePortfolioStore(s => s.editingNote);
  const hoveredEventIdx  = usePortfolioStore(s => s.hoveredEventIdx);
  const setEditingEventIdx = usePortfolioStore(s => s.setEditingEventIdx);
  const setEditingNote   = usePortfolioStore(s => s.setEditingNote);
  const setHoveredEventIdx = usePortfolioStore(s => s.setHoveredEventIdx);
  const saveEventNote    = usePortfolioStore(s => s.saveEventNote);

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

        {/* Portfolio changes list */}
        {portfolioEvents.length > 0 && (
          <div style={{ background: S.panel, borderRadius: 10, border: `1px solid ${S.border}`, marginTop: 16, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${S.border}`, fontSize: 13, fontWeight: 700, color: S.text }}>
              Portfolio Changes ({portfolioEvents.length})
            </div>
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {[...portfolioEvents].reverse().map((ev, i) => {
                const origIdx = portfolioEvents.length - 1 - i;
                const isEditing = editingEventIdx === origIdx;
                const isHovered = hoveredEventIdx === origIdx;
                return (
                  <div
                    key={i}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderBottom: `1px solid ${S.rowBorder}`, background: isEditing ? S.bg : "transparent", transition: "background 0.12s" }}
                    onMouseEnter={() => setHoveredEventIdx(origIdx)}
                    onMouseLeave={() => setHoveredEventIdx(null)}
                  >
                    <span style={{ fontSize: 15, fontWeight: 800, color: ev.type === "add" ? S.green : ev.type === "remove" ? "#f87171" : S.link, minWidth: 14 }}>
                      {ev.type === "add" ? "+" : ev.type === "remove" ? "−" : "~"}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 13, minWidth: 56 }}>{ev.ticker}</span>
                    <span style={{ fontSize: 12, color: S.muted, whiteSpace: "nowrap" }}>
                      {ev.type === "add"    ? `Added ${ev.shares} shares`
                        : ev.type === "remove" ? `Removed ${ev.shares} shares`
                        : `Updated: ${ev.prevShares} → ${ev.shares} shares`}
                    </span>

                    {isEditing ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
                        <input
                          autoFocus
                          value={editingNote}
                          onChange={e => setEditingNote(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") saveEventNote(origIdx, editingNote);
                            if (e.key === "Escape") setEditingEventIdx(null);
                          }}
                          placeholder="Add a note…"
                          maxLength={160}
                          style={{ flex: 1, minWidth: 0, padding: "3px 8px", borderRadius: 5, border: `1px solid ${S.green}55`, background: S.inputBg, color: S.text, fontSize: 12, outline: "none", fontStyle: "italic" }}
                        />
                        <button onClick={() => saveEventNote(origIdx, editingNote)} title="Save (Enter)" style={{ background: "none", border: "none", cursor: "pointer", color: S.green, fontSize: 15, padding: "0 2px", lineHeight: 1, flexShrink: 0 }}>✓</button>
                        <button onClick={() => setEditingEventIdx(null)} title="Cancel (Esc)" style={{ background: "none", border: "none", cursor: "pointer", color: S.muted, fontSize: 13, padding: "0 2px", lineHeight: 1, flexShrink: 0 }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
                        <span onClick={() => { setEditingEventIdx(origIdx); setEditingNote(ev.note || ""); }} title={ev.note || "Click to add note"} style={{ fontSize: 11, color: ev.note ? S.muted : S.subtext, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: isHovered ? "text" : "default", opacity: ev.note ? 1 : isHovered ? 0.6 : 0, transition: "opacity 0.15s" }}>
                          {ev.note || "add note…"}
                        </span>
                        {isHovered && (
                          <button onClick={() => { setEditingEventIdx(origIdx); setEditingNote(ev.note || ""); }} title="Edit note" style={{ background: "none", border: "none", cursor: "pointer", color: S.emphasis, fontSize: 13, padding: "0 2px", lineHeight: 1, flexShrink: 0, opacity: 0.75, transform: "scaleX(-1)", display: "inline-block" }}>✎</button>
                        )}
                      </div>
                    )}

                    <span style={{ fontSize: 11, color: S.muted, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {new Date(ev.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
