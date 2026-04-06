import { neon } from "@neondatabase/serverless";

// Simple endpoint to update a single wine's product_id
// Called from the admin page client-side
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { wineId, productId } = req.body;
  if (!wineId || !productId) return res.status(400).json({ error: "wineId og productId påkrevd" });

  const sql = neon(process.env.DATABASE_URL);
  await sql`UPDATE vb_wines SET product_id = ${String(productId)} WHERE id = ${Number(wineId)}`;
  return res.status(200).json({ ok: true, wineId, productId });
}
