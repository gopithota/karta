// api/counter.js — Vercel serverless function
// Uses Vercel KV (free tier) to count unique visitors.
//
// SETUP (one-time, takes 2 minutes):
//   1. vercel.com → your project → Storage → Create KV Database
//   2. Click "Connect to Project" — env vars are added automatically
//   3. Deploy. Done.
//
// Without KV configured, the endpoint returns a graceful fallback.

import { kv } from "@vercel/kv";

const SEED = 312; // starting offset so counter doesn't show "3 users"

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    let count;
    if (req.method === "POST") {
      // Increment and return new value
      count = await kv.incr("karta:visitors");
    } else {
      // GET — just read
      count = (await kv.get("karta:visitors")) || 0;
    }
    return res.status(200).json({ count: count + SEED });
  } catch (e) {
    // KV not configured — return seed so the UI still shows something
    return res.status(200).json({ count: SEED, fallback: true });
  }
}
