import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const sql = neon(process.env.DATABASE_URL);
  const { category = "", country = "" } = req.query;

  try {
    // Build WHERE for current selections
    const conditions = ["status = 'aktiv' OR status IS NULL"];
    const params = [];
    let idx = 1;

    if (category) {
      conditions.push(`type ILIKE $${idx}`);
      params.push(`%${category}%`); idx++;
    }
    if (country) {
      conditions.push(`country ILIKE $${idx}`);
      params.push(`%${country}%`); idx++;
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    // Countries — filtered by category
    const countriesWhere = category
      ? `WHERE type ILIKE $1`
      : `WHERE 1=1`;
    const countriesParams = category ? [`%${category}%`] : [];
    const countriesRows = await sql.query(
      `SELECT DISTINCT country FROM vb_wines ${countriesWhere} AND country != '' ORDER BY country`,
      countriesParams
    );

    // Regions — filtered by category AND country
    const regionsRows = await sql.query(
      `SELECT DISTINCT region FROM vb_wines ${where} AND region != '' ORDER BY region`,
      params
    );

    // Sub-regions — filtered by category AND country
    const subRegionsRows = await sql.query(
      `SELECT DISTINCT sub_region FROM vb_wines ${where} AND sub_region != '' ORDER BY sub_region`,
      params
    );

    return res.status(200).json({
      countries:  countriesRows.rows.map(r => r.country),
      regions:    regionsRows.rows.map(r => r.region),
      subRegions: subRegionsRows.rows.map(r => r.sub_region),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
