export default async function handler(req, res) {
  const id = req.query.id || "629905";

  const r = await fetch(`https://www.vinmonopolet.no/p/${id}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "nb-NO,nb;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
    }
  });

  const html = await r.text();

  // Finn alle JSON-blokker i siden
  const jsonBlocks = [];
  const jsonRegex = /\{[^{}]*"productId"[^{}]*\}/g;
  let m;
  while ((m = jsonRegex.exec(html)) !== null) {
    try { jsonBlocks.push(JSON.parse(m[0])); } catch {}
  }

  // Finn script-tags med JSON
  const scripts = [];
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/g;
  while ((m = scriptRegex.exec(html)) !== null) {
    const s = m[1].trim();
    if (s.includes("salesPrice") || s.includes("alcoholContent") || s.includes("grapes") || s.includes("karakteristikk")) {
      scripts.push(s.substring(0, 1000));
    }
  }

  // Søk etter spesifikke verdier direkte
  const find = (pattern) => { const m = html.match(pattern); return m ? m[1] : null; };

  return res.status(200).json({
    httpStatus: r.status,
    htmlLength: html.length,
    // Pris
    salesPrice:      find(/salesPrice["\s:]+(\d+\.?\d*)/),
    price2:          find(/"value":\s*(\d+\.?\d*).*?"formattedValue"/),
    // Alkohol og volum
    alcoholContent:  find(/alcoholContent["\s:]+(\d+\.?\d*)/),
    volume:          find(/["\s]volume["\s:]+(\d+\.?\d*)/),
    // Vindeskrivelse og smak
    characteristicDescription: find(/characteristicDescription[":\s]+"([^"]{10,300})"/),
    // Druer
    grapes:          find(/grapeDesc[":\s]+"([^"]+)"/),
    // Smaker
    fullness:        find(/fullness[":\s]+(\d+)/),
    freshness:       find(/freshness[":\s]+(\d+)/),
    sweetness:       find(/sweetness[":\s]+(\d+)/),
    tannins:         find(/tannins[":\s]+(\d+)/),
    bitterness:      find(/bitterness[":\s]+(\d+)/),
    // Land og region
    country:         find(/country[":\s]+"([^"]{2,50})"/),
    region:          find(/region[":\s]+"([^"]{2,50})"/),
    // Aromaer
    aroma:           find(/aroma[":\s]+"([^"]+)"/),
    colour:          find(/colour[":\s]+"([^"]+)"/),
    vintage:         find(/vintage[":\s]+(\d{4})/),
    // Type
    mainProductType: find(/mainProductTypeName[":\s]+"([^"]+)"/),
    subProductType:  find(/subProductTypeName[":\s]+"([^"]+)"/),
    producerName:    find(/producerName[":\s]+"([^"]+)"/),
    // JSON blokker
    jsonBlocks: jsonBlocks.slice(0, 3),
    // Script-fragmenter
    relevantScripts: scripts.slice(0, 2),
  });
}
