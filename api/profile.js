// GET /api/profile?ticker=AAPL
// Returns { name: string|null, industry: string|null } from Finnhub /stock/profile2.
// Free Finnhub endpoint. Responses are KV-cached for 24 h — sector rarely changes.

import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=3600");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).end();

  const { ticker } = req.query;
  if (!ticker || !/^[A-Z0-9.\-]{1,10}$/i.test(ticker)) {
    return res.status(400).json({ error: "Invalid ticker" });
  }

  const sym = ticker.toUpperCase();
  const cacheKey = `karta:v1:profile:${sym}`;

  // Serve from KV cache if available
  try {
    const cached = await kv.get(cacheKey);
    if (cached) return res.status(200).json({ ...cached, _cached: true });
  } catch { /* miss — fall through */ }

  const apiKey = process.env.FINNHUB_KEY;
  if (!apiKey) return res.status(503).json({ error: "Shared key not configured" });

  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(sym)}&token=${apiKey}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!r.ok) return res.status(200).json({ name: null, industry: null });

    const data = await r.json();
    const result = {
      name:     data.name            || null,
      industry: data.finnhubIndustry || null,
    };

    try { await kv.set(cacheKey, result, { ex: 86400 }); } catch { /* non-critical */ }

    return res.status(200).json(result);
  } catch {
    return res.status(200).json({ name: null, industry: null });
  }
}
