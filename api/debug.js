export default async function handler(req, res) {
  const id = req.query.id || "629905";

  const r = await fetch(`https://www.vinmonopolet.no/p/${id}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "nb-NO,nb;q=0.9",
    }
  });

  const html = await r.text();

  // Return chunks of the HTML so we can see the structure
  return res.status(200).json({
    httpStatus: r.status,
    htmlLength: html.length,
    // Show different sections of the HTML
    chunk1: html.substring(0, 3000),
    chunk2: html.substring(3000, 6000),
    chunk3: html.substring(6000, 9000),
    // Search for price-related text
    priceContext: (() => {
      const idx = html.indexOf("666");
      return idx > -1 ? html.substring(idx - 200, idx + 200) : "not found";
    })(),
    // Search for alcohol
    alcoholContext: (() => {
      const idx = html.toLowerCase().indexOf("alkohol");
      return idx > -1 ? html.substring(idx - 100, idx + 300) : "not found";
    })(),
    // Search for grape/drue
    grapeContext: (() => {
      const idx = html.toLowerCase().indexOf("drue");
      return idx > -1 ? html.substring(idx - 100, idx + 300) : "not found";
    })(),
    // Look for any JSON in the page
    firstJsonLike: (() => {
      const idx = html.indexOf('{"');
      return idx > -1 ? html.substring(idx, idx + 500) : "not found";
    })(),
  });
}
