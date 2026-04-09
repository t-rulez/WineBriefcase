import { neon } from "@neondatabase/serverless";

const SEARCHES = [
  // ── RØDVIN ITALIA ──────────────────────────────────────────────────────────
  "barolo","barbaresco","amarone","brunello","chianti",
  "ripasso","primitivo","nero d'avola","montepulciano","sagrantino",
  "valpolicella","barbera","dolcetto","nebbiolo","sangiovese",
  "tignanello","sassicaia","ornellaia","super tuscan",
  // ── RØDVIN FRANKRIKE ───────────────────────────────────────────────────────
  "bordeaux","pomerol","saint-emilion","pauillac","margaux",
  "saint-julien","gevrey","pommard","volnay","nuits-saint-georges",
  "chambolle","vosne","beaune","chateauneuf","hermitage",
  "crozes-hermitage","saint-joseph","cornas","gigondas","vacqueyras",
  "côtes du rhône","languedoc","corbières","minervois","bandol",
  "fleurie","morgon","moulin-a-vent","brouilly","beaujolais",
  // ── RØDVIN SPANIA ──────────────────────────────────────────────────────────
  "rioja","ribera del duero","priorat","bierzo","toro",
  "jumilla","montsant","navarra","tempranillo","garnacha",
  "monastrell","mencía","vega sicilia","alvaro palacios",
  // ── RØDVIN SØRAMERIKA ──────────────────────────────────────────────────────
  "malbec","carmenere","zuccardi","catena","almaviva",
  "clos de los siete","achaval ferrer","cono sur red",
  // ── RØDVIN USA / AUSTRALIA / NZ / SØR-AFRIKA ───────────────────────────────
  "napa cabernet","sonoma pinot","oregon pinot","barossa shiraz",
  "mclaren vale","margaret river","marlborough pinot",
  "pinotage","kanonkop","penfolds",
  // ── RØDVIN PORTUGAL / ØSTERRIKE / HELLAS ───────────────────────────────────
  "douro","dao","alentejo","quinta do crasto",
  "blaufrankisch","zweigelt","agiorgitiko","xinomavro",
  // ── HVITVIN FRANKRIKE ──────────────────────────────────────────────────────
  "chablis","meursault","puligny","chassagne","pouilly-fuisse",
  "sancerre","pouilly-fume","muscadet","vouvray","condrieu",
  "alsace riesling","alsace gewurztraminer","alsace pinot gris",
  "macon","saint-veran","rully",
  // ── HVITVIN ITALIA ─────────────────────────────────────────────────────────
  "soave","gavi","vermentino","greco di tufo","fiano",
  "pinot grigio","lugana","verdicchio","falanghina","arneis",
  "moscato","friulano","ribolla",
  // ── HVITVIN SPANIA / PORTUGAL ──────────────────────────────────────────────
  "albarino","verdejo","godello","txakoli","vinho verde",
  // ── HVITVIN TYSKLAND / ØSTERRIKE ───────────────────────────────────────────
  "mosel riesling","rheingau riesling","pfalz riesling",
  "spätlese","auslese","grüner veltliner","wachau",
  // ── HVITVIN NY VERDEN ──────────────────────────────────────────────────────
  "chardonnay california","cloudy bay","sauvignon blanc marlborough",
  "kim crawford","greywacke","riesling australia",
  // ── CHAMPAGNE OG MUSSERENDE ────────────────────────────────────────────────
  "champagne","krug","bollinger","veuve clicquot",
  "taittinger","billecart","pol roger","louis roederer",
  "dom perignon","blanc de blancs","rosé champagne",
  "prosecco","cava","cremant","franciacorta",
  // ── ROSÉVIN ────────────────────────────────────────────────────────────────
  "provence rosé","tavel","bandol rosé","côtes de provence",
  // ── DESSERTVIN OG STERKVIN ─────────────────────────────────────────────────
  "sauternes","tokaji","vintage port","graham port","taylor port",
  "sherry","madeira","muscat beaumes","banyuls",
];

// Hent produktside fra vinmonopolet.no og parse ut all data
async function scrapeVmpProduct(productId) {
  try {
    const r = await fetch(`https://www.vinmonopolet.no/p/${productId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "nb-NO,nb;q=0.9",
      }
    });
    if (!r.ok) return null;
    const html = await r.text();

    // Finn JSON-data i <script type="application/json"> taggen som inneholder produktdata
    const scriptRegex = /<script type="application\/json">([\s\S]*?)<\/script>/g;
    let m;
    while ((m = scriptRegex.exec(html)) !== null) {
      try {
        const json = JSON.parse(m[1]);
        if (json?.product?.code) return json.product;
      } catch {}
    }
    return null;
  } catch { return null; }
}

function parseProduct(p) {
  if (!p) return null;

  // Pris
  const price = p.price?.value ? Math.round(p.price.value) : null;

  // Volum i liter (API gir centiliter)
  const volume = p.volume?.value ? p.volume.value / 100 : 0.75;

  // Alkohol fra traits
  const alcoholTrait = (p.content?.traits || []).find(t => t.name === "Alkohol");
  const alcohol = alcoholTrait
    ? parseFloat(alcoholTrait.formattedValue.replace("%", "").replace(",", "."))
    : null;

  // Druer fra ingredients
  const grapes = (p.content?.ingredients || [])
    .map(i => i.formattedValue)
    .join(", ");

  // Smaksprofil fra characteristics
  const chars = p.content?.characteristics || [];
  const getChar = (name) => {
    const c = chars.find(c => c.name === name);
    return c ? parseInt(c.value) : null;
  };
  const taste_fullness   = getChar("Fylde");
  const taste_freshness  = getChar("Friskhet");
  const taste_tannins    = getChar("Garvestoffer");

  // Stil-kode for sødme og bitterhet (ikke alltid tilgjengelig)
  const sugarTrait = (p.content?.traits || []).find(t => t.name === "Sukker");
  const sugarVal = sugarTrait
    ? parseFloat(sugarTrait.formattedValue.replace("g/l", "").replace(",", ".").trim())
    : null;
  // Beregn sødme fra sukkermengde (0-3g/l = tørr=1-2, 3-12=halvtørr=3-6, 12+=søt=7+)
  const taste_sweetness = sugarVal !== null
    ? sugarVal < 3 ? 1 : sugarVal < 6 ? 3 : sugarVal < 12 ? 5 : sugarVal < 45 ? 8 : 12
    : null;

  // Beskrivelse: kombiner smell og taste
  const description_no = [p.smell, p.taste].filter(Boolean).join(" ") || "";

  // Aromaer fra style-beskrivelse og smell
  const aromaSource = [p.content?.style?.name, p.smell].filter(Boolean).join(" ");
  const aromaWords = aromaSource.match(/\b(kirsebær|bjørnebær|bringebær|plomme|fiken|sjokolade|vanilje|lakriss|pepper|krydder|rosin|blomst|eple|sitrus|fersken|aprikos|nøtt|kaffe|tobakk|lær|jord|mineralsk|urter|viol|roser|brioche|smør|honning|hasselnøtt)\b/gi) || [];
  const aromas = [...new Set(aromaWords.map(a => a.toLowerCase()))].slice(0, 5);

  return {
    price,
    volume,
    alcohol,
    grapes,
    taste_fullness,
    taste_freshness,
    taste_tannins,
    taste_sweetness,
    description_no,
    aromas,
    color:      p.color || "",
    country:    p.main_country?.name || "",
    region:     p.district?.name || "",
    sub_region: p.sub_District?.name || "",
    producer:   p.main_producer?.name || "",
    type:       p.main_category?.name || "",
    year:       p.year ? parseInt(p.year) : null,
    flavor_profile: p.content?.style?.name || "",
  };
}

async function getVmpProducts(apiKey, searchTerm) {
  const headers = { "Ocp-Apim-Subscription-Key": apiKey, "Accept": "application/json" };
  const term = searchTerm.substring(0, 50);
  const PAGE = 50;
  let all = [];
  let start = 0;

  while (true) {
    const params = new URLSearchParams({
      maxResults: String(PAGE),
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
    if (data.length < PAGE) break; // siste side
    start += PAGE;
  }
  return all;
}

export default async function handler(req, res) {
  const vmpKey = process.env.VINMONOPOLET_API_KEY;
  if (!vmpKey) return res.status(500).json({ error: "Mangler VINMONOPOLET_API_KEY" });

  const sql = neon(process.env.DATABASE_URL);
  const mode = req.query.mode || "build"; // "build" | "update"

  // ── OPPDATER-MODUS: finn nye produkter ikke i databasen ───────────────────
  if (mode === "update") {
    const batchIndex  = parseInt(req.query.batch || "0");
    const searches    = SEARCHES.slice(batchIndex, batchIndex + 1);
    const totalBatches = SEARCHES.length;

    if (batchIndex >= totalBatches) {
      const newCount = await sql`SELECT COUNT(*) as c FROM vb_queue WHERE scraped = false`;
      const wineCount = await sql`SELECT COUNT(*) as c FROM vb_wines`;
      return res.status(200).json({
        done: true,
        newInQueue: Number(newCount[0].c),
        totalWines: Number(wineCount[0].c),
        message: "Ferdig med å søke etter nye viner!",
      });
    }

    // Opprett tabeller om de ikke finnes
    await sql`CREATE TABLE IF NOT EXISTS vb_wines (
      id SERIAL PRIMARY KEY, product_id TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      producer TEXT DEFAULT '', country TEXT DEFAULT '', region TEXT DEFAULT '',
      sub_region TEXT DEFAULT '', year INTEGER, type TEXT DEFAULT '',
      grapes TEXT DEFAULT '', alcohol REAL, volume REAL DEFAULT 0.75,
      price INTEGER, color TEXT DEFAULT '', flavor_profile TEXT DEFAULT '',
      taste_fullness INTEGER, taste_sweetness INTEGER, taste_freshness INTEGER,
      taste_tannins INTEGER, taste_bitterness INTEGER, aromas TEXT DEFAULT '[]',
      description_no TEXT DEFAULT '', status TEXT DEFAULT 'aktiv'
    )`;
    await sql`CREATE TABLE IF NOT EXISTS vb_queue (
      product_id TEXT PRIMARY KEY, name TEXT NOT NULL,
      scraped BOOLEAN DEFAULT false, queued_at TIMESTAMP DEFAULT NOW()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS vb_build_log (
      id SERIAL PRIMARY KEY, batch_index INTEGER NOT NULL,
      search_term TEXT NOT NULL, found INTEGER DEFAULT 0,
      inserted INTEGER DEFAULT 0, completed_at TIMESTAMP DEFAULT NOW()
    )`;

    const term = searches[0];
    const vmpProducts = await getVmpProducts(vmpKey, term);
    let newCount = 0;

    for (const p of vmpProducts) {
      const pid  = p.basic?.productId;
      const name = p.basic?.productShortName;
      if (!pid || !name) continue;

      // Kun legg til i kø hvis produktet IKKE allerede finnes i vb_wines
      const existing = await sql`SELECT 1 FROM vb_wines WHERE product_id = ${pid} LIMIT 1`;
      if (existing.length === 0) {
        await sql`INSERT INTO vb_queue (product_id, name, scraped)
          VALUES (${pid}, ${name}, false)
          ON CONFLICT (product_id) DO UPDATE SET scraped = false
          WHERE vb_queue.scraped = true`; // re-kø kun hvis tidligere feilet
        newCount++;
      }
    }

    const queueCount = await sql`SELECT COUNT(*) as c FROM vb_queue WHERE scraped = false`;
    const nextBatch  = batchIndex + 1;
    const hasMore    = nextBatch < totalBatches;

    return res.status(200).json({
      mode: "update",
      batch: `${batchIndex + 1}/${totalBatches}`,
      term,
      found: vmpProducts.length,
      new: newCount,
      totalPending: Number(queueCount[0].c),
      hasMore,
      nextUrl: hasMore ? `/api/build-db?mode=update&batch=${nextBatch}` : null,
    });
  }

  // ── BYGG-MODUS (original) ─────────────────────────────────────────────────
  const batchIndex  = parseInt(req.query.batch || "0");
  const searches    = SEARCHES.slice(batchIndex, batchIndex + 1);
  const totalBatches = SEARCHES.length;

  if (batchIndex >= totalBatches) {
    const count = await sql`SELECT COUNT(*) as c FROM vb_wines`;
    return res.status(200).json({ done: true, totalWines: Number(count[0].c) });
  }

  // Opprett tabeller
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
      taste_fullness INTEGER,
      taste_sweetness INTEGER,
      taste_freshness INTEGER,
      taste_tannins INTEGER,
      taste_bitterness INTEGER,
      aromas TEXT DEFAULT '[]',
      description_no TEXT DEFAULT '',
      status TEXT DEFAULT 'aktiv'
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vb_build_log (
      id SERIAL PRIMARY KEY,
      batch_index INTEGER NOT NULL,
      search_term TEXT NOT NULL,
      found INTEGER DEFAULT 0,
      inserted INTEGER DEFAULT 0,
      completed_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Kø-tabell: alle varenumre som skal scrapes
  await sql`
    CREATE TABLE IF NOT EXISTS vb_queue (
      product_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      scraped BOOLEAN DEFAULT false,
      queued_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Sjekk om allerede gjort
  const done = await sql`SELECT COUNT(*) as c FROM vb_build_log WHERE batch_index = ${batchIndex}`;
  if (Number(done[0].c) > 0) {
    const count = await sql`SELECT COUNT(*) as c FROM vb_wines`;
    return res.status(200).json({
      batch: `${batchIndex + 1}/${totalBatches}`,
      searches,
      inserted: 0,
      totalInDb: Number(count[0].c),
      hasMore: batchIndex + 1 < totalBatches,
      nextUrl: `/api/build-db?batch=${batchIndex + 1}`,
      alreadyDone: true,
      details: [{ term: searches[0], status: "allerede kjørt" }],
    });
  }

  let inserted = 0;
  const details = [];

  for (const term of searches) {
    // Steg 1: Finn varenumre via åpent API
    const vmpProducts = await getVmpProducts(vmpKey, term);
    if (vmpProducts.length === 0) {
      details.push({ term, found: 0 });
      continue;
    }

    const wineIds = vmpProducts
      .map(p => ({ id: p.basic?.productId, name: p.basic?.productShortName }))
      .filter(w => w.id && w.name);

    // Steg 2: Lagre alle IDs i kø-tabell
    for (const w of wineIds) {
      try {
        await sql`
          INSERT INTO vb_queue (product_id, name)
          VALUES (${w.id}, ${w.name})
          ON CONFLICT (product_id) DO NOTHING
        `;
      } catch {}
    }

    details.push({ term, found: wineIds.length, queued: wineIds.length });
    inserted = wineIds.length;

    // Commit checkpoint
    await sql`
      INSERT INTO vb_build_log (batch_index, search_term, found, inserted)
      VALUES (${batchIndex}, ${term}, ${wineIds.length}, ${inserted})
    `;
  }

  const count = await sql`SELECT COUNT(*) as c FROM vb_wines`;
  const nextBatch = batchIndex + 1;
  const hasMore   = nextBatch < totalBatches;

  return res.status(200).json({
    batch: `${batchIndex + 1}/${totalBatches}`,
    searches,
    inserted,
    totalInDb: Number(count[0].c),
    hasMore,
    nextUrl: hasMore ? `/api/build-db?batch=${nextBatch}` : null,
    details,
  });
}
