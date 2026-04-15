import { describe, test, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App.jsx";

// Helper: renders App and returns a configured userEvent instance
function setup() {
  const user = userEvent.setup();
  render(<App />);
  return user;
}

// Convenience: parsed ph_portfolio from localStorage
const savedPortfolio = () => JSON.parse(localStorage.getItem("ph_portfolio") ?? "[]");

// ─── Initial render ───────────────────────────────────────────────
describe("initial render", () => {
  test("renders portfolio name", () => {
    setup();
    expect(screen.getByText("Portfolio Heatmap")).toBeInTheDocument();
  });

  test("shows demo banner in demo mode", () => {
    setup();
    expect(screen.getByText("Demo portfolio")).toBeInTheDocument();
  });

  test("all four tabs are present", () => {
    setup();
    // Use exact strings — regex would also match the demo hint "See table view" button
    expect(screen.getByRole("button", { name: "Heatmap" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Table" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Setup" })).toBeInTheDocument();
  });

  test("shows privacy notice on first visit", () => {
    setup();
    expect(screen.getByText("Your portfolio never leaves your device")).toBeInTheDocument();
  });

  test("privacy notice disappears after dismissal and sets localStorage flag", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: /got it/i }));
    expect(screen.queryByText("Your portfolio never leaves your device")).not.toBeInTheDocument();
    expect(localStorage.getItem("ph_privacy_seen")).toBe("1");
  });

  test("privacy notice is suppressed when ph_privacy_seen is already set", () => {
    localStorage.setItem("ph_privacy_seen", "1");
    setup();
    expect(screen.queryByText("Your portfolio never leaves your device")).not.toBeInTheDocument();
  });
});

// ─── Tab navigation ───────────────────────────────────────────────
describe("tab navigation", () => {
  test("Setup tab shows Finnhub API key section", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Setup" }));
    expect(screen.getByPlaceholderText(/paste your finnhub api key/i)).toBeInTheDocument();
  });

  test("Table tab shows empty-data prompt when no data loaded", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Table" }));
    expect(screen.getByText(/load data using the refresh button/i)).toBeInTheDocument();
  });

  test("History tab shows chart card title and empty state", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByText("Portfolio Value — 1 Year")).toBeInTheDocument();
    expect(screen.getByText("No history yet")).toBeInTheDocument();
  });

  test("Refresh button is absent on Setup and History tabs (toolbar hidden)", async () => {
    const user = setup();
    // Visible on Heatmap
    expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
    // Gone on Setup
    await user.click(screen.getByRole("button", { name: "Setup" }));
    expect(screen.queryByRole("button", { name: /refresh/i })).not.toBeInTheDocument();
    // Gone on History
    await user.click(screen.getByRole("button", { name: "History" }));
    expect(screen.queryByRole("button", { name: /refresh/i })).not.toBeInTheDocument();
  });
});

// ─── Portfolio management ─────────────────────────────────────────
describe("portfolio management", () => {
  // Navigate to Setup and clear the demo portfolio
  async function openSetupFresh(user) {
    await user.click(screen.getByRole("button", { name: "Setup" }));
    await user.click(screen.getByRole("button", { name: /clear demo/i }));
  }

  test("adding a stock persists it to localStorage", async () => {
    const user = setup();
    await openSetupFresh(user);
    await user.type(screen.getByPlaceholderText("TICKER"), "GOOG");
    await user.click(screen.getByRole("button", { name: /\+ add/i }));
    expect(savedPortfolio().some(p => p.ticker === "GOOG")).toBe(true);
  });

  test("adding a stock with custom share count saves correctly", async () => {
    const user = setup();
    await openSetupFresh(user);
    await user.type(screen.getByPlaceholderText("TICKER"), "NVDA");
    await user.clear(screen.getByPlaceholderText("Shares"));
    await user.type(screen.getByPlaceholderText("Shares"), "25");
    await user.click(screen.getByRole("button", { name: /\+ add/i }));
    const entry = savedPortfolio().find(p => p.ticker === "NVDA");
    expect(entry).toBeDefined();
    expect(entry.shares).toBe(25);
  });

  test("duplicate ticker is silently rejected — only one entry in portfolio", async () => {
    const user = setup();
    await openSetupFresh(user);
    await user.type(screen.getByPlaceholderText("TICKER"), "AAPL");
    await user.click(screen.getByRole("button", { name: /\+ add/i }));
    // Try adding AAPL again
    await user.type(screen.getByPlaceholderText("TICKER"), "AAPL");
    await user.click(screen.getByRole("button", { name: /\+ add/i }));
    expect(savedPortfolio().filter(p => p.ticker === "AAPL")).toHaveLength(1);
  });

  test("removing a stock removes it from localStorage", async () => {
    const user = setup();
    await openSetupFresh(user);
    await user.type(screen.getByPlaceholderText("TICKER"), "TSLA");
    await user.click(screen.getByRole("button", { name: /\+ add/i }));
    expect(savedPortfolio().some(p => p.ticker === "TSLA")).toBe(true);
    await user.click(screen.getByRole("button", { name: "×" }));
    expect(savedPortfolio().some(p => p.ticker === "TSLA")).toBe(false);
  });

  test("bulk import adds multiple new tickers to localStorage", async () => {
    const user = setup();
    await openSetupFresh(user);
    await user.type(screen.getByPlaceholderText(/AAPL, 50/i), "MSFT, 25\nAMZN, 10");
    await user.click(screen.getByRole("button", { name: /↑ import/i }));
    const portfolio = savedPortfolio();
    expect(portfolio.some(p => p.ticker === "MSFT" && p.shares === 25)).toBe(true);
    expect(portfolio.some(p => p.ticker === "AMZN" && p.shares === 10)).toBe(true);
  });

  test("bulk import rejects invalid lines and shows an error", async () => {
    const user = setup();
    await openSetupFresh(user);
    await user.type(screen.getByPlaceholderText(/AAPL, 50/i), "BADLINE");
    await user.click(screen.getByRole("button", { name: /↑ import/i }));
    expect(screen.getByText(/need ticker and shares/i)).toBeInTheDocument();
  });

  test("clear all empties the portfolio in localStorage", async () => {
    const user = setup();
    await openSetupFresh(user);
    await user.type(screen.getByPlaceholderText("TICKER"), "META");
    await user.click(screen.getByRole("button", { name: /\+ add/i }));
    expect(savedPortfolio().length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /clear all/i }));
    expect(savedPortfolio()).toHaveLength(0);
  });

  test("portfolio name change persists to localStorage", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Setup" }));
    const nameInput = screen.getByPlaceholderText("Portfolio Heatmap");
    await user.clear(nameInput);
    await user.type(nameInput, "My Stocks");
    expect(localStorage.getItem("ph_name")).toBe("My Stocks");
  });
});

// ─── History tab ──────────────────────────────────────────────────
describe("history tab", () => {
  test("shows Load demo data button when history is empty", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByRole("button", { name: /load demo data/i })).toBeInTheDocument();
  });

  test("seeding demo data populates summary cards and hides empty state", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "History" }));
    await user.click(screen.getByRole("button", { name: /load demo data/i }));
    expect(screen.queryByText("No history yet")).not.toBeInTheDocument();
    expect(screen.getByText("Current Value")).toBeInTheDocument();
    expect(screen.getByText("Days Recorded")).toBeInTheDocument();
    expect(screen.getByText("Tracking Since")).toBeInTheDocument();
  });

  test("seeded history data written to localStorage with correct shape", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "History" }));
    await user.click(screen.getByRole("button", { name: /load demo data/i }));
    const history = JSON.parse(localStorage.getItem("ph_history"));
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(30); // ~42 weekdays over 60 cal days
    expect(history[0]).toMatchObject({
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      value: expect.any(Number),
      change: expect.any(Number),
    });
  });

  test("seeded events written to localStorage with correct shape", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "History" }));
    await user.click(screen.getByRole("button", { name: /load demo data/i }));
    const events = JSON.parse(localStorage.getItem("ph_events"));
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toMatchObject({
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      type: expect.stringMatching(/^(add|remove|update)$/),
      ticker: expect.any(String),
      shares: expect.any(Number),
    });
  });

  test("Portfolio Changes list appears after seeding", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "History" }));
    await user.click(screen.getByRole("button", { name: /load demo data/i }));
    expect(screen.getByText(/portfolio changes/i)).toBeInTheDocument();
  });

  test("clearing history removes both localStorage keys and resets to empty state", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "History" }));
    await user.click(screen.getByRole("button", { name: /load demo data/i }));
    await user.click(screen.getByRole("button", { name: /clear all history data/i }));
    expect(localStorage.getItem("ph_history")).toBeNull();
    expect(localStorage.getItem("ph_events")).toBeNull();
    expect(screen.getByText("No history yet")).toBeInTheDocument();
  });
});

// ─── Demo mode transitions ────────────────────────────────────────
describe("demo mode", () => {
  test("exits demo mode after adding a real stock", async () => {
    const user = setup();
    expect(screen.getByText("Demo portfolio")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Setup" }));
    await user.click(screen.getByRole("button", { name: /clear demo/i }));
    await user.type(screen.getByPlaceholderText("TICKER"), "AAPL");
    await user.click(screen.getByRole("button", { name: /\+ add/i }));
    await user.click(screen.getByRole("button", { name: "Heatmap" }));
    await waitFor(() => {
      expect(screen.queryByText("Demo portfolio")).not.toBeInTheDocument();
    });
  });
});
