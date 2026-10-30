const SEARCH_TERMS = [
  "wtb lang:id -filter:retweets",
  '"mau netflix" lang:id -filter:retweets',
  '"butuh capcut" lang:id -filter:retweets',
  "#zonauang -filter:retweets",
];
const APPS = ["Netflix", "Capcut", "Spotify", "Canva"];

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== "/api/tweets") return env.ASSETS.fetch(req);

    const cache = caches.default;
    const key = new Request(url.origin + "/api/tweets");
    const hit = await cache.match(key);
    if (hit) return hit;

    const r = await fetch(
      "https://api.apify.com/v2/acts/apidojo~tweet-scraper/run-sync-get-dataset-items?timeout=120",
      {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: "Bearer " + env.APIFY_TOKEN },
        body: JSON.stringify({ searchTerms: SEARCH_TERMS, maxItems: 20, sort: "Latest" }),
      }
    );
    if (!r.ok) return new Response(await r.text(), { status: r.status });
    const data = await r.json();

    const seen = new Set();
    const items = (Array.isArray(data) ? data : [])
      .filter(t => t && t.id && t.text && !seen.has(t.id) && seen.add(t.id))
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
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    const res = new Response(JSON.stringify({ items }), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=180" },
    });
    await cache.put(key, res.clone());
    return res;
  },
};
