import "@testing-library/jest-dom";

// ResizeObserver is not implemented in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Reset localStorage between every test
beforeEach(() => localStorage.clear());

// Silence the fetch calls the component fires on mount (shared-key auto-fetch).
// Returning ok:false causes the silent fetch to break out immediately.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
  );
});

afterEach(() => vi.restoreAllMocks());
