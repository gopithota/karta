import { useState, useCallback } from "react";

export const THEMES = {

  // ── Dark (cold navy) ─────────────────────────────────────────────
  dark: {
    // Surfaces
    bg:           "#0c0f18",
    panel:        "#131825",
    border:       "#1c2536",
    rowBorder:    "#0f1520",
    overlay:      "rgba(12,15,24,0.92)",
    tooltip:      "#1a2235",
    inputBg:      "#0c0f18",
    // Text hierarchy
    text:         "#e2e8f0",
    muted:        "#64748b",
    subtext:      "#334155",
    strong:       "#f1f5f9",
    emphasis:     "#cbd5e1",
    code:         "#94a3b8",
    // Interactive
    accent:       "#3b82f6",
    link:         "#93c5fd",
    green:        "#4ade80",
    greenDim:     "rgba(74,222,128,0.10)",
    // Chart
    chartGrid:    "#1c2536",
    chartLabel:   "#475569",
    chartCross:   "#334155",
    // Active tab
    tabActiveBg:      "#1a3160",
    tabActiveBorder:  "#3b82f6",
    tabActiveText:    "#93c5fd",
    // FREE badge
    badgeFreeBg:      "#1d3a6e",
    badgeFreeText:    "#93c5fd",
    // Landing
    navBg:        "rgba(8,11,18,0.92)",
    heroGrad:     "linear-gradient(160deg, #f8fafc 20%, #94a3b8 100%)",
    demoWin:      "#0c0f18",
    demoBar:      "#09111e",
    demoUrl:      "rgba(255,255,255,0.05)",
    etymBg:       "rgba(255,255,255,0.035)",
    featureCard:  "rgba(255,255,255,0.025)",
    statsBg:      "rgba(255,255,255,0.02)",
    privBoxBg:    "rgba(0,0,0,0.25)",
    privBoxBorder:"rgba(255,255,255,0.06)",
    privBarBg:    "rgba(0,0,0,0.30)",
    privItemBg:   "rgba(255,255,255,0.03)",
    tickerBg:     "rgba(255,255,255,0.015)",
    logoGlow:     "rgba(74,222,128,0.14)",
    pageGlow:     "rgba(34,197,94,0.055)",
    grain:        true,
  },

  // ── Warm Dark (charcoal brown) ───────────────────────────────────
  warm: {
    bg:           "#17130e",
    panel:        "#211d16",
    border:       "#342c22",
    rowBorder:    "#1e1912",
    overlay:      "rgba(20,16,10,0.92)",
    tooltip:      "#2a231a",
    inputBg:      "#17130e",
    text:         "#f0e8d8",
    muted:        "#8c7d6a",
    subtext:      "#4a3f32",
    strong:       "#f5ead6",
    emphasis:     "#c8b89a",
    code:         "#a08c74",
    accent:       "#e8a045",
    link:         "#e8c87a",
    green:        "#4ade80",
    greenDim:     "rgba(74,222,128,0.10)",
    chartGrid:    "#342c22",
    chartLabel:   "#8c7d6a",
    chartCross:   "#4a3f32",
    tabActiveBg:      "#3d2a10",
    tabActiveBorder:  "#e8a045",
    tabActiveText:    "#e8c87a",
    badgeFreeBg:      "#3d2a10",
    badgeFreeText:    "#e8c87a",
    navBg:        "rgba(20,16,10,0.92)",
    heroGrad:     "linear-gradient(160deg, #f5ead6 20%, #8c7d6a 100%)",
    demoWin:      "#1a1510",
    demoBar:      "#120f0a",
    demoUrl:      "rgba(255,240,210,0.05)",
    etymBg:       "rgba(255,240,210,0.04)",
    featureCard:  "rgba(255,240,210,0.03)",
    statsBg:      "rgba(255,240,210,0.03)",
    privBoxBg:    "rgba(0,0,0,0.30)",
    privBoxBorder:"rgba(255,240,210,0.07)",
    privBarBg:    "rgba(0,0,0,0.35)",
    privItemBg:   "rgba(255,240,210,0.03)",
    tickerBg:     "rgba(255,240,210,0.015)",
    logoGlow:     "rgba(74,222,128,0.10)",
    pageGlow:     "rgba(34,197,94,0.04)",
    grain:        true,
  },

  // ── Light (warm cream) ───────────────────────────────────────────
  light: {
    bg:           "#f0ece4",
    panel:        "#faf7f2",
    border:       "#ddd7cc",
    rowBorder:    "#e8e2d8",
    overlay:      "rgba(240,236,228,0.95)",
    tooltip:      "#ffffff",
    inputBg:      "#f5f1eb",
    text:         "#1c1510",
    muted:        "#7c6f60",
    subtext:      "#c5b8a8",
    strong:       "#1c1510",
    emphasis:     "#4a3f32",
    code:         "#6b5c4e",
    accent:       "#2563eb",
    link:         "#2563eb",
    green:        "#16a34a",
    greenDim:     "rgba(22,163,74,0.10)",
    chartGrid:    "#e2dbd0",
    chartLabel:   "#9c8f80",
    chartCross:   "#d0c8bc",
    tabActiveBg:      "#dce8ff",
    tabActiveBorder:  "#2563eb",
    tabActiveText:    "#1d4ed8",
    badgeFreeBg:      "#dce8ff",
    badgeFreeText:    "#1d4ed8",
    navBg:        "rgba(240,236,228,0.95)",
    heroGrad:     "linear-gradient(160deg, #1c1510 20%, #7c6f60 100%)",
    demoWin:      "#ede8e0",
    demoBar:      "#e4ded5",
    demoUrl:      "rgba(0,0,0,0.07)",
    etymBg:       "rgba(0,0,0,0.04)",
    featureCard:  "#ffffff",
    statsBg:      "rgba(0,0,0,0.03)",
    privBoxBg:    "rgba(0,0,0,0.04)",
    privBoxBorder:"#ddd7cc",
    privBarBg:    "rgba(0,0,0,0.05)",
    privItemBg:   "rgba(0,0,0,0.04)",
    tickerBg:     "rgba(0,0,0,0.02)",
    logoGlow:     "rgba(74,222,128,0.07)",
    pageGlow:     "rgba(34,197,94,0.03)",
    grain:        false,
  },
};

// Swatch colors for the 3-way picker (dot colors that visually represent each theme)
export const SWATCHES = [
  { key: "dark",  dot: "#1e2d4a", label: "Dark"  },
  { key: "warm",  dot: "#7c4a1a", label: "Warm"  },
  { key: "light", dot: "#e8ddd0", label: "Light" },
];

export function useTheme() {
  const [theme, _set] = useState(
    () => localStorage.getItem("ph_theme") || "dark"
  );
  const setTheme = useCallback((t) => {
    _set(t);
    localStorage.setItem("ph_theme", t);
  }, []);
  return [theme, setTheme];
}
