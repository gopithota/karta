import { useEffect } from "react";
import { usePortfolioStore } from "./store/usePortfolioStore";
import { migrateLocalStoragePriceCache, loadPriceCache, loadCandleCache } from "./services/db";
import Header from "./components/Header";
import HeatmapView from "./modules/heatmap/HeatmapView";
import CorrelationView from "./modules/correlation/CorrelationView";
import TableView from "./modules/table/TableView";
import HistoryView from "./modules/history/HistoryView";
import SetupView from "./modules/setup/SetupView";

export default function App() {
  const S                  = usePortfolioStore(s => s.S);
  const tab                = usePortfolioStore(s => s.tab);
  const showPrivacyNotice  = usePortfolioStore(s => s.showPrivacyNotice);
  const setShowPrivacyNotice = usePortfolioStore(s => s.setShowPrivacyNotice);
  const setIsMobile        = usePortfolioStore(s => s.setIsMobile);
  const rateLimitSecs      = usePortfolioStore(s => s.rateLimitSecs);
  const setRateLimitSecs   = usePortfolioStore(s => s.setRateLimitSecs);
  const tryAutoFetch       = usePortfolioStore(s => s.tryAutoFetch);
  const hydrateStockData   = usePortfolioStore(s => s.hydrateStockData);
  const hydrateCandleData  = usePortfolioStore(s => s.hydrateCandleData);

  // Sync body background with theme
  useEffect(() => { document.body.style.background = S.bg; }, [S.bg]);

  // Track viewport width
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [setIsMobile]);

  // Rate-limit countdown (1 s tick)
  useEffect(() => {
    if (rateLimitSecs <= 0) return;
    const t = setTimeout(() => setRateLimitSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [rateLimitSecs, setRateLimitSecs]);

  // Dexie migration + hydration, then auto-fetch
  useEffect(() => {
    (async () => {
      try {
        await migrateLocalStoragePriceCache();
        const [cached, candles] = await Promise.all([loadPriceCache(), loadCandleCache()]);
        if (Object.keys(cached).length > 0) hydrateStockData(cached);
        if (Object.keys(candles).length > 0) hydrateCandleData(candles);
      } catch {
        // IndexedDB unavailable (e.g., Safari private, test env) — prices stay in memory
      }
      tryAutoFetch();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: S.bg, color: S.text, height: "100vh", display: "flex", flexDirection: "column", userSelect: "none" }}>

      {/* First-run privacy notice */}
      {showPrivacyNotice && (
        <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 200, width: "min(580px, calc(100vw - 40px))", background: S.tooltip, border: "1px solid rgba(74,222,128,0.25)", borderRadius: 14, padding: "18px 20px", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ fontSize: 22, flexShrink: 0 }}>🔒</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: S.strong, marginBottom: 4 }}>
              Your portfolio never leaves your device
            </div>
            <div style={{ fontSize: 13, color: S.muted, lineHeight: 1.6 }}>
              Your tickers, share counts, and API key are stored only in <strong style={{ color: S.code }}>your browser's localStorage</strong>.
              Stock prices are fetched directly from Finnhub — nothing passes through our servers.
              We never see your holdings.
            </div>
          </div>
          <button
            onClick={() => { setShowPrivacyNotice(false); localStorage.setItem("ph_privacy_seen", "1"); }}
            style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer", background: S.greenDim, color: S.green, fontSize: 12, fontWeight: 700 }}
          >Got it</button>
        </div>
      )}

      <Header />

      {/* Content — tabs rendered conditionally */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, display: tab === "heatmap" ? "block" : "none" }}>
          <HeatmapView />
        </div>
        <div style={{ position: "absolute", inset: 0, display: tab === "correlation" ? "flex" : "none", flexDirection: "column" }}>
          <CorrelationView />
        </div>
        <div style={{ position: "absolute", inset: 0, display: tab === "table" ? "block" : "none" }}>
          <TableView />
        </div>
        <div style={{ position: "absolute", inset: 0, display: tab === "history" ? "block" : "none" }}>
          <HistoryView />
        </div>
        <div style={{ position: "absolute", inset: 0, display: tab === "setup" ? "block" : "none" }}>
          <SetupView />
        </div>
      </div>

    </div>
  );
}
