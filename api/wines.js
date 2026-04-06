// Proxy to Vinmonopolet's public API
// Filters to only return actual wine products.

function isWine(p) {
  const main = (p.classification?.mainProductTypeName || "").toLowerCase();
  const sub  = (p.classification?.subProductTypeName  || "").toLowerCase();
  const name = (p.basic?.productShortName || "").toLowerCase();

  // Explicit exclusions — bags, boxes, accessories
  const excluded = ["pose", "eske", "sekk", "bag", "gaveeske", "handlenett",
                    "tilbehør", "holder", "korktrekt", "glass", "termos"];
  if (excluded.some(x => name.includes(x) || sub.includes(x) || main.includes(x))) return false;

  // Must be wine category
  const wineKeywords = ["vin", "champagne", "cava", "prosecco", "crémant",
                        "sekt", "pét-nat", "pet nat", "amarone", "port",
                        "sherry", "madeira", "marsala"];
  return wineKeywords.some(k => main.includes(k) || sub.includes(k));
}

function mapProduct(p) {
  const id = p.basic?.productId || p.productId;
  return {
    id,
    name:         p.basic?.productShortName || p.productShortName || "",
    fullName:     p.basic?.productLongName  || "",
    type:         p.classification?.subProductTypeName  || "",
    mainCategory: p.classification?.mainProductTypeName || "",
    country:      p.origins?.origin?.country   || "",
    region:       p.origins?.origin?.region    || "",
    subRegion:    p.origins?.origin?.subRegion || "",
    year:         p.basic?.vintage        || null,
    alcohol:      p.basic?.alcoholContent || null,
    volume:       p.basic?.volume         || null,
    price:        p.prices?.[0]?.salesPrice || null,
    grapes:       p.ingredients?.grapes?.map(g => g.grapeDesc).join(", ") || "",
    taste: p.taste?.bitterness != null ? {
      bitterness: p.taste.bitterness,
      sweetness:  p.taste.sweetness,
      freshness:  p.taste.freshness,
      tannins:    p.taste.tannins,
      fullness:   p.taste.fullness,
    } : null,
    color:           p.taste?.colour || "",
    aromaCategories: p.taste?.aromaCategories?.map(a => a.aroma) || [],
    imageUrl:        `https://bilder.vinmonopolet.no/cache/300x300-0/${id}-1.jpg`,
    imageUrlLarge:   `https://bilder.vinmonopolet.no/cache/515x515-0/${id}-1.jpg`,
    url:             `https://www.vinmonopolet.no/p/${id}`,
    isEco:           p.logistics?.isEco        || false,
    isVegan:         p.logistics?.isVegan      || false,
    isBiodynamic:    p.logistics?.isBiodynamic || false,
  };
}

async function fetchPage(apiKey, search, start, pageSize) {
  const params = new URLSearchParams({ maxResults: pageSize, start });
  if (search) params.set("productShortNameContains", search);
  const res = await fetch(
    `https://apis.vinmonopolet.no/products/v0/details-normal?${params}`,
    { headers: { "Ocp-Apim-Subscription-Key": apiKey, "Accept": "application/json" } }
  );
  if (!res.ok) throw new Error(`Vinmonopolet API feil: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const apiKey = process.env.VINMONOPOLET_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const {
    search     = "",
    category   = "",
    country    = "",
    maxResults = "24",
  } = req.query;

  const want  = parseInt(maxResults, 10) || 24;
  const PAGE  = 100;   // fetch 100 at a time from Vinmonopolet
  const MAX_PAGES = 8; // never fetch more than 800 products total

  try {
    let wines   = [];
    let start   = 0;
    let page    = 0;
    let exhausted = false;

    // Keep fetching pages until we have enough wines or run out of products
    while (wines.length < want && page < MAX_PAGES && !exhausted) {
      const raw = await fetchPage(apiKey, search, start, PAGE);
      if (raw.length < PAGE) exhausted = true;  // last page

      let filtered = raw.filter(isWine).map(mapProduct);

      // Sub-category filter (Rødvin, Hvitvin etc.)
      if (category) {
        const q = category.toLowerCase();
        filtered = filtered.filter(w =>
          w.mainCategory.toLowerCase().includes(q) ||
          w.type.toLowerCase().includes(q)
        );
      }

      // Country filter
      if (country) {
        const q = country.toLowerCase();
        filtered = filtered.filter(w => w.country.toLowerCase().includes(q));
      }

      wines = wines.concat(filtered);
      start += PAGE;
      page++;
    }

    // Cap at requested amount
    wines = wines.slice(0, want);

    return res.status(200).json({ wines, total: wines.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
