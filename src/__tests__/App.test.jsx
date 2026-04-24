import { describe, test, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { resetStore } from "../store/usePortfolioStore";

// Helper: renders App and returns a configured userEvent instance.
// Calls resetStore() so any localStorage pre-set by the test body is
// captured (beforeEach resets first, but some tests set localStorage
// before calling setup(), which would otherwise be missed).
function setup() {
  resetStore();
  const user = userEvent.setup();
  render(<App />);
  return user;
}

// Convenience: parsed ph_portfolio from localStorage
const savedPortfolio = () => JSON.parse(localStorage.getItem("ph_portfolio") ?? "[]");
const savedEvents    = () => JSON.parse(localStorage.getItem("ph_events")    ?? "[]");

// ─── Initial render ───────────────────────────────────────────────
describe("initial render", () => {
  test("renders portfolio name", () => {
    setup();
    expect(screen.getByText("Portfolio Heatmap")).toBeInTheDocument();
  });

  test("shows demo banner when portfolio is empty", () => {
    localStorage.setItem("ph_portfolio", JSON.stringify([]));
    setup();
    expect(screen.getByText("Demo portfolio")).toBeInTheDocument();
  });

  test("core tabs are present", () => {
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
    // Visible on Correlation (needs it to load candle data)
    await user.click(screen.getByRole("button", { name: "Corr" }));
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
    await user.click(screen.getByRole("button", { name: /clear all/i }));
  }

  // Helper: type into SmartInput textarea and apply
  async function smartAdd(user, text) {
    const ta = screen.getByPlaceholderText(/AAPL 100/);
    await user.clear(ta);
    await user.type(ta, text);
    await user.click(screen.getByRole("button", { name: /apply changes/i }));
  }

  test("adding a stock persists it to localStorage", async () => {
    const user = setup();
    await openSetupFresh(user);
    await smartAdd(user, "GOOG 10");
    expect(savedPortfolio().some(p => p.ticker === "GOOG")).toBe(true);
  });

  test("adding a stock with a custom share count saves correctly", async () => {
    const user = setup();
    await openSetupFresh(user);
    await smartAdd(user, "NVDA 25");
    const entry = savedPortfolio().find(p => p.ticker === "NVDA");
    expect(entry).toBeDefined();
    expect(entry.shares).toBe(25);
  });

  test("set command on existing ticker updates shares (one entry in portfolio)", async () => {
    const user = setup();
    await openSetupFresh(user);
    await smartAdd(user, "AAPL 50");
    await smartAdd(user, "AAPL 100"); // set, not duplicate-reject
    expect(savedPortfolio().filter(p => p.ticker === "AAPL")).toHaveLength(1);
    expect(savedPortfolio().find(p => p.ticker === "AAPL").shares).toBe(100);
  });

  test("add command increments shares on an existing ticker", async () => {
    const user = setup();
    await openSetupFresh(user);
    await smartAdd(user, "AAPL 50");
    await smartAdd(user, "add AAPL 20");
    expect(savedPortfolio().find(p => p.ticker === "AAPL").shares).toBe(70);
  });

  test("sold command decrements shares on an existing ticker", async () => {
    const user = setup();
    await openSetupFresh(user);
    await smartAdd(user, "AAPL 50");
    await smartAdd(user, "sold AAPL 20");
    expect(savedPortfolio().find(p => p.ticker === "AAPL").shares).toBe(30);
  });

  test("sold all shares removes the ticker from portfolio", async () => {
    const user = setup();
    await openSetupFresh(user);
    await smartAdd(user, "TSLA 10");
    expect(savedPortfolio().some(p => p.ticker === "TSLA")).toBe(true);
    await smartAdd(user, "sold TSLA 10");
    expect(savedPortfolio().some(p => p.ticker === "TSLA")).toBe(false);
  });

  test("multi-line input adds multiple tickers in one apply", async () => {
    const user = setup();
    await openSetupFresh(user);
    await smartAdd(user, "MSFT 25\nAMZN 10");
    const portfolio = savedPortfolio();
    expect(portfolio.some(p => p.ticker === "MSFT" && p.shares === 25)).toBe(true);
    expect(portfolio.some(p => p.ticker === "AMZN" && p.shares === 10)).toBe(true);
  });

  test("invalid line disables Apply and shows error text", async () => {
    const user = setup();
    await openSetupFresh(user);
    const ta = screen.getByPlaceholderText(/AAPL 100/);
    await user.type(ta, "BADLINE");
    expect(screen.getByRole("button", { name: /apply changes/i })).toBeDisabled();
    expect(screen.getByText(/couldn't be parsed/i)).toBeInTheDocument();
  });

  test("textarea is cleared after a successful apply", async () => {
    const user = setup();
    await openSetupFresh(user);
    await smartAdd(user, "GOOG 10");
    expect(screen.getByPlaceholderText(/AAPL 100/).value).toBe("");
  });

  test("removing a stock via × chip removes it from localStorage", async () => {
    const user = setup();
    await openSetupFresh(user);
    await smartAdd(user, "TSLA 10");
    expect(savedPortfolio().some(p => p.ticker === "TSLA")).toBe(true);
    await user.click(screen.getByRole("button", { name: "×" }));
    expect(savedPortfolio().some(p => p.ticker === "TSLA")).toBe(false);
  });

  test("clear all empties the portfolio in localStorage", async () => {
    const user = setup();
    await openSetupFresh(user);
    await smartAdd(user, "META 5");
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

  test("Example button populates the textarea", async () => {
    const user = setup();
    await openSetupFresh(user);
    await user.click(screen.getByRole("button", { name: /example/i }));
    expect(screen.getByPlaceholderText(/AAPL 100/).value).toMatch(/AAPL/);
  });

  test("SmartInput Clear button empties the textarea", async () => {
    const user = setup();
    await openSetupFresh(user);
    const ta = screen.getByPlaceholderText(/AAPL 100/);
    await user.type(ta, "GOOG 10");
    // The Clear button inside SmartInput (not "Clear all" in holdings)
    const clearBtns = screen.getAllByRole("button", { name: /^clear$/i });
    await user.click(clearBtns[0]);
    expect(ta.value).toBe("");
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

// ─── Annotation editing (History tab) ────────────────────────────
describe("annotation editing", () => {
  async function seedAndOpenHistory(user) {
    await user.click(screen.getByRole("button", { name: "History" }));
    await user.click(screen.getByRole("button", { name: /load demo data/i }));
  }

  test("clicking a note enters edit mode and shows an input", async () => {
    const user = setup();
    await seedAndOpenHistory(user);
    await user.click(screen.getByText("AI momentum, added on dip"));
    expect(screen.getByPlaceholderText("Add a note…")).toBeInTheDocument();
  });

  test("edit input is pre-filled with the existing note", async () => {
    const user = setup();
    await seedAndOpenHistory(user);
    await user.click(screen.getByText("AI momentum, added on dip"));
    expect(screen.getByPlaceholderText("Add a note…").value).toBe("AI momentum, added on dip");
  });

  test("pressing Enter saves the updated note to localStorage", async () => {
    const user = setup();
    await seedAndOpenHistory(user);
    await user.click(screen.getByText("AI momentum, added on dip"));
    const input = screen.getByPlaceholderText("Add a note…");
    await user.clear(input);
    await user.type(input, "Entered on dip{Enter}");
    expect(savedEvents().some(e => e.note === "Entered on dip")).toBe(true);
  });

  test("clicking ✓ saves the updated note to localStorage", async () => {
    const user = setup();
    await seedAndOpenHistory(user);
    await user.click(screen.getByText("Rebalancing tech allocation"));
    const input = screen.getByPlaceholderText("Add a note…");
    await user.clear(input);
    await user.type(input, "Confirmed rebalance");
    await user.click(screen.getByTitle("Save (Enter)"));
    expect(savedEvents().some(e => e.note === "Confirmed rebalance")).toBe(true);
  });

  test("after saving, the input is replaced by the new note text", async () => {
    const user = setup();
    await seedAndOpenHistory(user);
    await user.click(screen.getByText("Rebalancing tech allocation"));
    const input = screen.getByPlaceholderText("Add a note…");
    await user.clear(input);
    await user.type(input, "New label{Enter}");
    expect(screen.queryByPlaceholderText("Add a note…")).not.toBeInTheDocument();
    expect(screen.getByText("New label")).toBeInTheDocument();
  });

  test("pressing Escape cancels editing without saving", async () => {
    const user = setup();
    await seedAndOpenHistory(user);
    const originalNote = "AI momentum, added on dip";
    await user.click(screen.getByText(originalNote));
    const input = screen.getByPlaceholderText("Add a note…");
    await user.clear(input);
    await user.type(input, "Should not persist");
    await user.keyboard("{Escape}");
    expect(screen.queryByPlaceholderText("Add a note…")).not.toBeInTheDocument();
    expect(savedEvents().some(e => e.note === "Should not persist")).toBe(false);
    // Original note unchanged in storage
    expect(savedEvents().some(e => e.note === originalNote)).toBe(true);
  });

  test("clicking ✕ cancels editing without saving", async () => {
    const user = setup();
    await seedAndOpenHistory(user);
    await user.click(screen.getByText("AI momentum, added on dip"));
    const input = screen.getByPlaceholderText("Add a note…");
    await user.clear(input);
    await user.type(input, "Should not persist either");
    await user.click(screen.getByTitle("Cancel (Esc)"));
    expect(screen.queryByPlaceholderText("Add a note…")).not.toBeInTheDocument();
    expect(savedEvents().some(e => e.note === "Should not persist either")).toBe(false);
  });

  test("saving an empty note removes the note property from the event", async () => {
    const user = setup();
    await seedAndOpenHistory(user);
    await user.click(screen.getByText("Rotating out of energy"));
    const input = screen.getByPlaceholderText("Add a note…");
    await user.clear(input);
    await user.click(screen.getByTitle("Save (Enter)"));
    const xomEvent = savedEvents().find(e => e.ticker === "XOM");
    expect(xomEvent).toBeDefined();
    expect(xomEvent).not.toHaveProperty("note");
  });
});

// ─── Theme switcher (in Setup tab) ───────────────────────────────
describe("theme switcher", () => {
  async function openSetup(user) {
    await user.click(screen.getByRole("button", { name: "Setup" }));
  }

  test("renders three theme buttons in the Setup tab", async () => {
    const user = setup();
    await openSetup(user);
    expect(screen.getByRole("button", { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /warm/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /light/i })).toBeInTheDocument();
  });

  test("theme buttons are NOT present outside Setup tab", () => {
    setup();
    // On initial Heatmap tab — no Dark/Warm/Light buttons
    expect(screen.queryByRole("button", { name: /^dark$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^warm$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^light$/i })).not.toBeInTheDocument();
  });

  test("defaults to dark theme (no localStorage key set)", async () => {
    const user = setup();
    await openSetup(user);
    expect(localStorage.getItem("ph_theme")).toBeNull();
    expect(screen.getByRole("button", { name: /dark/i })).toBeInTheDocument();
  });

  test("clicking Warm persists 'warm' to localStorage", async () => {
    const user = setup();
    await openSetup(user);
    await user.click(screen.getByRole("button", { name: /warm/i }));
    expect(localStorage.getItem("ph_theme")).toBe("warm");
  });

  test("clicking Light persists 'light' to localStorage", async () => {
    const user = setup();
    await openSetup(user);
    await user.click(screen.getByRole("button", { name: /light/i }));
    expect(localStorage.getItem("ph_theme")).toBe("light");
  });

  test("clicking Dark persists 'dark' to localStorage", async () => {
    const user = setup();
    await openSetup(user);
    await user.click(screen.getByRole("button", { name: /warm/i }));
    await user.click(screen.getByRole("button", { name: /dark/i }));
    expect(localStorage.getItem("ph_theme")).toBe("dark");
  });

  test("active theme shows a checkmark (✓) next to its label", async () => {
    localStorage.setItem("ph_theme", "warm");
    const user = setup();
    await openSetup(user);
    // The warm button should contain a ✓
    const warmBtn = screen.getByRole("button", { name: /warm/i });
    expect(warmBtn).toHaveTextContent("✓");
  });

  test("persisted theme is loaded on render", async () => {
    localStorage.setItem("ph_theme", "light");
    const user = setup();
    await openSetup(user);
    expect(localStorage.getItem("ph_theme")).toBe("light");
    // Light button should carry the active checkmark
    expect(screen.getByRole("button", { name: /light/i })).toHaveTextContent("✓");
  });
});

// ─── Demo mode transitions ────────────────────────────────────────
describe("demo mode", () => {
  test("exits demo mode after adding a real stock", async () => {
    localStorage.setItem("ph_portfolio", JSON.stringify([]));
    const user = setup();
    expect(screen.getByText("Demo portfolio")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Setup" }));
    await user.type(screen.getByPlaceholderText(/AAPL 100/), "AAPL 10");
    await user.click(screen.getByRole("button", { name: /apply changes/i }));
    await user.click(screen.getByRole("button", { name: "Heatmap" }));
    await waitFor(() => {
      expect(screen.queryByText("Demo portfolio")).not.toBeInTheDocument();
    });
  });
});
