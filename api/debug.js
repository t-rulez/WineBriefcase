import { neon } from "@neondatabase/serverless";
export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  const statuses = await sql`SELECT DISTINCT status, COUNT(*) as count FROM vb_wines GROUP BY status ORDER BY count DESC`;
  const sample = await sql`SELECT product_id, name, status FROM vb_wines WHERE status != 'aktiv' LIMIT 5`;
  return res.status(200).json({ statuses, sample });
}
