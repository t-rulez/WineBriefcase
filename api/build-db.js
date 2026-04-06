import { neon } from "@neondatabase/serverless";

const SEARCHES = [
  // ── RØDVIN ITALIA ────────────────────────────────────────────────────────
  "barolo","barbaresco","amarone","brunello","chianti",
  "ripasso","primitivo","nero d'avola","montepulciano","sagrantino",
  "valpolicella","barbera","dolcetto","nebbiolo","sangiovese",
  "tignanello","sassicaia","ornellaia","solaia","super tuscan",
  // ── RØDVIN FRANKRIKE ─────────────────────────────────────────────────────
  "bordeaux","pomerol","saint-emilion","pauillac","margaux",
  "saint-julien","gevrey","pommard","volnay","nuits-saint-georges",
  "chambolle","vosne","beaune","chateauneuf","hermitage",
  "crozes-hermitage","saint-joseph","cornas","gigondas","vacqueyras",
  "côtes du rhône","languedoc","corbières","minervois","bandol",
  "fleurie","morgon","moulin-a-vent","brouilly","beaujolais",
  // ── RØDVIN SPANIA ────────────────────────────────────────────────────────
  "rioja","ribera del duero","priorat","bierzo","toro",
  "jumilla","montsant","navarra","tempranillo","garnacha",
  "monastrell","mencía","vega sicilia","alvaro palacios",
  // ── RØDVIN SØRAMERIKA ────────────────────────────────────────────────────
  "malbec","carmenere","zuccardi","catena","almaviva",
  "clos de los siete","achaval ferrer","cono sur red",
  // ── RØDVIN USA / AUSTRALIA / NZ / SØR-AFRIKA ────────────────────────────
  "napa cabernet","sonoma pinot","oregon pinot","barossa shiraz",
  "mclaren vale","margaret river","marlborough pinot",
  "pinotage","kanonkop","penfolds",
  // ── RØDVIN PORTUGAL / ØSTERRIKE / HELLAS ────────────────────────────────
  "douro","dao","alentejo","quinta do crasto",
  "blaufrankisch","zweigelt","agiorgitiko","xinomavro",
  // ── HVITVIN FRANKRIKE ────────────────────────────────────────────────────
  "chablis","meursault","puligny","chassagne","pouilly-fuisse",
  "sancerre","pouilly-fume","muscadet","vouvray","condrieu",
  "alsace riesling","alsace gewurztraminer","alsace pinot gris",
  "macon","saint-veran","rully",
  // ── HVITVIN ITALIA ───────────────────────────────────────────────────────
  "soave","gavi","vermentino","greco di tufo","fiano",
  "pinot grigio","lugana","verdicchio","falanghina","arneis",
  "moscato","friulano","ribolla",
  // ── HVITVIN SPANIA / PORTUGAL ────────────────────────────────────────────
  "albarino","verdejo","godello","txakoli","vinho verde",
  // ── HVITVIN TYSKLAND / ØSTERRIKE ─────────────────────────────────────────
  "mosel riesling","rheingau riesling","pfalz riesling",
  "spätlese","auslese","grüner veltliner","wachau",
  // ── HVITVIN NY VERDEN ────────────────────────────────────────────────────
  "chardonnay california","cloudy bay","sauvignon blanc marlborough",
  "kim crawford","greywacke","riesling australia",
  // ── CHAMPAGNE OG MUSSERENDE ──────────────────────────────────────────────
  "champagne","krug","bollinger","veuve clicquot",
  "taittinger","billecart","pol roger","louis roederer",
  "dom perignon","blanc de blancs","rosé champagne",
  "prosecco","cava","cremant","franciacorta",
  // ── ROSÉVIN ──────────────────────────────────────────────────────────────
  "provence rosé","tavel","bandol rosé","côtes de provence",
  // ── DESSERTVIN OG STERKVIN ───────────────────────────────────────────────
  "sauternes","tokaji","vintage port","graham port","taylor port",
  "sherry","madeira","muscat beaumes","banyuls",
];

async function getVmpProducts(apiKey, searchTerm) {
  const headers = { "Ocp-Apim-Subscription-Key": apiKey, "Accept": "application/json" };
  const term = searchTerm.substring(0, 50);
  let all = [];

  // Fetch up to 3 pages of 50 = 150 products per search term
  for (let start = 0; start < 150; start += 50) {
    const params = new URLSearchParams({
      maxResults: "50",
      start: String(start),
      productShortNameContains: term,
    });
    const res = await fetch(
      `https://apis.vinmonopolet.no/products/v0/details-normal?${params}`,
      { headers }
    );
    if (!res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 50) break; // no more pages
    await new Promise(r => setTimeout(r, 300)); // rate limit
  }
  return all;
}

async function enrichWithClaude(claudeKey, wines) {
  if (wines.length === 0) return [];
  const wineList = wines.map(w => `ID:${w.id} | ${w.name}`).join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 6000,
      messages: [{
        role: "user",
        content: `For each wine below, provide detailed wine data. Respond ONLY with a valid JSON array — no markdown, no explanation.

${wineList}

Return array of objects:
{
  "id": "exact ID from input",
  "producer": "producer name",
  "country": "country in Norwegian",
  "region": "wine region",
  "sub_region": "sub-region or empty string",
  "year": null or year number if visible in name,
  "type": "one of: Rødvin, Hvitvin, Rosévin, Musserende vin, Champagne, Sterkvin, Dessertvin",
  "grapes": "grape varieties",
  "alcohol": alcohol as number (e.g. 13.5),
  "volume": 0.75,
  "price": NOK price estimate as integer,
  "color": "color in Norwegian",
  "flavor_profile": "style in Norwegian (4-6 words)",
  "taste_fullness": 1-12,
  "taste_sweetness": 1-12,
  "taste_freshness": 1-12,
  "taste_tannins": 1-12,
  "taste_bitterness": 1-12,
  "aromas": ["aroma1","aroma2","aroma3","aroma4"],
  "description_no": "2-3 sentences in Norwegian about this wine",
  "is_eco": false,
  "is_vegan": false
}`,
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude ${res.status}: ${err.substring(0, 100)}`);
  }
  const data = await res.json();
  const text = data.content?.[0]?.text || "[]";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try { return JSON.parse(match[0]); } catch { return []; }
}

export default async function handler(req, res) {
  const vmpKey    = process.env.VINMONOPOLET_API_KEY;
  const claudeKey = process.env.ANTHROPIC_API_KEY;

  if (!vmpKey || !claudeKey)
    return res.status(500).json({ error: "Mangler env-variabler" });

  const sql = neon(process.env.DATABASE_URL);
  const batchIndex = parseInt(req.query.batch || "0");
  const batchSize  = 1; // 1 søkterm per kall — unngår Vercel timeout
  const searches   = SEARCHES.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
  const totalBatches = SEARCHES.length; // 1 per batch

  if (searches.length === 0) {
    const count = await sql`SELECT COUNT(*) as c FROM vb_wines`;
    return res.status(200).json({
      done: true,
      totalWines: Number(count[0].c),
      message: "Database er ferdig bygget!",
    });
  }

  // Sjekk om denne batchen allerede er kjørt (crash-recovery)
  try {
    const done = await sql`
      SELECT COUNT(*) as c FROM vb_build_log WHERE batch_index = ${batchIndex}
    `;
    if (Number(done[0].c) > 0) {
      const count = await sql`SELECT COUNT(*) as c FROM vb_wines`;
      const nextBatch = batchIndex + 1;
      const hasMore = nextBatch < SEARCHES.length;
      return res.status(200).json({
        batch: `${batchIndex + 1}/${SEARCHES.length}`,
        searches,
        inserted: 0,
        skipped: 0,
        totalInDb: Number(count[0].c),
        hasMore,
        nextUrl: hasMore ? `/api/build-db?batch=${nextBatch}` : null,
        details: [{ term: searches[0], skipped: "allerede kjørt" }],
        alreadyDone: true,
      });
    }
  } catch { /* tabell finnes ikke ennå, fortsett */ }

  // Opprett tabell
  await sql`
    CREATE TABLE IF NOT EXISTS vb_wines (
      id SERIAL PRIMARY KEY,
      product_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      producer TEXT DEFAULT '',
      country TEXT DEFAULT '',
      region TEXT DEFAULT '',
      sub_region TEXT DEFAULT '',
      year INTEGER,
      type TEXT DEFAULT '',
      grapes TEXT DEFAULT '',
      alcohol REAL,
      volume REAL DEFAULT 0.75,
      price INTEGER,
      color TEXT DEFAULT '',
      flavor_profile TEXT DEFAULT '',
      taste_fullness INTEGER DEFAULT 6,
      taste_sweetness INTEGER DEFAULT 2,
      taste_freshness INTEGER DEFAULT 7,
      taste_tannins INTEGER DEFAULT 5,
      taste_bitterness INTEGER DEFAULT 3,
      aromas TEXT DEFAULT '[]',
      description_no TEXT DEFAULT '',
      is_eco BOOLEAN DEFAULT false,
      is_vegan BOOLEAN DEFAULT false
    )
  `;

  // Checkpoint-tabell for å spore fremgang
  await sql`
    CREATE TABLE IF NOT EXISTS vb_build_log (
      id SERIAL PRIMARY KEY,
      batch_index INTEGER NOT NULL,
      search_term TEXT NOT NULL,
      found INTEGER DEFAULT 0,
      inserted INTEGER DEFAULT 0,
      skipped INTEGER DEFAULT 0,
      completed_at TIMESTAMP DEFAULT NOW()
    )
  `;

  let inserted = 0, skipped = 0;
  const details = [];

  for (const term of searches) {
    const vmpProducts = await getVmpProducts(vmpKey, term);
    if (vmpProducts.length === 0) {
      details.push({ term, found: 0 });
      continue;
    }

    const wineInputs = vmpProducts
      .map(p => ({ id: p.basic?.productId, name: p.basic?.productShortName }))
      .filter(w => w.id && w.name);

    // Chunk into batches of 20 for Claude
    let enriched = [];
    const CHUNK = 20;
    for (let i = 0; i < wineInputs.length; i += CHUNK) {
      const chunk = wineInputs.slice(i, i + CHUNK);
      try {
        const result = await enrichWithClaude(claudeKey, chunk);
        enriched = enriched.concat(result);
        await new Promise(r => setTimeout(r, 500));
      } catch(e) {
        details.push({ term, chunkError: e.message });
      }
    }

    for (const w of enriched) {
      const vmp = wineInputs.find(v => v.id === w.id);
      if (!vmp || !w.id) continue;
      try {
        await sql`
          INSERT INTO vb_wines (
            product_id, name, producer, country, region, sub_region,
            year, type, grapes, alcohol, volume, price, color,
            flavor_profile, taste_fullness, taste_sweetness, taste_freshness,
            taste_tannins, taste_bitterness, aromas, description_no, is_eco, is_vegan
          ) VALUES (
            ${w.id}, ${vmp.name}, ${w.producer||""}, ${w.country||""},
            ${w.region||""}, ${w.sub_region||""}, ${w.year||null},
            ${w.type||"Rødvin"}, ${w.grapes||""}, ${w.alcohol||null},
            ${w.volume||0.75}, ${w.price||null}, ${w.color||""},
            ${w.flavor_profile||""}, ${w.taste_fullness||6},
            ${w.taste_sweetness||2}, ${w.taste_freshness||7},
            ${w.taste_tannins||5}, ${w.taste_bitterness||3},
            ${JSON.stringify(w.aromas||[])}, ${w.description_no||""},
            ${!!w.is_eco}, ${!!w.is_vegan}
          )
          ON CONFLICT (product_id) DO UPDATE SET
            name           = EXCLUDED.name,
            producer       = EXCLUDED.producer,
            country        = EXCLUDED.country,
            region         = EXCLUDED.region,
            type           = EXCLUDED.type,
            price          = EXCLUDED.price,
            grapes         = EXCLUDED.grapes,
            description_no = EXCLUDED.description_no
        `;
        inserted++;
      } catch { skipped++; }
    }

    details.push({ term, found: vmpProducts.length, enriched: enriched.length });

    // Commit checkpoint — lagrer fremgang etter hver søkterm
    await sql`
      INSERT INTO vb_build_log (batch_index, search_term, found, inserted, skipped)
      VALUES (${batchIndex}, ${term}, ${vmpProducts.length}, ${inserted}, ${skipped})
    `;

    await new Promise(r => setTimeout(r, 300));
  }

  const count = await sql`SELECT COUNT(*) as c FROM vb_wines`;
  const nextBatch = batchIndex + 1;
  const hasMore = nextBatch < totalBatches;

  return res.status(200).json({
    batch: `${batchIndex + 1}/${totalBatches}`,
    searches,
    inserted,
    skipped,
    totalInDb: Number(count[0].c),
    hasMore,
    nextUrl: hasMore ? `/api/build-db?batch=${nextBatch}` : null,
    details,
  });
}
