import { neon } from "@neondatabase/serverless";

function mapWine(w) {
  return {
    id:           w.id,
    product_id:   w.product_id,
    name:         w.name,
    producer:     w.producer,
    country:      w.country,
    region:       w.region,
    subRegion:    w.sub_region,
    year:         w.year,
    type:         w.type,
    mainCategory: w.type,
    grapes:       w.grapes,
    alcohol:      w.alcohol,
    volume:       w.volume,
    price:        w.price,
    color:        w.color,
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
    imageUrl:      `https://bilder.vinmonopolet.no/cache/300x300-0/${w.product_id}-1.jpg`,
    imageUrlLarge: `https://bilder.vinmonopolet.no/cache/515x515-0/${w.product_id}-1.jpg`,
    url:           `https://www.vinmonopolet.no/p/${w.product_id}`,
    isEco:         w.is_eco  || false,
    isVegan:       w.is_vegan || false,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const sql = neon(process.env.DATABASE_URL);
  const { search = "", category = "", country = "" } = req.query;

  try {
    let rows;
    const q = `%${search}%`;
    const cat = `%${category}%`;
    const ctr = `%${country}%`;

    if (search && category && country) {
      rows = await sql`SELECT * FROM vb_wines WHERE (name ILIKE ${q} OR producer ILIKE ${q} OR grapes ILIKE ${q} OR region ILIKE ${q}) AND type ILIKE ${cat} AND country ILIKE ${ctr} ORDER BY name LIMIT 100`;
    } else if (search && category) {
      rows = await sql`SELECT * FROM vb_wines WHERE (name ILIKE ${q} OR producer ILIKE ${q} OR grapes ILIKE ${q} OR region ILIKE ${q}) AND type ILIKE ${cat} ORDER BY name LIMIT 100`;
    } else if (search && country) {
      rows = await sql`SELECT * FROM vb_wines WHERE (name ILIKE ${q} OR producer ILIKE ${q} OR grapes ILIKE ${q} OR region ILIKE ${q}) AND country ILIKE ${ctr} ORDER BY name LIMIT 100`;
    } else if (category && country) {
      rows = await sql`SELECT * FROM vb_wines WHERE type ILIKE ${cat} AND country ILIKE ${ctr} ORDER BY name LIMIT 100`;
    } else if (search) {
      rows = await sql`SELECT * FROM vb_wines WHERE name ILIKE ${q} OR producer ILIKE ${q} OR grapes ILIKE ${q} OR region ILIKE ${q} OR country ILIKE ${q} OR type ILIKE ${q} ORDER BY name LIMIT 100`;
    } else if (category) {
      rows = await sql`SELECT * FROM vb_wines WHERE type ILIKE ${cat} ORDER BY name LIMIT 100`;
    } else if (country) {
      rows = await sql`SELECT * FROM vb_wines WHERE country ILIKE ${ctr} ORDER BY name LIMIT 100`;
    } else {
      rows = await sql`SELECT * FROM vb_wines ORDER BY name LIMIT 100`;
    }

    return res.status(200).json({ wines: rows.map(mapWine), total: rows.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
