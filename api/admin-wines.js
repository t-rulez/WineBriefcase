import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const sql = neon(process.env.DATABASE_URL);
  const wines = await sql`SELECT id, name, producer, product_id, type, country FROM vb_wines ORDER BY id`;
  return res.status(200).json(wines);
}
