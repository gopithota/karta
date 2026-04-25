// api/news.js — Proxy for Finnhub company news
//
// GET /api/news?ticker=AAPL
// Returns up to 2 most-recent articles from the last 14 days.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: "Missing ticker" });

  const apiKey = process.env.FINNHUB_KEY;
  if (!apiKey) return res.status(500).json({ error: "No API key configured" });

  const to   = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 14);
  const fmt  = (d) => d.toISOString().split("T")[0];

  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${fmt(from)}&to=${fmt(to)}&token=${apiKey}`
    );
    if (!r.ok) return res.status(r.status).json({ error: "Finnhub error" });

    const articles = await r.json();
    if (!Array.isArray(articles)) return res.json([]);

    const top2 = articles
      .filter(a => a.headline && a.url)
      .sort((a, b) => b.datetime - a.datetime)
      .slice(0, 8)
      .map(({ headline, url, source, datetime }) => ({ headline, url, source, datetime }));

    res.json(top2);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
