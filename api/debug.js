// Debug - find Vinmonopolet website search API
export default async function handler(req, res) {
  const search = req.query.q || "barolo";
  const results = {};

  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "application/json",
    "Referer": "https://www.vinmonopolet.no/",
  };

  // Test the internal search API that the Vinmonopolet website uses
  const urls = [
    `https://www.vinmonopolet.no/vmpws/v2/vmp/search?q=${encodeURIComponent(search)}&searchType=product&currentPage=0&pageSize=5&fields=FULL`,
    `https://www.vinmonopolet.no/vmpws/v2/vmp/products/search?q=${encodeURIComponent(search)}&pageSize=5`,
    `https://www.vinmonopolet.no/vmpws/v2/vmp/search?q=${encodeURIComponent(search)}%3Arelevance%3AmainCategory%3ARødvin&searchType=product&currentPage=0&pageSize=5&fields=FULL`,
  ];

  for (const url of urls) {
    try {
      const r = await fetch(url, { headers });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text.substring(0, 500); }
      results[url.split("?")[0].split("/").pop()] = {
        status: r.status,
        url,
        data,
      };
    } catch(e) {
      results[url] = { error: e.message };
    }
  }

  return res.status(200).json(results);
}
