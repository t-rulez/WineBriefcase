import { neon } from "@neondatabase/serverless";

// Uses Vinmonopolet's internal website search API to find correct product IDs
// Visit: https://din-app.vercel.app/api/fix-ids
// DELETE this file after running!

async function searchVmp(query) {
  const url = `https://www.vinmonopolet.no/vmpws/v2/vmp/search?q=${encodeURIComponent(query)}&searchType=product&currentPage=0&pageSize=5&fields=FULL`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": "https://www.vinmonopolet.no/",
        "Accept-Language": "nb-NO,nb;q=0.9",
      },
    });
    if (!res.ok) return { error: res.status, url };
    const data = await res.json();
    const products = data?.productSearchResult?.products || [];
    return products.map(p => ({
      id: p.code,
      name: p.name,
      price: p.price?.value,
      type: p.main_category?.name,
    }));
  } catch (e) {
    return { error: e.message };
  }
}

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  // Only process a batch at a time to avoid timeout
  const start = parseInt(req.query.start || "0");
  const batchSize = 10;

  const wines = await sql`
    SELECT id, name, producer, product_id
    FROM vb_wines
    ORDER BY id
    LIMIT ${batchSize} OFFSET ${start}
  `;

  const total = await sql`SELECT COUNT(*) as count FROM vb_wines`;

  const results = [];

  for (const wine of wines) {
    // Try producer name first, then wine name
    const queries = [
      wine.producer?.split("(")[0].trim(), // strip parentheses like "(Casillero del Diablo)"
      wine.name.split(" ").slice(0, 3).join(" "),
    ].filter(Boolean);

    let hits = [];
    for (const q of queries) {
      hits = await searchVmp(q);
      if (Array.isArray(hits) && hits.length > 0) break;
      await new Promise(r => setTimeout(r, 300));
    }

    const result = {
      db_id: wine.id,
      db_name: wine.name,
      old_product_id: wine.product_id,
      hits: Array.isArray(hits) ? hits.slice(0, 3) : hits,
      new_product_id: null,
      status: "no match",
    };

    if (Array.isArray(hits) && hits.length > 0) {
      // Find best match by comparing names
      const wineName = wine.name.toLowerCase();
      const producer = (wine.producer || "").toLowerCase().split("(")[0].trim();

      const best = hits.find(h => {
        const hn = (h.name || "").toLowerCase();
        const producerWord = producer.split(" ")[0];
        return hn.includes(producerWord) && producerWord.length > 3;
      }) || hits[0];

      if (best?.id) {
        result.new_product_id = best.id;
        result.best_match_name = best.name;

        if (best.id !== wine.product_id) {
          await sql`UPDATE vb_wines SET product_id = ${best.id} WHERE id = ${wine.id}`;
          result.status = "updated";
        } else {
          result.status = "unchanged";
        }
      }
    }

    results.push(result);
    await new Promise(r => setTimeout(r, 200));
  }

  const nextStart = start + batchSize;
  const totalCount = parseInt(total[0].count);
  const hasMore = nextStart < totalCount;

  return res.status(200).json({
    ok: true,
    batch: `${start + 1}–${Math.min(start + batchSize, totalCount)} of ${totalCount}`,
    hasMore,
    nextUrl: hasMore ? `/api/fix-ids?start=${nextStart}` : null,
    results,
  });
}
