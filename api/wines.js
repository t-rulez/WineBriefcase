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
    // Build dynamic WHERE conditions
    const conditions = [];
    const params = [];
    let idx = 1;

    if (search) {
      const q = `%${search}%`;
      conditions.push(`(name ILIKE $${idx} OR producer ILIKE $${idx} OR grapes ILIKE $${idx} OR region ILIKE $${idx} OR country ILIKE $${idx} OR type ILIKE $${idx})`);
      params.push(q); idx++;
    }
    if (category) {
      conditions.push(`type ILIKE $${idx}`);
      params.push(`%${category}%`); idx++;
    }
    if (country) {
      conditions.push(`country ILIKE $${idx}`);
      params.push(`%${country}%`); idx++;
    }
    if (region) {
      conditions.push(`(region ILIKE $${idx} OR sub_region ILIKE $${idx})`);
      params.push(`%${region}%`); idx++;
    }
    if (status) {
      conditions.push(`status ILIKE $${idx}`);
      params.push(`%${status}%`); idx++;
    }
    if (isPriceFiltered) {
      conditions.push(`price >= $${idx} AND price <= $${idx+1}`);
      params.push(pMin, pMax); idx += 2;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const queryStr = `SELECT * FROM vb_wines ${where} ORDER BY name LIMIT 200`;

    const rows = await sql.query(queryStr, params);
    return res.status(200).json({ wines: rows.rows.map(mapWine), total: rows.rows.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
