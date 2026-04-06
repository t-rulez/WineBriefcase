import { neon } from "@neondatabase/serverless";

// Wine-only category codes from Vinmonopolet open API
const WINE_TYPES = ["rødvin","hvitvin","rosévin","musserende","champagne",
  "sterkvin","dessertvin","portvin","sherry","madeira","cava","prosecco",
  "crémant","sekt","pét-nat","naturvin","oransjevin"];

function isWine(p) {
  const name = (p.basic?.productShortName || "").toLowerCase();
  // Exclude accessories and non-wine items explicitly
  const excluded = ["pose","eske","sekk","bag","gaveeske","handlenett",
    "tilbehør","korktrekt","glass","termos","boks"];
  if (excluded.some(x => name.includes(x))) return false;
  return true; // open API only returns products, filter by search term
}

function mapProduct(p) {
  const id = p.basic?.productId || p.productId;
  return {
    id, product_id: id,
    name:         p.basic?.productShortName || "",
    producer:     p.basic?.producerName || "",
    country:      p.origins?.origin?.country || "",
    region:       p.origins?.origin?.region || "",
    subRegion:    p.origins?.origin?.subRegion || "",
    year:         p.basic?.vintage || null,
    type:         p.classification?.subProductTypeName || "",
    mainCategory: p.classification?.mainProductTypeName || "",
    grapes:       (p.ingredients?.grapes || []).map(g => g.grapeDesc).join(", "),
    alcohol:      p.basic?.alcoholContent || null,
    volume:       p.basic?.volume || null,
    price:        p.prices?.[0]?.salesPrice || null,
    color:        p.taste?.colour || "",
    taste: p.taste ? {
      fullness:   p.taste.fullness,
      sweetness:  p.taste.sweetness,
      freshness:  p.taste.freshness,
      tannins:    p.taste.tannins,
      bitterness: p.taste.bitterness,
    } : null,
    aromaCategories: (p.taste?.aromaCategories || []).map(a => a.aroma),
    description_no:  p.taste?.characteristicDescription || "",
    imageUrl:      `https://bilder.vinmonopolet.no/cache/300x300-0/${id}-1.jpg`,
    imageUrlLarge: `https://bilder.vinmonopolet.no/cache/515x515-0/${id}-1.jpg`,
    url:           `https://www.vinmonopolet.no/p/${id}`,
    isEco:         p.logistics?.isEco || false,
    isVegan:       p.logistics?.isVegan || false,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const apiKey = process.env.VINMONOPOLET_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const { search = "", category = "", country = "", page = "0" } = req.query;
  const pageNum  = parseInt(page) || 0;
  const pageSize = 24;

  try {
    // Build search term — combine user search with category for better results
    let searchTerm = search || "";

    // If no search term, use category as search to filter results
    if (!searchTerm && category) searchTerm = category;
    // If nothing at all, search for "vin" to get wines
    if (!searchTerm) searchTerm = "vin";

    const params = new URLSearchParams({
      maxResults: String(pageSize * 3), // fetch more to filter non-wines
      start:      String(pageNum * pageSize),
    });
    if (searchTerm) params.set("productShortNameContains", searchTerm);

    const response = await fetch(
      `https://apis.vinmonopolet.no/products/v0/details-normal?${params}`,
      { headers: { "Ocp-Apim-Subscription-Key": apiKey, "Accept": "application/json" } }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: `Vinmonopolet API: ${response.status}` });
    }

    const data = await response.json();
    if (!Array.isArray(data)) return res.status(200).json({ wines: [], total: 0 });

    let wines = data.filter(isWine).map(mapProduct);

    // Filter by category
    if (category) {
      const q = category.toLowerCase();
      wines = wines.filter(w =>
        w.mainCategory.toLowerCase().includes(q) ||
        w.type.toLowerCase().includes(q)
      );
    }

    // Filter by country
    if (country) {
      const q = country.toLowerCase();
      wines = wines.filter(w => w.country.toLowerCase().includes(q));
    }

    // Limit to page size
    wines = wines.slice(0, pageSize);

    return res.status(200).json({ wines, total: wines.length, page: pageNum });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
