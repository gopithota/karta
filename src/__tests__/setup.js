import "@testing-library/jest-dom";
import { resetStore } from "../store/usePortfolioStore";

// ResizeObserver is not implemented in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// scrollIntoView is not implemented in jsdom
Element.prototype.scrollIntoView = function () {};

// Reset localStorage + Zustand store between every test.
// Zustand is a module singleton — without resetting it, tab/portfolio/etc.
// changes from one test bleed into the next.
beforeEach(() => {
  localStorage.clear();
  resetStore();
});

// Silence the fetch calls the component fires on mount (shared-key auto-fetch).
// Returning ok:false causes the silent fetch to break out immediately.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
  );
});

afterEach(() => vi.restoreAllMocks());
