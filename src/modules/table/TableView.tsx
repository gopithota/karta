import { usePortfolioStore } from "../../store/usePortfolioStore";

export default function TableView() {
  const S          = usePortfolioStore(s => s.S);
  const stockData  = usePortfolioStore(s => s.stockData);
  const portfolio  = usePortfolioStore(s => s.portfolio);

  const getWeight = (ticker: string) => {
    const d = stockData[ticker];
    const h = portfolio.find(p => p.ticker === ticker);
    if (d && h) return d.price * h.shares;
    return h ? h.shares * 100 : 100;
  };
  const totalValue = portfolio.reduce((s, { ticker }) => s + getWeight(ticker), 0);

  if (Object.keys(stockData).length === 0) {
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "auto", padding: "20px" }}>
        <div style={{ textAlign: "center", color: S.muted, padding: 48, fontSize: 14 }}>
          Load data using the Refresh button above.
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "auto", padding: "20px" }}>
      <div style={{ maxWidth: 1020, margin: "0 auto", overflowX: "auto", WebkitOverflowScrolling: "touch", background: S.panel, borderRadius: 10, border: `1px solid ${S.border}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${S.border}`, position: "sticky", top: 0, background: S.panel }}>
              {["Ticker", "Price", "Shares", "Value", "Weight", "Today"].map((h, i) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: i === 0 ? "left" : "right", color: S.muted, fontWeight: 600, fontSize: 12, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...portfolio].sort((a, b) => getWeight(b.ticker) - getWeight(a.ticker)).map(({ ticker, shares }) => {
              const d = stockData[ticker];
              if (!d) return null;
              const val = d.price * shares;
              const w = totalValue > 0 ? (val / totalValue) * 100 : 0;
              return (
                <tr key={ticker} style={{ borderBottom: `1px solid ${S.rowBorder}` }}>
                  <td style={{ padding: "9px 14px", fontWeight: 800, fontSize: 14 }}>{ticker}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right" }}>${d.price.toFixed(2)}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", color: S.muted }}>{shares}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 600 }}>${val.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", color: S.muted }}>{w.toFixed(1)}%</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", color: d.today == null ? S.subtext : d.today >= 0 ? S.green : "#f87171", fontWeight: 600 }}>
                    {d.today == null ? "—" : `${d.today >= 0 ? "+" : ""}${d.today.toFixed(2)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
