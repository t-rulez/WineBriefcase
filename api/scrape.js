import { neon } from "@neondatabase/serverless";

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

  const price  = p.price?.value ? Math.round(p.price.value) : null;
  const volume = p.volume?.value ? p.volume.value / 100 : 0.75;

  const alcoholTrait = (p.content?.traits || []).find(t => t.name === "Alkohol");
  const alcohol = alcoholTrait
    ? parseFloat(alcoholTrait.formattedValue.replace("%","").replace(",",".").trim())
    : null;

  const grapes = (p.content?.ingredients || []).map(i => i.formattedValue).join(", ");

  const chars = p.content?.characteristics || [];
  const getChar = name => { const c = chars.find(c => c.name === name); return c ? parseInt(c.value) : null; };

  const sugarTrait = (p.content?.traits || []).find(t => t.name === "Sukker");
  const sugarVal   = sugarTrait ? parseFloat(sugarTrait.formattedValue.replace("g/l","").replace(",",".").trim()) : null;
  const taste_sweetness = sugarVal !== null
    ? sugarVal < 3 ? 1 : sugarVal < 6 ? 3 : sugarVal < 12 ? 5 : sugarVal < 45 ? 8 : 12
    : null;

  const description_no = [p.smell, p.taste].filter(Boolean).join(" ") || "";

  const aromaSource = [p.content?.style?.name, p.smell, p.taste].filter(Boolean).join(" ");
  const aromaWords  = aromaSource.match(/\b(kirsebær|bjørnebær|bringebær|plomme|fiken|sjokolade|vanilje|lakriss|pepper|krydder|rosin|blomst|eple|sitrus|fersken|aprikos|nøtt|kaffe|tobakk|lær|jord|mineralsk|urter|viol|roser|brioche|smør|honning|hasselnøtt|laurbær|tørket frukt|mørk frukt)\b/gi) || [];
  const aromas = [...new Set(aromaWords.map(a => a.toLowerCase()))].slice(0, 6);

  return {
    price, volume, alcohol, grapes,
    taste_fullness:  getChar("Fylde"),
    taste_freshness: getChar("Friskhet"),
    taste_tannins:   getChar("Garvestoffer"),
    taste_sweetness,
    description_no,
    aromas,
    color:          p.color || "",
    country:        p.main_country?.name || "",
    region:         p.district?.name || "",
    sub_region:     p.sub_District?.name || "",
    producer:       p.main_producer?.name || "",
    type:           p.main_category?.name || "",
    year:           p.year ? parseInt(p.year) : null,
    flavor_profile: p.content?.style?.name || "",
    status:         p.status || "aktiv",
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const sql = neon(process.env.DATABASE_URL);

  // Hent neste 10 uprosesserte fra køen
  const BATCH = 10;
  const pending = await sql`
    SELECT product_id, name FROM vb_queue
    WHERE scraped = false
    ORDER BY queued_at
    LIMIT ${BATCH}
  `;

  if (pending.length === 0) {
    const total   = await sql`SELECT COUNT(*) as c FROM vb_queue`;
    const scraped = await sql`SELECT COUNT(*) as c FROM vb_queue WHERE scraped = true`;
    const wines   = await sql`SELECT COUNT(*) as c FROM vb_wines`;
    return res.status(200).json({
      done: true,
      totalQueued: Number(total[0].c),
      totalScraped: Number(scraped[0].c),
      totalWines: Number(wines[0].c),
      message: "Alle produkter er scraped!",
    });
  }

  // Scrape parallelt
  const results = await Promise.all(
    pending.map(async w => {
      const product = await scrapeVmpProduct(w.product_id);
      const parsed  = parseProduct(product);
      return { ...w, parsed };
    })
  );

  let inserted = 0, failed = 0;

  for (const w of results) {
    if (!w.parsed) {
      // Merk som scraped selv om den feilet — unngå evig loop
      await sql`UPDATE vb_queue SET scraped = true WHERE product_id = ${w.product_id}`;
      failed++;
      continue;
    }
    const d = w.parsed;
    try {
      await sql`
        INSERT INTO vb_wines (
          product_id, name, producer, country, region, sub_region,
          year, type, grapes, alcohol, volume, price, color,
          flavor_profile, taste_fullness, taste_sweetness, taste_freshness,
          taste_tannins, taste_bitterness, aromas, description_no, status
        ) VALUES (
          ${w.product_id}, ${w.name}, ${d.producer}, ${d.country},
          ${d.region}, ${d.sub_region}, ${d.year},
          ${d.type}, ${d.grapes}, ${d.alcohol},
          ${d.volume}, ${d.price}, ${d.color},
          ${d.flavor_profile}, ${d.taste_fullness}, ${d.taste_sweetness},
          ${d.taste_freshness}, ${d.taste_tannins}, ${null},
          ${JSON.stringify(d.aromas)}, ${d.description_no}, ${d.status}
        )
        ON CONFLICT (product_id) DO UPDATE SET
          name            = EXCLUDED.name,
          producer        = EXCLUDED.producer,
          country         = EXCLUDED.country,
          region          = EXCLUDED.region,
          sub_region      = EXCLUDED.sub_region,
          year            = EXCLUDED.year,
          type            = EXCLUDED.type,
          grapes          = EXCLUDED.grapes,
          alcohol         = EXCLUDED.alcohol,
          volume          = EXCLUDED.volume,
          price           = EXCLUDED.price,
          color           = EXCLUDED.color,
          flavor_profile  = EXCLUDED.flavor_profile,
          taste_fullness  = EXCLUDED.taste_fullness,
          taste_sweetness = EXCLUDED.taste_sweetness,
          taste_freshness = EXCLUDED.taste_freshness,
          taste_tannins   = EXCLUDED.taste_tannins,
          aromas          = EXCLUDED.aromas,
          description_no  = EXCLUDED.description_no,
          status          = EXCLUDED.status
      `;
      inserted++;
    } catch { failed++; }

    await sql`UPDATE vb_queue SET scraped = true WHERE product_id = ${w.product_id}`;
  }

  const remaining = await sql`SELECT COUNT(*) as c FROM vb_queue WHERE scraped = false`;
  const wineCount = await sql`SELECT COUNT(*) as c FROM vb_wines`;

  return res.status(200).json({
    done: false,
    inserted,
    failed,
    remaining: Number(remaining[0].c),
    totalWines: Number(wineCount[0].c),
    hasMore: Number(remaining[0].c) > 0,
  });
}
