export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "ZeekFusion Kick webhook is online",
    });
  }

  if (req.method === "POST") {
    const eventType = req.headers["kick-event-type"];
    const messageId = req.headers["kick-event-message-id"];

    console.log("===== KICK EVENT =====");
    console.log("Event:", eventType);
    console.log("Message ID:", messageId);
    console.log("Body:", JSON.stringify(req.body, null, 2));
    console.log("======================");

    return res.status(200).json({
      received: true,
    });
  }

  return res.status(405).json({
    error: "Method not allowed",
  });
}