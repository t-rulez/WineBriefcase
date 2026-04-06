import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);
  const username = req.method === "GET" ? req.query.username : req.body?.username;
  if (!username) return res.status(400).json({ error: "Mangler brukernavn" });

  await sql`CREATE TABLE IF NOT EXISTS vb_userdata (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    tastings TEXT DEFAULT '[]',
    cellar TEXT DEFAULT '[]'
  )`;

  if (req.method === "GET") {
    const rows = await sql`SELECT tastings, cellar FROM vb_userdata WHERE username = ${username}`;
    if (rows.length === 0) return res.status(200).json({ tastings: [], cellar: [] });
    return res.status(200).json({
      tastings: JSON.parse(rows[0].tastings),
      cellar: JSON.parse(rows[0].cellar),
    });
  }

  if (req.method === "POST") {
    const { tastings, cellar } = req.body;
    const t = JSON.stringify(tastings ?? []);
    const c = JSON.stringify(cellar ?? []);
    await sql`INSERT INTO vb_userdata (username, tastings, cellar)
      VALUES (${username}, ${t}, ${c})
      ON CONFLICT (username) DO UPDATE SET tastings = ${t}, cellar = ${c}`;
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Metode ikke tillatt" });
}
