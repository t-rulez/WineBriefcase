// Tests Vivino's internal search API
// Visit: /api/debug?q=barolo
// DELETE after use!

export default async function handler(req, res) {
  const q = req.query.q || "barolo";

  const urls = [
    `https://www.vivino.com/api/explore/explore?q=${encodeURIComponent(q)}&language=no&country_code=NO&price_range_min=50&price_range_max=5000`,
    `https://www.vivino.com/api/explore/explore?q=${encodeURIComponent(q)}&language=en&country_code=NO`,
    `https://www.vivino.com/search/wines?q=${encodeURIComponent(q)}`,
  ];

  const results = {};
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
          "Accept": "application/json",
          "Accept-Language": "nb-NO,nb;q=0.9",
          "Referer": "https://www.vivino.com/",
        }
      });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text.substring(0, 300); }
      results[url.split("vivino.com")[1].split("?")[0]] = {
        status: r.status,
        data: typeof data === "object" ? data : data,
      };
    } catch(e) {
      results[url] = { error: e.message };
    }
  }

  return res.status(200).json(results);
}
