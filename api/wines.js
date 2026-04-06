import { neon } from "@neondatabase/serverless";

function mapWine(w) {
  return {
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
    taste: {
      fullness:   w.taste_fullness,
      sweetness:  w.taste_sweetness,
      freshness:  w.taste_freshness,
      tannins:    w.taste_tannins,
      bitterness: w.taste_bitterness,
    },
    aromaCategories: typeof w.aromas === "string" ? JSON.parse(w.aromas) : (w.aromas || []),
    description_no: w.description_no,
    description_en: w.description_en,
    imageUrl:      `https://bilder.vinmonopolet.no/cache/300x300-0/${w.product_id}-1.jpg`,
    imageUrlLarge: `https://bilder.vinmonopolet.no/cache/515x515-0/${w.product_id}-1.jpg`,
    url:           `https://www.vinmonopolet.no/p/${w.product_id}`,
    isEco:   w.is_eco   || false,
    isVegan: w.is_vegan || false,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const sql = neon(process.env.DATABASE_URL);
  const { search = "", category = "", country = "", maxResults = "24" } = req.query;
  const limit = Math.min(parseInt(maxResults, 10) || 24, 100);

  try {
    let rows;

    if (search && category && country) {
      const q = `%${search}%`;
      rows = await sql`
        SELECT * FROM vb_wines
        WHERE (name ILIKE ${q} OR producer ILIKE ${q} OR grapes ILIKE ${q} OR region ILIKE ${q})
          AND type ILIKE ${'%' + category + '%'}
          AND country ILIKE ${'%' + country + '%'}
        ORDER BY rating DESC LIMIT ${limit}`;
    } else if (search && category) {
      const q = `%${search}%`;
      rows = await sql`
        SELECT * FROM vb_wines
        WHERE (name ILIKE ${q} OR producer ILIKE ${q} OR grapes ILIKE ${q} OR region ILIKE ${q})
          AND type ILIKE ${'%' + category + '%'}
        ORDER BY rating DESC LIMIT ${limit}`;
    } else if (search && country) {
      const q = `%${search}%`;
      rows = await sql`
        SELECT * FROM vb_wines
        WHERE (name ILIKE ${q} OR producer ILIKE ${q} OR grapes ILIKE ${q} OR region ILIKE ${q})
          AND country ILIKE ${'%' + country + '%'}
        ORDER BY rating DESC LIMIT ${limit}`;
    } else if (category && country) {
      rows = await sql`
        SELECT * FROM vb_wines
        WHERE type ILIKE ${'%' + category + '%'}
          AND country ILIKE ${'%' + country + '%'}
        ORDER BY rating DESC LIMIT ${limit}`;
    } else if (search) {
      const q = `%${search}%`;
      rows = await sql`
        SELECT * FROM vb_wines
        WHERE name ILIKE ${q} OR producer ILIKE ${q} OR grapes ILIKE ${q}
           OR region ILIKE ${q} OR country ILIKE ${q} OR type ILIKE ${q}
        ORDER BY rating DESC LIMIT ${limit}`;
    } else if (category) {
      rows = await sql`
        SELECT * FROM vb_wines
        WHERE type ILIKE ${'%' + category + '%'}
        ORDER BY rating DESC LIMIT ${limit}`;
    } else if (country) {
      rows = await sql`
        SELECT * FROM vb_wines
        WHERE country ILIKE ${'%' + country + '%'}
        ORDER BY rating DESC LIMIT ${limit}`;
    } else {
      rows = await sql`
        SELECT * FROM vb_wines
        ORDER BY rating DESC LIMIT ${limit}`;
    }

    const wines = rows.map(mapWine);
    return res.status(200).json({ wines, total: wines.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
