// Scan a wine label image and find matching wine on Vinmonopolet
// Uses Claude claude-sonnet-4-20250514 to identify the wine, then searches Vinmonopolet

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { image } = req.body; // base64 image
  if (!image) return res.status(400).json({ error: "No image provided" });

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  const vinKey = process.env.VINMONOPOLET_API_KEY;

  if (!claudeKey) return res.status(500).json({ error: "Claude API key not configured" });
  if (!vinKey) return res.status(500).json({ error: "Vinmonopolet API key not configured" });

  try {
    // Step 1: Ask Claude to identify the wine from the label
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
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: image.replace(/^data:image\/\w+;base64,/, ""),
              },
            },
            {
              type: "text",
              text: `Look at this wine label and extract the following information. Respond ONLY with a JSON object, no other text:
{
  "wineNameGuess": "the wine name as it would appear on Vinmonopolet (short name, usually producer + product name)",
  "producer": "producer/winery name",
  "productName": "product name",
  "vintage": "year if visible, otherwise null",
  "country": "country of origin in Norwegian if possible",
  "region": "wine region",
  "grapes": "grape varieties if visible",
  "confidence": "high/medium/low"
}

If you cannot identify the wine, set wineNameGuess to the most searchable term from the label.`
            }
          ]
        }]
      }),
    });

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text || "{}";

    let wineInfo;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      wineInfo = JSON.parse(jsonMatch?.[0] || "{}");
    } catch {
      wineInfo = { wineNameGuess: "", confidence: "low" };
    }

    if (!wineInfo.wineNameGuess) {
      return res.status(200).json({
        identified: false,
        wineInfo,
        wines: [],
        message: "Could not identify wine from label",
      });
    }

    // Step 2: Search Vinmonopolet with the identified name
    const searchTerms = [
      wineInfo.wineNameGuess,
      wineInfo.producer,
      wineInfo.productName,
    ].filter(Boolean);

    let wines = [];

    for (const term of searchTerms) {
      if (!term || wines.length > 0) continue;

      const params = new URLSearchParams({
        maxResults: "10",
        start: "0",
        productShortNameContains: term.substring(0, 50),
      });

      const vinRes = await fetch(
        `https://apis.vinmonopolet.no/products/v0/details-normal?${params}`,
        {
          headers: {
            "Ocp-Apim-Subscription-Key": vinKey,
            "Accept": "application/json",
          },
        }
      );

      if (vinRes.ok) {
        const data = await vinRes.json();
        wines = (Array.isArray(data) ? data : []).map(p => ({
          id: p.basic?.productId,
          name: p.basic?.productShortName || "",
          fullName: p.basic?.productLongName || "",
          type: p.classification?.subProductTypeName || "",
          mainCategory: p.classification?.mainProductTypeName || "",
          country: p.origins?.origin?.country || "",
          region: p.origins?.origin?.region || "",
          year: p.basic?.vintage || null,
          alcohol: p.basic?.alcoholContent || null,
          volume: p.basic?.volume || null,
          price: p.prices?.[0]?.salesPrice || null,
          grapes: p.ingredients?.grapes?.map(g => g.grapeDesc).join(", ") || "",
          imageUrl: `https://bilder.vinmonopolet.no/cache/300x300-0/${p.basic?.productId}-1.jpg`,
          imageUrlLarge: `https://bilder.vinmonopolet.no/cache/515x515-0/${p.basic?.productId}-1.jpg`,
          url: `https://www.vinmonopolet.no/p/${p.basic?.productId}`,
          isEco: p.logistics?.isEco || false,
          isVegan: p.logistics?.isVegan || false,
        }));
      }
    }

    return res.status(200).json({
      identified: wines.length > 0,
      wineInfo,
      wines,
      searchedFor: searchTerms[0],
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
