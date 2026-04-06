// Temporary debug endpoint - shows raw data from Vinmonopolet API
// Visit: https://din-app.vercel.app/api/debug
// DELETE this file after debugging!

export default async function handler(req, res) {
  const apiKey = process.env.VINMONOPOLET_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "No API key" });

  const params = new URLSearchParams({ maxResults: "5", start: "0" });
  const search = req.query.search || "";
  if (search) params.set("productShortNameContains", search);

  const response = await fetch(
    `https://apis.vinmonopolet.no/products/v0/details-normal?${params}`,
    { headers: { "Ocp-Apim-Subscription-Key": apiKey, "Accept": "application/json" } }
  );

  const data = await response.json();

  // Return the first product raw so we can see the exact field structure
  return res.status(200).json({
    httpStatus: response.status,
    count: Array.isArray(data) ? data.length : "not an array",
    firstProduct: Array.isArray(data) ? data[0] : data,
    allClassifications: Array.isArray(data)
      ? data.map(p => ({
          name: p.basic?.productShortName || p.Basicdetails?.productShortName || p.productShortName,
          mainType: p.classification?.mainProductTypeName || p.Classification?.mainProductTypeName,
          subType:  p.classification?.subProductTypeName  || p.Classification?.subProductTypeName,
          keys: Object.keys(p),
        }))
      : [],
  });
}
