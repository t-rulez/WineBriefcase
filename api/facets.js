import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const sql = neon(process.env.DATABASE_URL);
  const { category = "", country = "" } = req.query;
  const cq  = category ? `%${category}%` : null;
  const coq = country  ? `%${country}%`  : null;

  try {
    let countries, regions, subRegions;

    // Countries filtered by category
    if (cq) {
      countries = await sql`SELECT DISTINCT country FROM vb_wines WHERE type ILIKE ${cq} AND country != '' ORDER BY country`;
    } else {
      countries = await sql`SELECT DISTINCT country FROM vb_wines WHERE country != '' ORDER BY country`;
    }

    // Regions filtered by category + country
    if (cq && coq) {
      regions    = await sql`SELECT DISTINCT region FROM vb_wines WHERE type ILIKE ${cq} AND country ILIKE ${coq} AND region != '' ORDER BY region`;
      subRegions = await sql`SELECT DISTINCT sub_region FROM vb_wines WHERE type ILIKE ${cq} AND country ILIKE ${coq} AND sub_region != '' ORDER BY sub_region`;
    } else if (cq) {
      regions    = await sql`SELECT DISTINCT region FROM vb_wines WHERE type ILIKE ${cq} AND region != '' ORDER BY region`;
      subRegions = await sql`SELECT DISTINCT sub_region FROM vb_wines WHERE type ILIKE ${cq} AND sub_region != '' ORDER BY sub_region`;
    } else if (coq) {
      regions    = await sql`SELECT DISTINCT region FROM vb_wines WHERE country ILIKE ${coq} AND region != '' ORDER BY region`;
      subRegions = await sql`SELECT DISTINCT sub_region FROM vb_wines WHERE country ILIKE ${coq} AND sub_region != '' ORDER BY sub_region`;
    } else {
      regions    = await sql`SELECT DISTINCT region FROM vb_wines WHERE region != '' ORDER BY region`;
      subRegions = await sql`SELECT DISTINCT sub_region FROM vb_wines WHERE sub_region != '' ORDER BY sub_region`;
    }

    return res.status(200).json({
      countries:  countries.map(r => r.country),
      regions:    regions.map(r => r.region),
      subRegions: subRegions.map(r => r.sub_region),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
