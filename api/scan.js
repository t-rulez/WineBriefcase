import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { image } = req.body;
  if (!image) return res.status(400).json({ error: "No image provided" });

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!claudeKey) return res.status(500).json({ error: "Claude API key not configured" });

  // Strip base64 header and get just the data
  const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

  // Detect media type
  const mediaType = image.startsWith("data:image/png") ? "image/png"
    : image.startsWith("data:image/webp") ? "image/webp"
    : "image/jpeg";

  try {
    // Step 1: Claude identifies the wine
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64Data },
            },
            {
              type: "text",
              text: `This is a wine bottle label. Extract wine information and respond ONLY with valid JSON, nothing else before or after:
{
  "name": "wine name as on label",
  "producer": "producer or winery name",
  "country": "country in Norwegian (Frankrike, Italia, Spania, USA, Australia, etc)",
  "region": "wine region",
  "year": 2019,
  "type": "Rødvin",
  "grapes": "grape varieties",
  "confidence": "high"
}
For type use exactly one of: Rødvin, Hvitvin, Rosévin, Musserende vin, Champagne, Sterkvin, Dessertvin
If year not visible use null. Confidence: high/medium/low.`,
            }
          ]
        }]
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      return res.status(500).json({ error: `Claude API error: ${claudeRes.status}`, detail: errText });
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text || "";

    let wineInfo = {};
    try {
      const m = rawText.match(/\{[\s\S]*\}/);
      if (m) wineInfo = JSON.parse(m[0]);
    } catch {
      wineInfo = { name: rawText.substring(0, 100), confidence: "low" };
    }

    // Step 2: Search our database with multiple strategies
    const sql = neon(process.env.DATABASE_URL);
    let wines = [];
    const seen = new Set();

    const addResults = (rows) => {
      for (const w of rows) {
        if (!seen.has(w.id)) { seen.add(w.id); wines.push(w); }
      }
    };

    // Search by producer name (most reliable)
    if (wineInfo.producer) {
      const q = `%${wineInfo.producer.substring(0, 40)}%`;
      const rows = await sql`SELECT * FROM vb_wines WHERE producer ILIKE ${q} ORDER BY rating DESC LIMIT 8`;
      addResults(rows);
    }

    // Search by wine name
    if (wineInfo.name && wines.length < 6) {
      const q = `%${wineInfo.name.substring(0, 40)}%`;
      const rows = await sql`SELECT * FROM vb_wines WHERE name ILIKE ${q} ORDER BY rating DESC LIMIT 6`;
      addResults(rows);
    }

    // Search by region
    if (wineInfo.region && wines.length < 4) {
      const q = `%${wineInfo.region.substring(0, 30)}%`;
      const rows = await sql`SELECT * FROM vb_wines WHERE region ILIKE ${q} OR sub_region ILIKE ${q} ORDER BY rating DESC LIMIT 4`;
      addResults(rows);
    }

    // Fallback: search by country + type
    if (wines.length === 0 && wineInfo.country) {
      const q = `%${wineInfo.country}%`;
      const rows = await sql`SELECT * FROM vb_wines WHERE country ILIKE ${q} ORDER BY rating DESC LIMIT 6`;
      addResults(rows);
    }

    const mapped = wines.slice(0, 8).map(w => ({
      id: w.id,
      product_id: w.product_id,
      name: w.name,
      producer: w.producer,
      country: w.country,
      region: w.region,
      subRegion: w.sub_region,
      year: w.year,
      type: w.type,
      mainCategory: w.type,
      grapes: w.grapes,
      alcohol: w.alcohol,
      volume: w.volume,
      price: w.price,
      rating: w.rating,
      color: w.color,
      flavor_profile: w.flavor_profile,
      taste: {
        fullness: w.taste_fullness, sweetness: w.taste_sweetness,
        freshness: w.taste_freshness, tannins: w.taste_tannins, bitterness: w.taste_bitterness,
      },
      aromaCategories: typeof w.aromas === "string" ? JSON.parse(w.aromas) : (w.aromas || []),
      description_no: w.description_no,
      description_en: w.description_en,
      imageUrl:      `https://bilder.vinmonopolet.no/cache/300x300-0/${w.product_id}-1.jpg`,
      imageUrlLarge: `https://bilder.vinmonopolet.no/cache/515x515-0/${w.product_id}-1.jpg`,
      url:           `https://www.vinmonopolet.no/p/${w.product_id}`,
      isEco: w.is_eco || false,
      isVegan: w.is_vegan || false,
    }));

    return res.status(200).json({
      identified: mapped.length > 0,
      wineInfo,
      wines: mapped,
      debug: { rawClaudeText: rawText.substring(0, 200) },
    });

  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.substring(0, 300) });
  }
}
