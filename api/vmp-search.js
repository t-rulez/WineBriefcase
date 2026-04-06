// Proxy for Vinmonopolet website search — forwards request server-side
// with browser-like headers to avoid blocking

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const q = req.query.q || "";
  if (!q) return res.status(400).json({ error: "q påkrevd" });

  const url = `https://www.vinmonopolet.no/vmpws/v2/vmp/search?q=${encodeURIComponent(q)}&searchType=product&currentPage=0&pageSize=8&fields=FULL`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "nb-NO,nb;q=0.9,no;q=0.8,en;q=0.6",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://www.vinmonopolet.no/",
        "Origin": "https://www.vinmonopolet.no",
        "sec-ch-ua": '"Google Chrome";v="123", "Not:A-Brand";v="8"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Connection": "keep-alive",
      },
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(200).json({
        error: true,
        status: response.status,
        body: text.substring(0, 200),
      });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(200).json({ error: true, body: text.substring(0, 200) });
    }

    const products = data?.productSearchResult?.products || [];
    return res.status(200).json({
      ok: true,
      count: products.length,
      products: products.map(p => ({
        code: p.code,
        name: p.name,
        price: p.price?.value,
        type: p.main_category?.name,
        country: p.main_country?.name,
      })),
    });

  } catch (err) {
    return res.status(200).json({ error: true, message: err.message });
  }
}
