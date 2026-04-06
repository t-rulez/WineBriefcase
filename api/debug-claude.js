// Tests Claude API key without any image
// Visit: https://din-app.vercel.app/api/debug-claude
// DELETE after debugging!

export default async function handler(req, res) {
  const claudeKey = process.env.ANTHROPIC_API_KEY;

  if (!claudeKey) {
    return res.status(200).json({ error: "ANTHROPIC_API_KEY mangler i Vercel" });
  }

  // Test 1: simple text call (no image)
  const textRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 50,
      messages: [{ role: "user", content: "Say: API OK" }]
    }),
  });

  const textData = await textRes.json();

  return res.status(200).json({
    keyExists: true,
    keyPrefix: claudeKey.substring(0, 10) + "...",
    textCallStatus: textRes.status,
    textCallResponse: textData,
  });
}
