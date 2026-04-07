import { neon } from "@neondatabase/serverless";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function mapWine(w) {
  return {
    id: w.id, product_id: w.product_id, name: w.name, producer: w.producer,
    country: w.country, region: w.region, subRegion: w.sub_region,
    year: w.year, type: w.type, mainCategory: w.type, grapes: w.grapes,
    alcohol: w.alcohol, volume: w.volume, price: w.price,
    color: w.color, flavor_profile: w.flavor_profile, status: w.status || "aktiv",
    taste: { fullness: w.taste_fullness, sweetness: w.taste_sweetness,
             freshness: w.taste_freshness, tannins: w.taste_tannins, bitterness: w.taste_bitterness },
    aromaCategories: typeof w.aromas === "string" ? JSON.parse(w.aromas) : (w.aromas || []),
    description_no: w.description_no,
    imageUrl: `https://bilder.vinmonopolet.no/cache/300x300-0/${w.product_id}-1.jpg`,
    imageUrlLarge: `https://bilder.vinmonopolet.no/cache/515x515-0/${w.product_id}-1.jpg`,
    url: `https://www.vinmonopolet.no/p/${w.product_id}`,
  };
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  // ── GET: strekkode-oppslag ──────────────────────────────────────────────────
  if (req.method === "GET") {
    const { barcode } = req.query;
    if (!barcode) return res.status(400).json({ error: "barcode påkrevd" });

    const apiKey = process.env.VINMONOPOLET_API_KEY;

    try {
      // Slå opp strekkode mot Vinmonopolets åpne API
      const vmpRes = await fetch(
        `https://apis.vinmonopolet.no/products/v0/details-normal?barcode=${encodeURIComponent(barcode)}`,
        { headers: { "Ocp-Apim-Subscription-Key": apiKey, "Accept": "application/json" } }
      );

      let productId = null;
      let wineInfo  = { name: "", producer: "" };

      if (vmpRes.ok) {
        const vmpData = await vmpRes.json();
        if (Array.isArray(vmpData) && vmpData[0]?.basic) {
          productId = vmpData[0].basic.productId;
          wineInfo  = { name: vmpData[0].basic.productShortName, producer: "" };
        }
      }

      // Søk i vår DB — først på product_id fra VMP, ellers på navn
      let wines = [];
      if (productId) {
        const rows = await sql`SELECT * FROM vb_wines WHERE product_id = ${productId} LIMIT 1`;
        wines = rows.map(mapWine);
      }

      // Hvis ikke funnet i DB, prøv navn-søk
      if (wines.length === 0 && wineInfo.name) {
        const q = `%${wineInfo.name.substring(0, 40)}%`;
        const rows = await sql`SELECT * FROM vb_wines WHERE name ILIKE ${q} ORDER BY name LIMIT 5`;
        wines = rows.map(mapWine);
      }

      return res.status(200).json({ wines, wineInfo, barcode, found: wines.length > 0 });

    } catch(err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST: etikett-skanning med Claude ──────────────────────────────────────
  if (req.method !== "POST") return res.status(405).json({ error: "GET eller POST" });

  const { image, mediaType } = req.body;
  if (!image) return res.status(400).json({ error: "No image provided" });

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!claudeKey) return res.status(500).json({ error: "Claude API key ikke konfigurert" });

  const base64Data = image.replace(/^data:image\/[^;]+;base64,/, "").trim();
  const sizeKB = Math.round(base64Data.length * 0.75 / 1024);
  if (base64Data.length < 100) return res.status(400).json({ error: "Bilde for lite", sizeKB });

  try {
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": claudeKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Data } },
            { type: "text", text: `Wine label. Reply ONLY with JSON: {"name":"...","producer":"...","country":"...","region":"...","year":null,"type":"Rødvin","grapes":"...","confidence":"high"}` }
          ]
        }]
      }),
    });

    const responseText = await claudeRes.text();
    if (!claudeRes.ok) {
      const claudeError = JSON.parse(responseText).error?.message || "";
      const msg = claudeRes.status === 400 && claudeError.includes("credit")
        ? "Ingen credits på Anthropic-kontoen. Gå til console.anthropic.com."
        : claudeRes.status === 401 ? "Ugyldig Claude API-nøkkel."
        : claudeRes.status === 429 ? "For mange forespørsler. Vent litt."
        : `Claude-feil (${claudeRes.status})`;
      return res.status(500).json({ error: msg, sizeKB });
    }

    const claudeData  = JSON.parse(responseText);
    const rawText     = claudeData.content?.[0]?.text || "";
    let wineInfo = {};
    try { const m = rawText.match(/\{[\s\S]*\}/); if (m) wineInfo = JSON.parse(m[0]); }
    catch { wineInfo = { name: rawText.substring(0, 80), confidence: "low" }; }

    // Smart DB-søk i flere runder med stigende bredde
    const seen = new Set();
    let wines = [];
    const add = (rows) => { for (const w of rows) { if (!seen.has(w.id)) { seen.add(w.id); wines.push(mapWine(w)); } } };

    const pq  = wineInfo.producer ? `%${wineInfo.producer.substring(0, 40)}%` : null;
    const nq  = wineInfo.name     ? `%${wineInfo.name.substring(0, 40)}%`     : null;
    const rq  = wineInfo.region   ? `%${wineInfo.region.substring(0, 30)}%`   : null;
    const coq = wineInfo.country  ? `%${wineInfo.country}%`                   : null;
    const yr  = wineInfo.year     ? parseInt(wineInfo.year)                   : null;
    const tq  = wineInfo.type     ? `%${wineInfo.type}%`                      : null;

    // Runde 1: produsent + år + type (mest presis)
    if (pq && yr && tq) {
      add(await sql`SELECT * FROM vb_wines WHERE producer ILIKE ${pq} AND year = ${yr} AND type ILIKE ${tq} ORDER BY name LIMIT 6`);
    }
    // Runde 2: produsent + år
    if (pq && yr && wines.length < 3) {
      add(await sql`SELECT * FROM vb_wines WHERE producer ILIKE ${pq} AND year = ${yr} ORDER BY name LIMIT 6`);
    }
    // Runde 3: produsent + type
    if (pq && tq && wines.length < 3) {
      add(await sql`SELECT * FROM vb_wines WHERE producer ILIKE ${pq} AND type ILIKE ${tq} ORDER BY name LIMIT 6`);
    }
    // Runde 4: produsent alene
    if (pq && wines.length < 5) {
      add(await sql`SELECT * FROM vb_wines WHERE producer ILIKE ${pq} ORDER BY name LIMIT 6`);
    }
    // Runde 5: navn + år
    if (nq && yr && wines.length < 4) {
      add(await sql`SELECT * FROM vb_wines WHERE name ILIKE ${nq} AND year = ${yr} ORDER BY name LIMIT 5`);
    }
    // Runde 6: navn alene
    if (nq && wines.length < 5) {
      add(await sql`SELECT * FROM vb_wines WHERE name ILIKE ${nq} ORDER BY name LIMIT 5`);
    }
    // Runde 7: region + type + år
    if (rq && tq && yr && wines.length < 3) {
      add(await sql`SELECT * FROM vb_wines WHERE (region ILIKE ${rq} OR sub_region ILIKE ${rq}) AND type ILIKE ${tq} AND year = ${yr} ORDER BY name LIMIT 4`);
    }
    // Runde 8: region + type
    if (rq && tq && wines.length < 3) {
      add(await sql`SELECT * FROM vb_wines WHERE (region ILIKE ${rq} OR sub_region ILIKE ${rq}) AND type ILIKE ${tq} ORDER BY name LIMIT 4`);
    }
    // Runde 9: land + type + år (bred fallback)
    if (coq && tq && yr && wines.length === 0) {
      add(await sql`SELECT * FROM vb_wines WHERE country ILIKE ${coq} AND type ILIKE ${tq} AND year = ${yr} ORDER BY name LIMIT 5`);
    }
    // Runde 10: land alene (siste utvei)
    if (coq && wines.length === 0) {
      add(await sql`SELECT * FROM vb_wines WHERE country ILIKE ${coq} ORDER BY name LIMIT 5`);
    }

    // Sorter: treff med riktig år øverst
    if (yr) {
      wines.sort((a, b) => {
        const aMatch = a.year === yr ? 0 : 1;
        const bMatch = b.year === yr ? 0 : 1;
        return aMatch - bMatch;
      });
    }

    return res.status(200).json({ wines: wines.slice(0, 8), wineInfo, sizeKB });

  } catch(err) {
    return res.status(500).json({ error: err.message, sizeKB });
  }
}
