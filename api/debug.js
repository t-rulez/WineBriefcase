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

  // The data is in a React component script tag as JSON
  // Find the product data JSON block
  const scriptMatches = [];
  const scriptRegex = /<script type="application\/json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = scriptRegex.exec(html)) !== null) {
    const text = m[1].trim();
    if (text.includes("salesPrice") || text.includes("main_category") || text.includes("litrePrice")) {
      try {
        scriptMatches.push(JSON.parse(text));
      } catch(e) {
        scriptMatches.push({ parseError: e.message, raw: text.substring(0, 500) });
      }
    }
  }

  // Also look for the product data in data-react-component sections
  const dataComponentRegex = /data-react-component="[^"]*Product[^"]*"[\s\S]*?<script type="application\/json">([\s\S]*?)<\/script>/g;
  const components = [];
  while ((m = dataComponentRegex.exec(html)) !== null) {
    try { components.push(JSON.parse(m[1])); } catch {}
  }

  // Find the chunk around "salesPrice"
  const salePriceIdx = html.indexOf("salesPrice");
  const salePriceContext = salePriceIdx > -1
    ? html.substring(salePriceIdx - 50, salePriceIdx + 500)
    : "not found";

  // Find the chunk around "alcoholContent"  
  const alcoholIdx = html.indexOf("alcoholContent");
  const alcoholContext = alcoholIdx > -1
    ? html.substring(alcoholIdx - 50, alcoholIdx + 300)
    : "not found";

  // Find grapeDesc
  const grapeIdx = html.indexOf("grapeDesc");
  const grapeContext = grapeIdx > -1
    ? html.substring(grapeIdx - 50, grapeIdx + 300)
    : "not found";

  // Find characteristicDescription
  const descIdx = html.indexOf("characteristicDescription");
  const descContext = descIdx > -1
    ? html.substring(descIdx - 20, descIdx + 400)
    : "not found";

  return res.status(200).json({
    scriptMatches,
    components,
    salePriceContext,
    alcoholContext,
    grapeContext,
    descContext,
  });
}
