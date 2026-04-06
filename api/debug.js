export default async function handler(req, res) {
  const q = req.query.q || "barolo";

  const urls = [
    // Vivino explore med type_ids (1=red, 2=white, 3=sparkling, 4=rose, 7=dessert, 24=fortified)
    `https://www.vivino.com/api/explore/explore?q=${encodeURIComponent(q)}&language=en&country_code=NO&min_rating=1`,
    // Vivino wine search
    `https://www.vivino.com/api/wines/search?q=${encodeURIComponent(q)}&language=en`,
    // Vivino typeahead
    `https://www.vivino.com/api/typeaheads/search?q=${encodeURIComponent(q)}`,
    // Vivino with wine_type_ids
    `https://www.vivino.com/api/explore/explore?wine_type_ids[]=1&q=${encodeURIComponent(q)}&language=en&country_code=NO`,
  ];

  const results = {};
  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.vivino.com/",
    "Origin": "https://www.vivino.com",
  };

  for (const url of urls) {
    try {
      const r = await fetch(url, { headers });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text.substring(0, 200); }
      const key = url.split("vivino.com")[1].split("?")[0];
      results[key] = { status: r.status, sample: JSON.stringify(data).substring(0, 400) };
    } catch(e) {
      results[url.split("vivino.com")[1]?.split("?")[0] || url] = { error: e.message };
    }
  }

  return res.status(200).json(results);
}
