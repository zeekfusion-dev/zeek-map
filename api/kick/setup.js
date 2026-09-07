export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  // Protect this one-time setup endpoint
  const setupKey = req.headers["x-setup-key"];

  if (!process.env.KICK_SETUP_KEY || setupKey !== process.env.KICK_SETUP_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // 1. Get an app access token from Kick
    const tokenResponse = await fetch("https://id.kick.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.KICK_CLIENT_ID,
        client_secret: process.env.KICK_CLIENT_SECRET,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return res.status(500).json({
        step: "getting app token",
        error: tokenData,
      });
    }

    const accessToken = tokenData.access_token;

    // 2. Find ZeekFusion's broadcaster ID
    const channelResponse = await fetch(
      "https://api.kick.com/public/v1/channels?slug=zeekfusion",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const channelData = await channelResponse.json();

    if (!channelResponse.ok) {
      return res.status(500).json({
        step: "getting channel",
        error: channelData,
      });
    }

    const channel = channelData?.data?.[0];

    if (!channel) {
      return res.status(404).json({
        error: "Could not find Kick channel zeekfusion",
      });
    }

    const broadcasterUserId = channel.broadcaster_user_id;

    // 3. Subscribe to the events we care about
    const events = [
      { name: "chat.message.sent", version: 1 },
      { name: "channel.subscription.new", version: 1 },
      { name: "channel.subscription.renewal", version: 1 },
      { name: "channel.subscription.gifts", version: 1 },
      { name: "kicks.gifted", version: 1 },
      { name: "livestream.status.updated", version: 1 },
    ];

    const subscriptionResponse = await fetch(
      "https://api.kick.com/public/v1/events/subscriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          broadcaster_user_id: broadcasterUserId,
          events,
          method: "webhook",
        }),
      }
    );

    const subscriptionData = await subscriptionResponse.json();

    if (!subscriptionResponse.ok) {
      return res.status(500).json({
        step: "creating subscriptions",
        broadcaster_user_id: broadcasterUserId,
        error: subscriptionData,
      });
    }

    return res.status(200).json({
      success: true,
      channel: channel.slug,
      broadcaster_user_id: broadcasterUserId,
      subscriptions: subscriptionData,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Unexpected setup error",
      details: error.message,
    });
  }
}