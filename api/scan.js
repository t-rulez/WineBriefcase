import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { image, mediaType } = req.body;
  if (!image) return res.status(400).json({ error: "No image provided" });

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!claudeKey) return res.status(500).json({ error: "Claude API key not configured" });

  // Canvas always outputs JPEG — always use image/jpeg
  const base64Data = image.replace(/^data:image\/[^;]+;base64,/, "").trim();

  const sizeKB = Math.round(base64Data.length * 0.75 / 1024);

  // Validate base64 looks sane
  if (base64Data.length < 100) {
    return res.status(400).json({ error: "Image too small or invalid", sizeKB, first50: base64Data.substring(0, 50) });
  }

  try {
    const claudeBody = {
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
              data: base64Data,
            },
          },
          {
            type: "text",
            text: `Wine label. Reply ONLY with JSON: {"name":"...","producer":"...","country":"...","region":"...","year":null,"type":"Rødvin","grapes":"...","confidence":"high"}`,
          }
        ]
      }]
    };

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(claudeBody),
    });

    const responseText = await claudeRes.text();

    if (!claudeRes.ok) {
      return res.status(500).json({
        error: `Claude feil: ${claudeRes.status}`,
        claudeResponse: responseText.substring(0, 500),
        sizeKB,
        base64Start: base64Data.substring(0, 30),
        base64End: base64Data.substring(base64Data.length - 10),
      });
    }

    const claudeData = JSON.parse(responseText);
    const rawText = claudeData.content?.[0]?.text || "";

    let wineInfo = {};
    try {
      const m = rawText.match(/\{[\s\S]*\}/);
      if (m) wineInfo = JSON.parse(m[0]);
    } catch {
      wineInfo = { name: rawText.substring(0, 80), confidence: "low" };
    }

    const sql = neon(process.env.DATABASE_URL);
    let wines = [];
    const seen = new Set();
    const addRows = (rows) => {
      for (const w of rows) {
        if (!seen.has(w.id)) { seen.add(w.id); wines.push(w); }
      }
    };

    if (wineInfo.producer) {
      const q = `%${wineInfo.producer.substring(0, 40)}%`;
      addRows(await sql`SELECT * FROM vb_wines WHERE producer ILIKE ${q} ORDER BY rating DESC LIMIT 6`);
    }
    if (wineInfo.name && wines.length < 5) {
      const q = `%${wineInfo.name.substring(0, 40)}%`;
      addRows(await sql`SELECT * FROM vb_wines WHERE name ILIKE ${q} ORDER BY rating DESC LIMIT 5`);
    }
    if (wineInfo.region && wines.length < 3) {
      const q = `%${wineInfo.region.substring(0, 30)}%`;
      addRows(await sql`SELECT * FROM vb_wines WHERE region ILIKE ${q} OR sub_region ILIKE ${q} ORDER BY rating DESC LIMIT 4`);
    }
    if (wines.length === 0 && wineInfo.country) {
      const q = `%${wineInfo.country}%`;
      addRows(await sql`SELECT * FROM vb_wines WHERE country ILIKE ${q} ORDER BY rating DESC LIMIT 5`);
    }

    const mapped = wines.slice(0, 6).map(w => ({
      id: w.id, product_id: w.product_id, name: w.name, producer: w.producer,
      country: w.country, region: w.region, subRegion: w.sub_region,
      year: w.year, type: w.type, mainCategory: w.type, grapes: w.grapes,
      alcohol: w.alcohol, volume: w.volume, price: w.price, rating: w.rating,
      color: w.color, flavor_profile: w.flavor_profile,
      taste: { fullness: w.taste_fullness, sweetness: w.taste_sweetness,
               freshness: w.taste_freshness, tannins: w.taste_tannins, bitterness: w.taste_bitterness },
      aromaCategories: typeof w.aromas === "string" ? JSON.parse(w.aromas) : (w.aromas || []),
      description_no: w.description_no, description_en: w.description_en,
      imageUrl: `https://bilder.vinmonopolet.no/cache/300x300-0/${w.product_id}-1.jpg`,
      imageUrlLarge: `https://bilder.vinmonopolet.no/cache/515x515-0/${w.product_id}-1.jpg`,
      url: `https://www.vinmonopolet.no/p/${w.product_id}`,
      isEco: w.is_eco || false, isVegan: w.is_vegan || false,
    }));

    return res.status(200).json({ identified: mapped.length > 0, wineInfo, wines: mapped, sizeKB });

  } catch (err) {
    return res.status(500).json({ error: err.message, sizeKB });
  }
}
