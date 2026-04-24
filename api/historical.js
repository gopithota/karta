// GET /api/historical?ticker=AAPL
// Returns { s: "ok"|"no_data", t: [...unixSec], c: [...closePrice] }
// Proxies Yahoo Finance v8 chart API for 1-year daily closes.
// No API key required; responses are CDN-cached for 1 hour.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=900");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).end();

  const { ticker } = req.query;
  if (!ticker || !/^[A-Z0-9.\-]{1,10}$/i.test(ticker)) {
    return res.status(400).json({ error: "Invalid ticker" });
  }

  const sym = ticker.toUpperCase();
  const noData = { s: "no_data", t: [], c: [] };

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1y&includePrePost=false`;
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
      },
    });
    if (!r.ok) return res.status(200).json(noData);

    const data = await r.json();
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp) return res.status(200).json(noData);

    const timestamps = result.timestamp;
    const rawCloses = result.indicators?.quote?.[0]?.close ?? [];

    const t = [], c = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (rawCloses[i] != null && isFinite(rawCloses[i])) {
        t.push(timestamps[i]);
        c.push(rawCloses[i]);
      }
    }

    if (t.length < 10) return res.status(200).json(noData);
    return res.status(200).json({ s: "ok", t, c });
  } catch {
    return res.status(200).json(noData);
  }
}
