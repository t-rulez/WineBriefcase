import { neon } from "@neondatabase/serverless";

function mapWine(w) {
  return {
    id:             w.id,
    product_id:     w.product_id,
    name:           w.name,
    producer:       w.producer,
    country:        w.country,
    region:         w.region,
    subRegion:      w.sub_region,
    year:           w.year,
    type:           w.type,
    mainCategory:   w.type,
    grapes:         w.grapes,
    alcohol:        w.alcohol,
    volume:         w.volume,
    price:          w.price,
    color:          w.color,
    flavor_profile: w.flavor_profile,
    taste: {
      fullness:   w.taste_fullness,
      sweetness:  w.taste_sweetness,
      freshness:  w.taste_freshness,
      tannins:    w.taste_tannins,
      bitterness: w.taste_bitterness,
    },
    aromaCategories: typeof w.aromas === "string" ? JSON.parse(w.aromas) : (w.aromas || []),
    description_no:  w.description_no,
    status:          w.status || "aktiv",
    imageUrl:        `https://bilder.vinmonopolet.no/cache/300x300-0/${w.product_id}-1.jpg`,
    imageUrlLarge:   `https://bilder.vinmonopolet.no/cache/515x515-0/${w.product_id}-1.jpg`,
    url:             `https://www.vinmonopolet.no/p/${w.product_id}`,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const sql = neon(process.env.DATABASE_URL);
  const {
    search   = "",
    category = "",
    country  = "",
    region   = "",
    status   = "aktiv",
    priceMin = "0",
    priceMax = "5000",
  } = req.query;

  const pMin = parseInt(priceMin) || 0;
  const pMax = parseInt(priceMax) || 5000;
  const isPriceFiltered = pMin > 0 || pMax < 5000;

  try {
    let rows;

    // Build search pattern
    const sq = search ? `%${search}%` : null;
    const cq = category ? `%${category}%` : null;
    const coq = country ? `%${country}%` : null;
    const rq = region ? `%${region}%` : null;
    const stq = status ? `%${status}%` : null;

    // Use tagged template literals — Neon handles parameterization automatically
    if (sq && cq && coq && rq) {
      rows = await sql`SELECT * FROM vb_wines WHERE (name ILIKE ${sq} OR producer ILIKE ${sq} OR grapes ILIKE ${sq}) AND type ILIKE ${cq} AND country ILIKE ${coq} AND (region ILIKE ${rq} OR sub_region ILIKE ${rq}) AND (${!isPriceFiltered} OR (price >= ${pMin} AND price <= ${pMax})) AND (${!stq} OR status ILIKE ${stq}) ORDER BY name LIMIT 200`;
    } else if (sq && cq && coq) {
      rows = await sql`SELECT * FROM vb_wines WHERE (name ILIKE ${sq} OR producer ILIKE ${sq} OR grapes ILIKE ${sq}) AND type ILIKE ${cq} AND country ILIKE ${coq} AND (${!isPriceFiltered} OR (price >= ${pMin} AND price <= ${pMax})) AND (${!stq} OR status ILIKE ${stq}) ORDER BY name LIMIT 200`;
    } else if (sq && cq) {
      rows = await sql`SELECT * FROM vb_wines WHERE (name ILIKE ${sq} OR producer ILIKE ${sq} OR grapes ILIKE ${sq}) AND type ILIKE ${cq} AND (${!isPriceFiltered} OR (price >= ${pMin} AND price <= ${pMax})) AND (${!stq} OR status ILIKE ${stq}) ORDER BY name LIMIT 200`;
    } else if (sq && coq) {
      rows = await sql`SELECT * FROM vb_wines WHERE (name ILIKE ${sq} OR producer ILIKE ${sq} OR grapes ILIKE ${sq}) AND country ILIKE ${coq} AND (${!isPriceFiltered} OR (price >= ${pMin} AND price <= ${pMax})) AND (${!stq} OR status ILIKE ${stq}) ORDER BY name LIMIT 200`;
    } else if (sq) {
      rows = await sql`SELECT * FROM vb_wines WHERE (name ILIKE ${sq} OR producer ILIKE ${sq} OR grapes ILIKE ${sq} OR region ILIKE ${sq} OR country ILIKE ${sq} OR type ILIKE ${sq}) AND (${!isPriceFiltered} OR (price >= ${pMin} AND price <= ${pMax})) AND (${!stq} OR status ILIKE ${stq}) ORDER BY name LIMIT 200`;
    } else if (cq && coq && rq) {
      rows = await sql`SELECT * FROM vb_wines WHERE type ILIKE ${cq} AND country ILIKE ${coq} AND (region ILIKE ${rq} OR sub_region ILIKE ${rq}) AND (${!isPriceFiltered} OR (price >= ${pMin} AND price <= ${pMax})) AND (${!stq} OR status ILIKE ${stq}) ORDER BY name LIMIT 200`;
    } else if (cq && coq) {
      rows = await sql`SELECT * FROM vb_wines WHERE type ILIKE ${cq} AND country ILIKE ${coq} AND (${!isPriceFiltered} OR (price >= ${pMin} AND price <= ${pMax})) AND (${!stq} OR status ILIKE ${stq}) ORDER BY name LIMIT 200`;
    } else if (cq && rq) {
      rows = await sql`SELECT * FROM vb_wines WHERE type ILIKE ${cq} AND (region ILIKE ${rq} OR sub_region ILIKE ${rq}) AND (${!isPriceFiltered} OR (price >= ${pMin} AND price <= ${pMax})) AND (${!stq} OR status ILIKE ${stq}) ORDER BY name LIMIT 200`;
    } else if (cq) {
      rows = await sql`SELECT * FROM vb_wines WHERE type ILIKE ${cq} AND (${!isPriceFiltered} OR (price >= ${pMin} AND price <= ${pMax})) AND (${!stq} OR status ILIKE ${stq}) ORDER BY name LIMIT 200`;
    } else if (coq && rq) {
      rows = await sql`SELECT * FROM vb_wines WHERE country ILIKE ${coq} AND (region ILIKE ${rq} OR sub_region ILIKE ${rq}) AND (${!isPriceFiltered} OR (price >= ${pMin} AND price <= ${pMax})) AND (${!stq} OR status ILIKE ${stq}) ORDER BY name LIMIT 200`;
    } else if (coq) {
      rows = await sql`SELECT * FROM vb_wines WHERE country ILIKE ${coq} AND (${!isPriceFiltered} OR (price >= ${pMin} AND price <= ${pMax})) AND (${!stq} OR status ILIKE ${stq}) ORDER BY name LIMIT 200`;
    } else if (rq) {
      rows = await sql`SELECT * FROM vb_wines WHERE (region ILIKE ${rq} OR sub_region ILIKE ${rq}) AND (${!isPriceFiltered} OR (price >= ${pMin} AND price <= ${pMax})) AND (${!stq} OR status ILIKE ${stq}) ORDER BY name LIMIT 200`;
    } else if (isPriceFiltered && stq) {
      rows = await sql`SELECT * FROM vb_wines WHERE price >= ${pMin} AND price <= ${pMax} AND status ILIKE ${stq} ORDER BY name LIMIT 200`;
    } else if (isPriceFiltered) {
      rows = await sql`SELECT * FROM vb_wines WHERE price >= ${pMin} AND price <= ${pMax} ORDER BY name LIMIT 200`;
    } else if (stq) {
      rows = await sql`SELECT * FROM vb_wines WHERE status ILIKE ${stq} ORDER BY name LIMIT 200`;
    } else {
      rows = await sql`SELECT * FROM vb_wines ORDER BY name LIMIT 200`;
    }

    return res.status(200).json({ wines: rows.map(mapWine), total: rows.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
