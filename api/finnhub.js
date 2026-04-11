// api/finnhub.js — Shared-key Finnhub proxy with Vercel KV caching
//
// GET  /api/finnhub?ticker=AAPL&type=quote
// GET  /api/finnhub?ticker=AAPL&type=candle&resolution=D&from=<unix_ts>
// GET  /api/finnhub?ticker=AAPL&type=...&force=true   ← bypasses cache (used after pre-flight)
// POST /api/finnhub                                    ← rate-limit pre-flight check only
//
// Rate limit: RL_MAX force-refreshes per IP per RL_WINDOW seconds.
// The client does one POST pre-flight before starting a refresh loop;
// individual GET requests with force=true skip the cache but do NOT
// re-check the rate limit, so the counter increments exactly once per
// refresh action regardless of portfolio size.

import { kv } from "@vercel/kv";

const CACHE_TTL = 900;  // 15 minutes
const RL_MAX    = 3;    // manual refreshes allowed per window per IP
const RL_WINDOW = 900;  // 15-minute window (seconds)

function getIP(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim()
    || req.socket?.remoteAddress
    || "unknown";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.FINNHUB_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Shared key not configured" });
  }

  // ── POST: rate-limit pre-flight ──────────────────────────────────────
  if (req.method === "POST") {
    const ip = getIP(req);
    const rlKey = `karta:rl:${ip}`;
    try {
      const count = await kv.incr(rlKey);
      if (count === 1) await kv.expire(rlKey, RL_WINDOW);
      if (count > RL_MAX) {
        const ttl = await kv.ttl(rlKey);
        return res.status(429).json({ error: "Rate limited", retryAfter: ttl });
      }
    } catch {
      // KV unavailable — allow through gracefully
    }
    return res.status(200).json({ ok: true });
  }

  // ── GET: fetch ticker data ──────────────────────────────────────────
  if (req.method !== "GET") return res.status(405).end();

  const { ticker, type, resolution, from, force } = req.query;
  const isForce = force === "true";

  // Validate inputs
  if (!ticker || !type) return res.status(400).json({ error: "Missing params" });
  if (!/^[A-Z0-9.\-]{1,10}$/i.test(ticker)) return res.status(400).json({ error: "Invalid ticker" });
  if (!["quote", "candle"].includes(type)) return res.status(400).json({ error: "Invalid type" });
  if (type === "candle" && (!resolution || !from)) return res.status(400).json({ error: "Missing resolution or from" });

  const sym = ticker.toUpperCase();

  // Cache key
  const cacheKey = type === "quote"
    ? `karta:v1:quote:${sym}`
    : `karta:v1:candle:${sym}:${resolution}:${from}`;

  // Return cached data unless this is a force refresh
  if (!isForce) {
    try {
      const cached = await kv.get(cacheKey);
      if (cached) return res.status(200).json({ ...cached, _cached: true });
    } catch { /* cache miss — fall through */ }
  }

  // Fetch from Finnhub
  const now = Math.floor(Date.now() / 1000);
  let url;
  if (type === "quote") {
    url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${apiKey}`;
  } else {
    url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(sym)}&resolution=${resolution}&from=${from}&to=${now}&token=${apiKey}`;
  }

  let data;
  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(r.status).json({ error: "Finnhub error" });
    data = await r.json();
  } catch {
    return res.status(502).json({ error: "Failed to reach Finnhub" });
  }

  // Cache the fresh result
  try {
    await kv.set(cacheKey, data, { ex: CACHE_TTL });
  } catch { /* non-critical */ }

  return res.status(200).json(data);
}
