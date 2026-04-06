export default async function handler(req, res) {
  const q = req.query.q || "barolo";

  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.vivino.com/",
    "Origin": "https://www.vivino.com",
    "Content-Type": "application/json",
  };

  const results = {};

  // Try Vivino explore as POST with JSON body
  try {
    const r = await fetch("https://www.vivino.com/api/explore/explore", {
      method: "POST",
      headers,
      body: JSON.stringify({ q, language: "en", country_code: "NO", min_rating: 1 }),
    });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = text.substring(0, 300); }
    results["explore_POST"] = { status: r.status, sample: JSON.stringify(data).substring(0, 500) };
  } catch(e) { results["explore_POST"] = { error: e.message }; }

  // Try GET with wine_type_ids and min_rating
  try {
    const url = `https://www.vivino.com/api/explore/explore?q=${encodeURIComponent(q)}&wine_type_ids[]=1&wine_type_ids[]=2&wine_type_ids[]=3&min_rating=1&language=en&country_code=NO&currency_code=NOK`;
    const r = await fetch(url, { headers: { ...headers, "Content-Type": undefined } });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = text.substring(0, 300); }
    results["explore_GET_types"] = { status: r.status, sample: JSON.stringify(data).substring(0, 800) };
  } catch(e) { results["explore_GET_types"] = { error: e.message }; }

  // Try the grape/search endpoint
  try {
    const url = `https://www.vivino.com/api/grapes/search?q=${encodeURIComponent(q)}&language=en`;
    const r = await fetch(url, { headers });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = text.substring(0, 300); }
    results["grapes_search"] = { status: r.status, sample: JSON.stringify(data).substring(0, 500) };
  } catch(e) { results["grapes_search"] = { error: e.message }; }

  // Try wineries search
  try {
    const url = `https://www.vivino.com/api/wineries/search?q=${encodeURIComponent(q)}&language=en`;
    const r = await fetch(url, { headers });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = text.substring(0, 300); }
    results["wineries_search"] = { status: r.status, sample: JSON.stringify(data).substring(0, 500) };
  } catch(e) { results["wineries_search"] = { error: e.message }; }

  return res.status(200).json(results);
}
