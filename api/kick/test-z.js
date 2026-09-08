async function awardTestZ() {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/rpc/award_z`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_SECRET_KEY,
      },
      body: JSON.stringify({
        p_kick_user_id: 20306616,
        p_username: "ZeekFusion",
        p_amount: 1,
        p_reason: "System test",
        p_kick_event_id: `test-${Date.now()}`,
        p_metadata: { test: true },
      }),
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text);
  }

  return text ? JSON.parse(text) : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  if (req.headers["x-setup-key"] !== process.env.KICK_SETUP_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await awardTestZ();

    return res.status(200).json({
      success: true,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}