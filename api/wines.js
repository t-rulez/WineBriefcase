// Proxy to Vinmonopolet's public API
// Requires VINMONOPOLET_API_KEY in environment variables
// Get free key at: https://api.vinmonopolet.no/

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const apiKey = process.env.VINMONOPOLET_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const {
    search = "",
    category = "",   // Rødvin, Hvitvin, Rosévin, Musserende vin, etc.
    country = "",
    maxResults = "20",
    start = "0",
  } = req.query;

  // Build Vinmonopolet API query
  const params = new URLSearchParams({
    maxResults,
    start,
  });

  if (search) params.set("productShortNameContains", search);

  const url = `https://apis.vinmonopolet.no/products/v0/details-normal?${params}`;

  try {
    const response = await fetch(url, {
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Vinmonopolet API error: ${response.status}` });
    }

    const data = await response.json();

    // Map and filter the response
    let wines = data.map(p => ({
      id: p.basic?.productId || p.productId,
      name: p.basic?.productShortName || p.productShortName || "",
      fullName: p.basic?.productLongName || "",
      type: p.classification?.subProductTypeName || "",
      mainCategory: p.classification?.mainProductTypeName || "",
      country: p.origins?.origin?.country || "",
      region: p.origins?.origin?.region || "",
      subRegion: p.origins?.origin?.subRegion || "",
      year: p.basic?.vintage || null,
      alcohol: p.basic?.alcoholContent || null,
      volume: p.basic?.volume || null,
      price: p.prices?.[0]?.salesPrice || null,
      grapes: p.ingredients?.grapes?.map(g => g.grapeDesc).join(", ") || "",
      taste: p.taste?.bitterness ? {
        bitterness: p.taste.bitterness,
        sweetness: p.taste.sweetness,
        freshness: p.taste.freshness,
        tannins: p.taste.tannins,
        fullness: p.taste.fullness,
      } : null,
      color: p.taste?.colour || "",
      aromaCategories: p.taste?.aromaCategories?.map(a => a.aroma) || [],
      imageUrl: `https://bilder.vinmonopolet.no/cache/300x300-0/${p.basic?.productId || p.productId}-1.jpg`,
      imageUrlLarge: `https://bilder.vinmonopolet.no/cache/515x515-0/${p.basic?.productId || p.productId}-1.jpg`,
      url: `https://www.vinmonopolet.no/p/${p.basic?.productId || p.productId}`,
      isEco: p.logistics?.isEco || false,
      isVegan: p.logistics?.isVegan || false,
      isBiodynamic: p.logistics?.isBiodynamic || false,
    }));

    // Filter by category if provided
    if (category) {
      wines = wines.filter(w =>
        w.mainCategory?.toLowerCase().includes(category.toLowerCase()) ||
        w.type?.toLowerCase().includes(category.toLowerCase())
      );
    }

    // Filter by country if provided
    if (country) {
      wines = wines.filter(w =>
        w.country?.toLowerCase().includes(country.toLowerCase())
      );
    }

    return res.status(200).json({ wines, total: wines.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
