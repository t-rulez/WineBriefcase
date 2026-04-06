// Proxy mot Vinmonopolets åpne API
// Søker etter produkter og henter detaljer for hvert resultat

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const apiKey = process.env.VINMONOPOLET_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const { search = "", category = "", country = "", page = "0" } = req.query;
  const pageNum  = parseInt(page) || 0;
  const pageSize = 24;

  const headers = {
    "Ocp-Apim-Subscription-Key": apiKey,
    "Accept": "application/json",
  };

  try {
    // Steg 1: Søk etter produkter — returnerer ID og navn
    const searchTerm = search || category || "vin";
    const params = new URLSearchParams({
      maxResults: "50",
      start: String(pageNum * pageSize),
      productShortNameContains: searchTerm,
    });

    const searchRes = await fetch(
      `https://apis.vinmonopolet.no/products/v0/details-normal?${params}`,
      { headers }
    );

    if (!searchRes.ok) {
      return res.status(searchRes.status).json({ error: `API-feil: ${searchRes.status}` });
    }

    const searchData = await searchRes.json();
    if (!Array.isArray(searchData) || searchData.length === 0) {
      return res.status(200).json({ wines: [], total: 0, page: pageNum });
    }

    // Steg 2: Hent detaljer for hvert produkt via productId-oppslag
    // Batch opp til 20 IDer per kall
    const ids = searchData.map(p => p.basic?.productId).filter(Boolean).slice(0, pageSize);

    // Fetch details in batches of 10
    const detailMap = {};
    const batchSize = 10;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const batchPromises = batch.map(id =>
        fetch(`https://apis.vinmonopolet.no/products/v0/details-normal?productId=${id}`, { headers })
          .then(r => r.ok ? r.json() : [])
          .then(d => Array.isArray(d) && d[0] ? detailMap[id] = d[0] : null)
          .catch(() => null)
      );
      await Promise.all(batchPromises);
    }

    // Steg 3: Map til vår format
    let wines = ids.map(id => {
      const p = detailMap[id];
      if (!p) {
        // Fallback: bruk bare navn fra søkeresultat
        const basic = searchData.find(s => s.basic?.productId === id);
        return {
          id, product_id: id,
          name: basic?.basic?.productShortName || "",
          producer: "", country: "", region: "", subRegion: "",
          year: null, type: "", mainCategory: "", grapes: "",
          alcohol: null, volume: null, price: null, color: "",
          taste: null, aromaCategories: [], description_no: "",
          imageUrl: `https://bilder.vinmonopolet.no/cache/300x300-0/${id}-1.jpg`,
          imageUrlLarge: `https://bilder.vinmonopolet.no/cache/515x515-0/${id}-1.jpg`,
          url: `https://www.vinmonopolet.no/p/${id}`,
          isEco: false, isVegan: false,
        };
      }
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
    });

    // Filter etter kategori og land
    if (category) {
      const q = category.toLowerCase();
      wines = wines.filter(w =>
        w.mainCategory.toLowerCase().includes(q) ||
        w.type.toLowerCase().includes(q)
      );
    }
    if (country) {
      const q = country.toLowerCase();
      wines = wines.filter(w => w.country.toLowerCase().includes(q));
    }

    return res.status(200).json({ wines, total: wines.length, page: pageNum });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
