// DELETE after use!
export default async function handler(req, res) {
  const apiKey = process.env.VINMONOPOLET_API_KEY;
  const id = req.query.id || "124701";

  // Test 1: Single product by ID
  const r1 = await fetch(
    `https://apis.vinmonopolet.no/products/v0/details-normal?productId=${id}`,
    { headers: { "Ocp-Apim-Subscription-Key": apiKey, "Accept": "application/json" } }
  );
  const d1 = await r1.json();

  // Test 2: Check all top-level keys
  const sample = Array.isArray(d1) ? d1[0] : d1;

  return res.status(200).json({
    status: r1.status,
    isArray: Array.isArray(d1),
    count: Array.isArray(d1) ? d1.length : 1,
    topLevelKeys: sample ? Object.keys(sample) : [],
    basicKeys: sample?.basic ? Object.keys(sample.basic) : [],
    hasOrigins: !!sample?.origins,
    hasPrices: !!sample?.prices,
    hasClassification: !!sample?.classification,
    hasTaste: !!sample?.taste,
    hasIngredients: !!sample?.ingredients,
    rawSample: sample,
  });
}
