export const PERIODS = [
  { key: "today", label: "Today" },
  { key: "ytd",   label: "YTD"   },
  { key: "3m",    label: "3M"    },
  { key: "6m",    label: "6M"    },
  { key: "1y",    label: "1Y"    },
  { key: "5y",    label: "5Y"    },
] as const;

export const LEGEND_STOPS = [-10, -7, -4, -2, -1, 0, 1, 2, 4, 7, 10] as const;

export const RL_WINDOW = 900; // must match api/finnhub.js
