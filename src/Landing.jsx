import { useEffect, useMemo, useRef, useState } from "react";

// ── Karta logo — geometric heatmap grid mark ──────────────────────
function KartaLogo({ size = 36 }) {
  const cells = [
    ["#1a4731","#1e5c3e","#2d7a52"],
    ["#1e5c3e","#2d7a52","#3a9966"],
    ["#2d7a52","#3a9966","#4ade80"],
    ["#1a3a28","#2d7a52","#22c55e"],
  ];
  const cell = size / 4.2;
  const gap  = cell * 0.18;
  const r    = cell * 0.28;
  const totalW = 3 * cell + 2 * gap;
  const totalH = 4 * cell + 3 * gap;
  const ox = (size - totalW) / 2;
  const oy = (size - totalH) / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <rect width={size} height={size} rx={size * 0.22} fill="#0a1a12" />
      {cells.map((row, ri) =>
        row.map((fill, ci) => (
          <rect key={`${ri}-${ci}`}
            x={ox + ci * (cell + gap)} y={oy + ri * (cell + gap)}
            width={cell} height={cell} rx={r} fill={fill}
          />
        ))
      )}
    </svg>
  );
}

// ── Animated demo heatmap ─────────────────────────────────────────
const DEMO_TILES = [
  { t: "NVDA", p:  4.82, w: 18 }, { t: "AAPL", p: -0.43, w: 14 },
  { t: "MSFT", p:  1.21, w: 13 }, { t: "GOOGL",p:  2.67, w: 10 },
  { t: "META", p:  3.11, w:  9 }, { t: "AMZN", p: -1.88, w: 10 },
  { t: "TSLA", p: -5.30, w:  8 }, { t: "JPM",  p:  0.94, w:  7 },
  { t: "V",    p:  0.42, w:  6 }, { t: "BRK.B",p:  0.18, w:  5 },
];

function perfColor(pct) {
  const t = Math.max(-1, Math.min(1, pct / 8));
  if (t < 0) { const i = -t; return `rgb(${Math.round(30+190*i)},${Math.round(40-10*i)},${Math.round(40-10*i)})`; }
  if (t > 0) return `rgb(${Math.round(25-5*t)},${Math.round(100+110*t)},${Math.round(25-5*t)})`;
  return "#334155";
}

function DemoHeatmap() {
  const [tiles, setTiles] = useState(DEMO_TILES);
  useEffect(() => {
    const id = setInterval(() => {
      setTiles(prev => prev.map(tile => ({
        ...tile,
        p: Math.max(-9, Math.min(9, tile.p + (Math.random() - 0.49) * 0.5)),
      })));
    }, 1400);
    return () => clearInterval(id);
  }, []);
  const total = tiles.reduce((s, t) => s + t.w, 0);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", width: "100%", height: "100%", gap: 3, padding: 3, boxSizing: "border-box" }}>
      {tiles.map(tile => (
        <div key={tile.t} style={{
          flex: `${tile.w} ${tile.w} 0`, minWidth: 58,
          background: perfColor(tile.p), borderRadius: 5,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          transition: "background 1s ease", padding: "8px 4px",
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.02em" }}>{tile.t}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)", fontFamily: "'JetBrains Mono', monospace" }}>
            {tile.p >= 0 ? "+" : ""}{tile.p.toFixed(2)}%
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Live visitor counter ──────────────────────────────────────────
function UserCounter() {
  const [count, setCount]     = useState(null);
  const [animated, setAnimated] = useState(0);
  const posted = useRef(false);

  useEffect(() => {
    if (posted.current) return;
    posted.current = true;
    fetch("/api/counter", { method: "POST" })
      .then(r => r.json())
      .then(d => setCount(d.count))
      .catch(() => setCount(312));
  }, []);

  useEffect(() => {
    if (count === null) return;
    const start = Math.max(0, count - 40);
    let cur = start;
    const step = Math.max(1, Math.ceil((count - start) / 28));
    const id = setInterval(() => {
      cur = Math.min(count, cur + step);
      setAnimated(cur);
      if (cur >= count) clearInterval(id);
    }, 38);
    return () => clearInterval(id);
  }, [count]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{
        fontFamily: "'DM Serif Display', Georgia, serif",
        fontSize: "clamp(40px, 6vw, 62px)", fontWeight: 400,
        letterSpacing: "-0.03em", lineHeight: 1,
        background: "linear-gradient(135deg, #4ade80, #22c55e)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        minWidth: 100, textAlign: "center",
      }}>
        {count === null ? "—" : animated.toLocaleString()}
      </div>
      <div style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em" }}>
        INVESTORS USING KARTA
      </div>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "clamp(36px, 5vw, 56px)", fontWeight: 400, letterSpacing: "-0.03em", color: "#f1f5f9", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em" }}>{label}</div>
    </div>
  );
}

function Feature({ icon, title, desc }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "26px 22px", display: "flex", flexDirection: "column", gap: 10, transition: "border-color 0.2s, transform 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(74,222,128,0.25)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.transform = ""; }}
    >
      <div style={{ fontSize: 24 }}>{icon}</div>
      <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 17, color: "#f1f5f9", lineHeight: 1.3 }}>{title}</div>
      <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65 }}>{desc}</div>
    </div>
  );
}

function Step({ n, title, desc }) {
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: "#4ade80" }}>{n}</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65 }}>{desc}</div>
      </div>
    </div>
  );
}

// ── Ticker tape data ─────────────────────────────────────────────
const TICKER_ITEMS = [
  { sym: "AAPL", chg: +1.24 }, { sym: "NVDA", chg: +8.40 },
  { sym: "TSLA", chg: -5.20 }, { sym: "MSFT", chg: +0.87 },
  { sym: "META", chg: +3.11 }, { sym: "AMZN", chg: -1.88 },
  { sym: "GOOGL", chg: +2.67 }, { sym: "JPM",  chg: +0.94 },
  { sym: "BRK.B", chg: +0.18 }, { sym: "V",    chg: +0.42 },
  { sym: "NFLX", chg: -2.14 }, { sym: "AMD",  chg: +5.33 },
  { sym: "DIS",  chg: -0.76 }, { sym: "COIN", chg: +4.12 },
  { sym: "GS",   chg: +1.03 }, { sym: "SPY",  chg: +0.61 },
];

function TickerTape() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="ticker-wrap">
      <div className="ticker-track">
        {items.map((item, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
            <span style={{ color: "#94a3b8", fontWeight: 700 }}>{item.sym}</span>
            <span style={{ color: item.chg >= 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>
              {item.chg >= 0 ? "+" : ""}{item.chg.toFixed(2)}%
            </span>
            <span style={{ color: "#1e2d3d" }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Scroll-reveal hook ────────────────────────────────────────────
function useScrollReveal(count) {
  const refs = useRef([]);
  const [revealed, setRevealed] = useState(() => Array(count).fill(false));
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const i = refs.current.indexOf(entry.target);
          if (i !== -1) {
            setRevealed(prev => { const n = [...prev]; n[i] = true; return n; });
            obs.unobserve(entry.target);
          }
        }
      });
    }, { threshold: 0.1 });
    refs.current.forEach(el => { if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);
  return [refs, revealed];
}

// ── Main ──────────────────────────────────────────────────────────
export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const [revealRefs, revealed] = useScrollReveal(5);

  const floatingTiles = useMemo(() => [
    { left: "8%",  size: 28, dur: 14, delay: 0,   color: "rgba(74,222,128,0.12)" },
    { left: "21%", size: 18, dur: 18, delay: 3.5, color: "rgba(248,113,113,0.10)" },
    { left: "37%", size: 34, dur: 12, delay: 1.2, color: "rgba(74,222,128,0.08)" },
    { left: "52%", size: 22, dur: 16, delay: 5.0, color: "rgba(74,222,128,0.14)" },
    { left: "66%", size: 14, dur: 20, delay: 2.8, color: "rgba(248,113,113,0.09)" },
    { left: "78%", size: 30, dur: 13, delay: 0.7, color: "rgba(74,222,128,0.10)" },
    { left: "88%", size: 20, dur: 17, delay: 4.2, color: "rgba(248,113,113,0.11)" },
    { left: "14%", size: 16, dur: 22, delay: 6.5, color: "rgba(74,222,128,0.07)" },
    { left: "59%", size: 26, dur: 15, delay: 3.1, color: "rgba(248,113,113,0.08)" },
  ], []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const S = { bg: "#080b12", border: "rgba(255,255,255,0.07)", green: "#4ade80", muted: "#64748b", text: "#e2e8f0" };

  return (
    <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Grain */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.4,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`,
        backgroundSize: "128px" }} />

      {/* Glow */}
      <div style={{ position: "fixed", top: "-25%", left: "50%", transform: "translateX(-50%)", width: "80vw", height: "65vh", background: "radial-gradient(ellipse, rgba(34,197,94,0.055) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      {/* ── Nav ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: isMobile ? "0 16px" : "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56,
        background: scrolled ? "rgba(8,11,18,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? `1px solid ${S.border}` : "none",
        transition: "all 0.3s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <KartaLogo size={28} />
          <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, letterSpacing: "-0.01em" }}>Karta</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {!isMobile && <>
            <a href="https://github.com/gopithota/karta" target="_blank" rel="noreferrer"
              style={{ padding: "5px 14px", borderRadius: 8, border: `1px solid ${S.border}`, color: S.muted, fontSize: 12, textDecoration: "none", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.color = S.text; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = S.muted; e.currentTarget.style.borderColor = S.border; }}
            >GitHub</a>
            <a href="https://buymeacoffee.com" target="_blank" rel="noreferrer"
              style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid rgba(255,214,0,0.18)", color: "#fde68a", fontSize: 12, textDecoration: "none", transition: "all 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,214,0,0.08)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >☕ Coffee</a>
          </>}
          <a href="/app"
            style={{ padding: "6px 18px", borderRadius: 8, background: S.green, color: "#051a0a", fontSize: 13, fontWeight: 800, textDecoration: "none", transition: "opacity 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.82"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >Launch →</a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 920, margin: "0 auto", padding: isMobile ? "88px 16px 48px" : "124px 24px 68px", textAlign: "center", overflow: "hidden" }}>

        {/* Floating background tiles */}
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
          {floatingTiles.slice(0, isMobile ? 5 : 9).map((t, i) => (
            <div key={i} className="float-tile" style={{
              position: "absolute", bottom: "-60px", left: t.left,
              width: t.size, height: t.size, borderRadius: 4,
              background: t.color,
              animationDuration: `${t.dur}s`,
              animationDelay: `${t.delay}s`,
            }} />
          ))}
        </div>

        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <div style={{ position: "relative" }}>
            <KartaLogo size={80} />
            <div style={{ position: "absolute", inset: -10, borderRadius: 28, background: "radial-gradient(ellipse, rgba(74,222,128,0.14) 0%, transparent 70%)", pointerEvents: "none" }} />
          </div>
        </div>

        {/* Name */}
        <h1 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: "clamp(56px, 9vw, 96px)", fontWeight: 400, lineHeight: 0.92,
          letterSpacing: "-0.03em", margin: "0 0 18px",
          background: "linear-gradient(160deg, #f8fafc 20%, #94a3b8 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>Karta</h1>

        {/* Etymology */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "7px 18px", borderRadius: 99, marginBottom: 32,
          background: "rgba(255,255,255,0.035)", border: `1px solid ${S.border}`,
          fontSize: 13, color: S.muted,
        }}>
          <span style={{ color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontStyle: "italic" }}>kar·ta</span>
          <span style={{ color: "#334155" }}>·</span>
          <span>Swedish & Latin for <strong style={{ color: "#cbd5e1" }}>"map"</strong> — your portfolio, charted.</span>
        </div>

        <p style={{ fontSize: 18, color: S.muted, lineHeight: 1.75, maxWidth: 500, margin: "0 auto 44px" }}>
          A Finviz-style heatmap for your personal portfolio.
          Color-coded performance, sized by your holdings.{" "}
          <strong style={{ color: "#e2e8f0" }}>Free forever.</strong>
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/app" style={{
            padding: "15px 36px", borderRadius: 10,
            background: "linear-gradient(135deg, #4ade80, #16a34a)",
            color: "#051a0a", fontSize: 15, fontWeight: 800, textDecoration: "none",
            boxShadow: "0 0 48px rgba(74,222,128,0.2), 0 2px 0 rgba(255,255,255,0.1) inset",
            transition: "transform 0.2s, box-shadow 0.2s", letterSpacing: "-0.01em",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 56px rgba(74,222,128,0.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 0 48px rgba(74,222,128,0.2)"; }}
          >Open your map →</a>
          <a href="https://buymeacoffee.com" target="_blank" rel="noreferrer" style={{
            padding: "15px 28px", borderRadius: 10,
            border: "1px solid rgba(255,214,0,0.18)", background: "rgba(255,214,0,0.04)",
            color: "#fde68a", fontSize: 15, fontWeight: 600, textDecoration: "none", transition: "all 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,214,0,0.1)"; e.currentTarget.style.borderColor = "rgba(255,214,0,0.35)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,214,0,0.04)"; e.currentTarget.style.borderColor = "rgba(255,214,0,0.18)"; }}
          >☕ Buy me a coffee</a>
        </div>

        {/* Ticker tape */}
        <div style={{ position: "relative", zIndex: 1, marginTop: 36 }}>
          <TickerTape />
        </div>

        {/* Demo window */}
        <div style={{ marginTop: 28, background: "#0c0f18", border: `1px solid ${S.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 48px 120px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)" }}>
          <div style={{ padding: "11px 16px", borderBottom: `1px solid ${S.border}`, display: "flex", alignItems: "center", gap: 10, background: "#09111e" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {["#f87171","#fbbf24","#4ade80"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.6 }} />)}
            </div>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 5, height: 20, display: "flex", alignItems: "center", paddingLeft: 10, gap: 6 }}>
              <KartaLogo size={12} />
              <span style={{ fontSize: 10, color: S.muted, fontFamily: "'JetBrains Mono', monospace" }}>karta.app</span>
            </div>
          </div>
          <div style={{ padding: "9px 16px", borderBottom: `1px solid ${S.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <KartaLogo size={18} />
              <span style={{ fontWeight: 800, fontSize: 13, fontFamily: "'DM Serif Display', Georgia, serif" }}>My Portfolio</span>
              <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 700 }}>▲ 1.24%</span>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {["heatmap","table","setup"].map(t => (
                <div key={t} style={{ padding: "3px 9px", borderRadius: 5, fontSize: 10, color: t === "heatmap" ? "#93c5fd" : S.muted, background: t === "heatmap" ? "#1a3160" : "transparent", border: `1px solid ${t === "heatmap" ? "#3b82f6" : S.border}`, textTransform: "capitalize" }}>{t}</div>
              ))}
            </div>
          </div>
          <div style={{ height: isMobile ? 160 : 210 }}><DemoHeatmap /></div>
        </div>
        <p style={{ fontSize: 11, color: "#1e2d3d", marginTop: 10, fontFamily: "'JetBrains Mono', monospace" }}>↑ live demo — prices drift in real time</p>
      </section>

      {/* ── Stats ── */}
      <section ref={el => revealRefs.current[0] = el} style={{ position: "relative", zIndex: 1, maxWidth: 820, margin: "0 auto", padding: isMobile ? "0 16px 48px" : "0 24px 64px", opacity: revealed[0] ? 1 : 0, transform: revealed[0] ? "none" : "translateY(24px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}>
        <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${S.border}`, borderRadius: 16, padding: isMobile ? "28px 20px" : "40px 48px", display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 32 }}>
          <UserCounter />
          <Stat value="Free" label="FOREVER · NO ADS" />
          <Stat value="0 kb" label="DATA SENT TO SERVERS" />
        </div>
      </section>

      {/* ── Features ── */}
      <section ref={el => revealRefs.current[1] = el} style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto", padding: isMobile ? "0 16px 48px" : "0 24px 64px", opacity: revealed[1] ? 1 : 0, transform: revealed[1] ? "none" : "translateY(24px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 400, letterSpacing: "-0.02em", margin: "0 0 12px" }}>
            Everything you need.<br /><em>Nothing you don't.</em>
          </h2>
          <p style={{ color: S.muted, fontSize: 15 }}>Built for investors who want signal, not noise.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {[
            { icon: "🟩", title: "Visual performance at a glance", desc: "Deep red to deep green color scale. Spot your winners and losers instantly — no spreadsheet scanning." },
            { icon: "⚖️", title: "Weighted by your holdings", desc: "Tile size reflects actual position value. Your biggest bets take the most space, just like Finviz." },
            { icon: "🔢", title: "Weighted portfolio return", desc: "The header shows your aggregate return for the day, weighted by your actual position sizes — not a simple average." },
            { icon: "🔒", title: "Privacy by default", desc: "API key and portfolio live in your browser. Nothing is ever sent to our servers." },
            { icon: "⚡", title: "Progressive loading", desc: "Your map fills tile-by-tile as data arrives — no blank screen while waiting for every stock." },
            { icon: "📋", title: "Paste from your spreadsheet", desc: "Bulk import from Excel or Google Sheets. Two columns, one paste, your whole portfolio in seconds." },
          ].map((f, i) => (
            <div key={f.title} className={revealed[1] ? "card-reveal visible" : "card-reveal"} style={{ transitionDelay: `${i * 80}ms` }}>
              <Feature icon={f.icon} title={f.title} desc={f.desc} />
            </div>
          ))}
        </div>
      </section>


      {/* ── Privacy section ── */}
      <section ref={el => revealRefs.current[2] = el} style={{ position: "relative", zIndex: 1, maxWidth: 860, margin: "0 auto", padding: "0 24px 64px", opacity: revealed[2] ? 1 : 0, transform: revealed[2] ? "none" : "translateY(24px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}>
        <div style={{
          background: "rgba(74,222,128,0.03)",
          border: "1px solid rgba(74,222,128,0.15)",
          borderRadius: 20, padding: isMobile ? "32px 20px" : "48px 40px",
        }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🔒</div>
            <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 400, letterSpacing: "-0.02em", margin: "0 0 12px" }}>
              Your portfolio stays<br /><em>on your device. Always.</em>
            </h2>
            <p style={{ color: "#64748b", fontSize: 15, maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
              Karta is built so that it <strong style={{ color: "#e2e8f0" }}>cannot</strong> see your holdings even if it wanted to.
              Here's exactly what happens when you use it.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24, marginBottom: 40 }}>
            {[
              { icon: "💾", title: "Stored in your browser only", desc: "Your tickers, share counts, and API key are saved in your browser's localStorage — the same place bookmarks and preferences live. Only you can read it." },
              { icon: "🚫", title: "No account, no database", desc: "Karta has no user database. There is no server storing your holdings because there is no server involved in the heatmap at all." },
              { icon: "📡", title: "API calls go browser → Finnhub", desc: "Stock price requests go directly from your browser to Finnhub. They never touch our servers. We never see which stocks you looked up." },
              { icon: "👁", title: "Open source — verify it yourself", desc: "The entire codebase is public on GitHub. You can read every line, run it locally, and confirm nothing is being sent anywhere." },
            ].map(item => (
              <div key={item.title} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 22 }}>{item.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0" }}>{item.title}</div>
                <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65 }}>{item.desc}</div>
              </div>
            ))}
          </div>

          {/* localStorage explainer */}
          <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "24px 28px", marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <span>💡</span> "If nothing goes to your servers — how does it remember my stocks?"
            </div>
            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.75, marginBottom: 16 }}>
              Great question. Karta uses a browser feature called <strong style={{ color: "#94a3b8" }}>localStorage</strong> — a small storage area built into every web browser, completely separate from the internet. Think of it like a notebook that lives inside your browser on your device.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
              {[
                { icon: "🔑", label: "API key", where: "Your browser only" },
                { icon: "📋", label: "Tickers & share counts", where: "Your browser only" },
                { icon: "🏷️", label: "App title preference", where: "Your browser only" },
                { icon: "📡", label: "Stock prices", where: "Fetched live from Finnhub" },
              ].map(item => (
                <div key={item.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{item.icon} {item.label}</div>
                  <div style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>→ {item.where}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.75 }}>
              You can verify this yourself: open your browser's DevTools (<strong style={{ color: "#94a3b8" }}>F12</strong>), go to <strong style={{ color: "#94a3b8" }}>Application → Local Storage</strong>, and you'll see your data sitting right there in your own browser — not on any server anywhere.
            </p>
          </div>

          {/* Technical proof bar */}
          <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: "18px 24px", display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 12, color: "#475569", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em" }}>WHAT KARTA COLLECTS:</span>
            {[
              { label: "Your stock tickers", no: true },
              { label: "Share counts", no: true },
              { label: "Portfolio value", no: true },
              { label: "Your identity", no: true },
              { label: "Page visit count", no: false },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: item.no ? "#f87171" : "#4ade80" }}>{item.no ? "✗" : "✓"}</span>
                <span style={{ fontSize: 12, color: item.no ? "#64748b" : "#94a3b8" }}>{item.label}</span>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", fontSize: 12, color: "#334155", marginTop: 14, fontFamily: "'JetBrains Mono', monospace" }}>
            * We count page visits (anonymously, no IP stored) only to show the user counter on this page.
          </p>
        </div>
      </section>

      {/* ── How it works ── */}
      <section ref={el => revealRefs.current[3] = el} style={{ position: "relative", zIndex: 1, maxWidth: 640, margin: "0 auto", padding: "0 24px 64px", opacity: revealed[3] ? 1 : 0, transform: revealed[3] ? "none" : "translateY(24px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 400, letterSpacing: "-0.02em", margin: "0 0 10px" }}>
            Your map, ready<br /><em>in 60 seconds.</em>
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <Step n="1" title="Get a free Finnhub API key" desc="Sign up at finnhub.io — no credit card. 60 req/min on the free tier handles any personal portfolio easily." />
          <Step n="2" title="Paste your holdings" desc="Type tickers and share counts, or bulk-paste two columns straight from your spreadsheet." />
          <Step n="3" title="Watch your map light up" desc="Each tile fills with color as data arrives. Your portfolio is fully visualized within seconds." />
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section ref={el => revealRefs.current[4] = el} style={{ position: "relative", zIndex: 1, maxWidth: 860, margin: "0 auto", padding: "0 24px 100px", opacity: revealed[4] ? 1 : 0, transform: revealed[4] ? "none" : "translateY(24px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}>
        <div style={{ background: "linear-gradient(135deg, rgba(74,222,128,0.045), rgba(59,130,246,0.045))", border: "1px solid rgba(74,222,128,0.12)", borderRadius: 20, padding: isMobile ? "36px 20px" : "56px 40px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}><KartaLogo size={56} /></div>
          <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 400, letterSpacing: "-0.02em", margin: "0 0 14px" }}>
            Chart your portfolio.
          </h2>
          <p style={{ color: S.muted, fontSize: 15, maxWidth: 420, margin: "0 auto 36px", lineHeight: 1.7 }}>
            Free and open source. No account. No tracking.<br />Your data never leaves your browser.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/app" style={{ padding: "14px 36px", borderRadius: 10, background: "linear-gradient(135deg, #4ade80, #16a34a)", color: "#051a0a", fontSize: 15, fontWeight: 800, textDecoration: "none", boxShadow: "0 0 40px rgba(74,222,128,0.18)", transition: "transform 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
              onMouseLeave={e => e.currentTarget.style.transform = ""}
            >Open Karta →</a>
            <a href="https://buymeacoffee.com" target="_blank" rel="noreferrer" style={{ padding: "14px 28px", borderRadius: 10, border: "1px solid rgba(255,214,0,0.18)", background: "rgba(255,214,0,0.04)", color: "#fde68a", fontSize: 15, fontWeight: 600, textDecoration: "none", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,214,0,0.1)"; e.currentTarget.style.borderColor = "rgba(255,214,0,0.35)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,214,0,0.04)"; e.currentTarget.style.borderColor = "rgba(255,214,0,0.18)"; }}
            >☕ Buy me a coffee</a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ position: "relative", zIndex: 1, borderTop: `1px solid ${S.border}`, padding: isMobile ? "20px 16px" : "24px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <KartaLogo size={22} />
          <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 15 }}>Karta</span>
          <span style={{ color: S.muted, fontSize: 12 }}>— free & open source</span>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          {[["GitHub","https://github.com/gopithota/karta"],["Finnhub","https://finnhub.io"],["Buy me a coffee","https://buymeacoffee.com"]].map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: S.muted, textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.color = S.text}
              onMouseLeave={e => e.currentTarget.style.color = S.muted}
            >{label}</a>
          ))}
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080b12; }
        ::selection { background: rgba(74,222,128,0.2); }

        .float-tile { animation: floatUp linear infinite; will-change: transform, opacity; }
        @keyframes floatUp {
          0%   { transform: translateY(0) rotate(0deg);      opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(-520px) rotate(12deg); opacity: 0; }
        }

        .ticker-wrap {
          overflow: hidden; width: 100%;
          mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
          -webkit-mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
          border-top: 1px solid rgba(255,255,255,0.06);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding: 9px 0; background: rgba(255,255,255,0.015);
        }
        .ticker-track { display: inline-flex; align-items: center; animation: tickerScroll 32s linear infinite; will-change: transform; white-space: nowrap; }
        @keyframes tickerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

        .card-reveal { opacity: 0; transform: translateY(20px); transition: opacity 0.55s ease, transform 0.55s ease; }
        .card-reveal.visible { opacity: 1; transform: translateY(0); }
      `}</style>
    </div>
  );
}
