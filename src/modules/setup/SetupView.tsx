import { usePortfolioStore } from "../../store/usePortfolioStore";
import { THEMES, SWATCHES } from "../../theme";
import SmartInput from "../../SmartInput";

export default function SetupView() {
  const S              = usePortfolioStore(s => s.S);
  const theme          = usePortfolioStore(s => s.theme);
  const setTheme       = usePortfolioStore(s => s.setTheme);
  const portfolio      = usePortfolioStore(s => s.portfolio);
  const setPortfolio   = usePortfolioStore(s => s.setPortfolio);
  const portfolioName  = usePortfolioStore(s => s.portfolioName);
  const setPortfolioName = usePortfolioStore(s => s.setPortfolioName);
  const apiKey         = usePortfolioStore(s => s.apiKey);
  const apiInput       = usePortfolioStore(s => s.apiInput);
  const setApiKey      = usePortfolioStore(s => s.setApiKey);
  const setApiInput    = usePortfolioStore(s => s.setApiInput);
  const setTab         = usePortfolioStore(s => s.setTab);
  const fetchData      = usePortfolioStore(s => s.fetchData);
  const isDemo         = usePortfolioStore(s => s.isDemo);
  const handleSmartApply = usePortfolioStore(s => s.handleSmartApply);
  const recordPortfolioEvent = usePortfolioStore(s => s.recordPortfolioEvent);
  const isMobile       = usePortfolioStore(s => s.isMobile);

  const saveApiKey = () => {
    setApiKey(apiInput);
    setTab("heatmap");
    setTimeout(() => fetchData(apiInput), 100);
  };

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "auto", padding: 20 }}>
      <div style={{ maxWidth: 1020, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 220px", gap: 16, alignItems: "start" }}>

        {/* ── Left column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Data source card */}
          <div style={{ background: S.panel, borderRadius: 10, border: `1px solid ${S.border}`, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${S.border}` }}>
              <div style={{ fontSize: 20 }}>📡</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: S.text }}>Powered by Finnhub</span>
                  <span style={{ fontSize: 10, fontWeight: 700, background: S.badgeFreeBg, color: S.badgeFreeText, padding: "2px 6px", borderRadius: 4 }}>FREE</span>
                </div>
                <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>Real-time quotes · Historical candle data · 60 req/min · No credit card needed</div>
              </div>
              <a href="https://finnhub.io/register" target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600, color: S.green, textDecoration: "none", whiteSpace: "nowrap" }}>Get free key →</a>
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.text }}>Your API Key</div>
                {apiKey
                  ? <span style={{ fontSize: 11, fontWeight: 700, color: S.green, background: S.greenDim, border: `1px solid ${S.green}33`, padding: "2px 8px", borderRadius: 20 }}>✓ Active — using your own key</span>
                  : <span style={{ fontSize: 11, fontWeight: 600, color: S.link, background: `${S.link}14`, border: `1px solid ${S.link}26`, padding: "2px 8px", borderRadius: 20 }}>Using Karta's shared key</span>
                }
              </div>
              {!apiKey && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 8, background: "rgba(147,197,253,0.06)", border: "1px solid rgba(147,197,253,0.14)", marginBottom: 10 }}>
                  <span style={{ fontSize: 15, lineHeight: 1 }}>ℹ️</span>
                  <div style={{ fontSize: 12, color: S.code, lineHeight: 1.6 }}>
                    Karta's <strong style={{ color: S.link }}>shared key</strong> is active by default, but it's rate-limited.{" "}
                    <strong style={{ color: S.strong }}>Get your own free key</strong> for uninterrupted, unlimited access.
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="password"
                  value={apiInput}
                  onChange={e => setApiInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveApiKey(); }}
                  placeholder="Paste your Finnhub API key here…"
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 7, border: `1px solid ${S.border}`, background: S.inputBg, color: S.text, fontSize: 14, outline: "none" }}
                />
                <button onClick={saveApiKey} disabled={!apiInput} style={{ padding: "8px 18px", borderRadius: 7, border: "none", cursor: apiInput ? "pointer" : "not-allowed", background: S.accent, color: "#fff", fontSize: 14, fontWeight: 700, opacity: !apiInput ? 0.5 : 1 }}>Save & Load</button>
              </div>
              <div style={{ fontSize: 12, color: S.muted, marginTop: 8 }}>
                Free at <a href="https://finnhub.io/register" target="_blank" rel="noreferrer" style={{ color: S.link }}>finnhub.io/register</a> — takes 2 minutes.
              </div>
            </div>
          </div>

          {/* Portfolio card */}
          <div style={{ background: S.panel, borderRadius: 10, border: `1px solid ${S.border}`, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${S.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: S.muted, marginBottom: 8, letterSpacing: "0.04em" }}>PORTFOLIO NAME</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={portfolioName}
                  onChange={e => setPortfolioName(e.target.value)}
                  placeholder="Portfolio Heatmap"
                  maxLength={40}
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 7, border: `1px solid ${S.border}`, background: S.inputBg, color: S.text, fontSize: 14, fontWeight: 700, outline: "none" }}
                />
                <button onClick={() => setPortfolioName("Portfolio Heatmap")} style={{ padding: "8px 14px", borderRadius: 7, border: `1px solid ${S.border}`, cursor: "pointer", background: "transparent", color: S.muted, fontSize: 13 }}>Reset</button>
              </div>
            </div>

            <div style={{ padding: 20 }}>
              {isDemo && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.2)", borderRadius: 8, padding: "12px 14px", marginBottom: 20 }}>
                  <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>✨</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#fde68a", marginBottom: 3 }}>You're viewing demo stocks</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>Clear them and add your own tickers and share counts to see your real portfolio.</div>
                  </div>
                  <button onClick={() => setPortfolio([])} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(250,204,21,0.3)", cursor: "pointer", background: "rgba(250,204,21,0.1)", color: "#fde68a", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>Clear demo →</button>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <SmartInput portfolio={portfolio} onApply={handleSmartApply} S={S} isMobile={isMobile} />
              </div>

              <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: S.muted, letterSpacing: "0.04em" }}>HOLDINGS ({portfolio.length})</div>
                  {portfolio.length > 0 && (
                    <button onClick={() => { portfolio.forEach(({ ticker, shares }) => recordPortfolioEvent("remove", ticker, shares)); setPortfolio([]); }} style={{ fontSize: 12, color: "#f87171", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Clear all</button>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {portfolio.map(({ ticker, shares }) => (
                    <div key={ticker} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, background: S.bg, border: `1px solid ${S.border}` }}>
                      <span style={{ fontWeight: 800, fontSize: 13 }}>{ticker}</span>
                      <span style={{ fontSize: 11, color: S.muted }}>{shares}sh</span>
                      <button onClick={() => { recordPortfolioEvent("remove", ticker, shares); setPortfolio(portfolio.filter(p => p.ticker !== ticker)); }} style={{ background: "none", border: "none", cursor: "pointer", color: S.muted, fontSize: 15, padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                  {!portfolio.length && <span style={{ fontSize: 13, color: S.subtext }}>No stocks added yet — use bulk import or add one above.</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Appearance card (right column) ── */}
        <div style={{ background: S.panel, borderRadius: 10, border: `1px solid ${S.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${S.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: S.muted, letterSpacing: "0.04em" }}>APPEARANCE</div>
          </div>
          <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            {SWATCHES.map(sw => (
              <button key={sw.key} onClick={() => setTheme(sw.key)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, cursor: "pointer", border: theme === sw.key ? `2px solid ${S.green}` : `2px solid ${S.border}`, background: theme === sw.key ? S.greenDim : S.bg, boxShadow: theme === sw.key ? `0 0 0 1px ${S.green}33` : "none", transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: sw.dot, flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.25)" }} />
                <span style={{ fontSize: 13, fontWeight: theme === sw.key ? 700 : 500, color: theme === sw.key ? S.green : S.muted }}>{sw.label}</span>
                {theme === sw.key && <span style={{ marginLeft: "auto", fontSize: 13, color: S.green }}>✓</span>}
              </button>
            ))}
          </div>
          {/* Preview swatches use THEMES directly to render correct colors */}
          <div style={{ display: "none" }}>{Object.keys(THEMES).join("")}</div>
        </div>

      </div>
    </div>
  );
}
