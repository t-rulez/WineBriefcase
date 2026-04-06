export default async function handler(req, res) {
  const q = req.query.q || "barolo";
  const results = {};

  // Test 1: spritjakt.no - Norwegian price comparison site
  try {
    const url = `https://www.spritjakt.no/api/search?q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = text.substring(0, 200); }
    results["spritjakt"] = { status: r.status, sample: JSON.stringify(data).substring(0, 500) };
  } catch(e) { results["spritjakt"] = { error: e.message }; }

  // Test 2: spritjakt has a public API
  try {
    const url = `https://www.spritjakt.no/api/products?search=${encodeURIComponent(q)}&type=wine`;
    const r = await fetch(url, { headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = text.substring(0, 200); }
    results["spritjakt_products"] = { status: r.status, sample: JSON.stringify(data).substring(0, 500) };
  } catch(e) { results["spritjakt_products"] = { error: e.message }; }

  // Test 3: GitHub raw open wine dataset
  try {
    const url = `https://raw.githubusercontent.com/jtilly/wine-data/master/wines.json`;
    const r = await fetch(url, { headers: { "Accept": "application/json" } });
    const text = await r.text();
    results["github_wine_data"] = { status: r.status, size: text.length, preview: text.substring(0, 300) };
  } catch(e) { results["github_wine_data"] = { error: e.message }; }

  // Test 4: minvin.no
  try {
    const url = `https://www.minvin.no/api/search?q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = text.substring(0, 200); }
    results["minvin"] = { status: r.status, sample: JSON.stringify(data).substring(0, 300) };
  } catch(e) { results["minvin"] = { error: e.message }; }

  // Test 5: aperitif.no search
  try {
    const url = `https://www.aperitif.no/sok?q=${encodeURIComponent(q)}&format=json`;
    const r = await fetch(url, { headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = text.substring(0, 200); }
    results["aperitif"] = { status: r.status, sample: JSON.stringify(data).substring(0, 300) };
  } catch(e) { results["aperitif"] = { error: e.message }; }

  return res.status(200).json(results);
}
