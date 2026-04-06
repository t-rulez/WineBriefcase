import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { action, username, password } = req.body;
  if (!action || !username || !password)
    return res.status(400).json({ error: "Manglende felt" });

  const sql = neon(process.env.DATABASE_URL);
  const user = username.trim().toLowerCase();

  await sql`CREATE TABLE IF NOT EXISTS vb_users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`;

  if (action === "register") {
    const existing = await sql`SELECT id FROM vb_users WHERE username = ${user}`;
    if (existing.length > 0) return res.status(409).json({ error: "Brukernavnet er allerede tatt." });
    const hash = await bcrypt.hash(password, 10);
    await sql`INSERT INTO vb_users (username, password) VALUES (${user}, ${hash})`;
    return res.status(200).json({ ok: true, username: user });
  }

  if (action === "login") {
    const rows = await sql`SELECT username, password FROM vb_users WHERE username = ${user}`;
    if (rows.length === 0) return res.status(401).json({ error: "Feil brukernavn eller passord." });
    const match = await bcrypt.compare(password, rows[0].password);
    if (!match) return res.status(401).json({ error: "Feil brukernavn eller passord." });
    return res.status(200).json({ ok: true, username: rows[0].username });
  }

  return res.status(400).json({ error: "Ukjent handling" });
}
