const APPS = ["Netflix", "Capcut", "Spotify", "Canva"];
const NOISE = /scam|penipu|tipu|hati-hati|waspada/i;
const MAX_MENIT = 10;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== "/api/tweets") return env.ASSETS.fetch(req);

    const cache = caches.default;
    const key = new Request(url.origin + "/api/tweets");
    const hit = await cache.match(key);
    if (hit) return hit;

    const since = Math.floor(Date.now() / 1000) - MAX_MENIT * 60;
    const q = `(wtb OR #zonauang OR #zonajajan OR #bealanja) lang:id -filter:retweets -filter:replies since_time:${since}`;

    const r = await fetch(
      "https://api.apify.com/v2/acts/apidojo~tweet-scraper/run-sync-get-dataset-items?timeout=120",
      {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: "Bearer " + env.APIFY_TOKEN },
        body: JSON.stringify({ searchTerms: [q], maxItems: 30, sort: "Latest" }),
      }
    );
    if (!r.ok) return new Response(await r.text(), { status: r.status });
    const data = await r.json();

    const batas = Date.now() - MAX_MENIT * 60000;
    const seen = new Set();
    const items = (Array.isArray(data) ? data : [])
      .filter(t => t && t.id && t.text && !NOISE.test(t.text) && !seen.has(t.id) && seen.add(t.id))
      .map(t => {
        const low = t.text.toLowerCase();
        let created = new Date(t.createdAt);
        if (isNaN(created)) created = new Date();
        return {
          id: String(t.id),
          n: t.author?.name || "?",
          h: t.author?.userName || "i",
          t: t.text.replace(/\s+/g, " "),
          created: created.toISOString(),
          app: APPS.find(a => low.includes(a.toLowerCase())) || "Lainnya",
          type: /\b(jual|ready|open order|po)\b/.test(low) ? "Menjual" : "Mencari produk",
        };
      })
      .filter(x => new Date(x.created).getTime() >= batas)
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    const res = new Response(JSON.stringify({ items }), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=60" },
    });
    await cache.put(key, res.clone());
    return res;
  },
};
