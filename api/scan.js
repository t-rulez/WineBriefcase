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

  try {
    // Step 1: Claude identifies the wine from the label
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: image.replace(/^data:image\/\w+;base64,/, ""),
              },
            },
            {
              type: "text",
              text: `Look at this wine label. Respond ONLY with a JSON object, no other text:
{
  "name": "full wine name",
  "producer": "producer/winery name",
  "country": "country in Norwegian (e.g. Frankrike, Italia, Spania)",
  "region": "wine region",
  "year": year as number or null,
  "type": "Rødvin or Hvitvin or Rosévin or Musserende vin",
  "grapes": "grape varieties if visible",
  "searchTerms": ["3-4 short search terms to find this wine in a database"],
  "confidence": "high/medium/low"
}`
            }
          ]
        }]
      }),
    });

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text || "{}";
    let wineInfo;
    try {
      const m = rawText.match(/\{[\s\S]*\}/);
      wineInfo = JSON.parse(m?.[0] || "{}");
    } catch {
      wineInfo = { confidence: "low" };
    }

    // Step 2: Search our database
    const sql = neon(process.env.DATABASE_URL);
    let wines = [];

    const searchTerms = [
      wineInfo.name,
      wineInfo.producer,
      ...(wineInfo.searchTerms || []),
    ].filter(Boolean);

    for (const term of searchTerms) {
      if (wines.length >= 5) break;
      const q = `%${term.substring(0, 50)}%`;
      const rows = await sql`
        SELECT * FROM vb_wines
        WHERE name ILIKE ${q} OR producer ILIKE ${q} OR grapes ILIKE ${q} OR region ILIKE ${q}
        ORDER BY rating DESC LIMIT 5`;
      wines = [...wines, ...rows];
    }

    // Deduplicate
    const seen = new Set();
    wines = wines.filter(w => {
      if (seen.has(w.id)) return false;
      seen.add(w.id);
      return true;
    }).slice(0, 6).map(w => ({
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
      taste: { fullness: w.taste_fullness, sweetness: w.taste_sweetness, freshness: w.taste_freshness, tannins: w.taste_tannins, bitterness: w.taste_bitterness },
      aromaCategories: typeof w.aromas === "string" ? JSON.parse(w.aromas) : (w.aromas || []),
      description_no: w.description_no,
      description_en: w.description_en,
      imageUrl:      `https://bilder.vinmonopolet.no/cache/300x300-0/${w.product_id}-1.jpg`,
      imageUrlLarge: `https://bilder.vinmonopolet.no/cache/515x515-0/${w.product_id}-1.jpg`,
      url:           `https://www.vinmonopolet.no/p/${w.product_id}`,
      isEco: w.is_eco || false, isVegan: w.is_vegan || false,
    }));

    return res.status(200).json({
      identified: wines.length > 0,
      wineInfo,
      wines,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
