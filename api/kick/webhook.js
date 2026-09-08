import crypto from "crypto";

export const config = {
  api: {
    bodyParser: false,
  },
};

const KICK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----`;

async function readRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function verifyKickSignature(messageId, timestamp, signature, rawBody) {
  const signedData =
    `${messageId}.${timestamp}.${rawBody.toString("utf8")}`;

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(signedData);
  verifier.end();

  return verifier.verify(KICK_PUBLIC_KEY, signature, "base64");
}

async function awardZ({
  userId,
  username,
  amount,
  reason,
  eventId,
  metadata,
}) {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/rpc/award_z`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_SECRET_KEY,
      },
      body: JSON.stringify({
        p_kick_user_id: userId,
        p_username: username,
        p_amount: amount,
        p_reason: reason,
        p_kick_event_id: eventId,
        p_metadata: metadata,
      }),
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Supabase error ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "ZeekFusion Kick webhook is online",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const rawBody = await readRawBody(req);

    const eventType = req.headers["kick-event-type"];
    const eventId = req.headers["kick-event-message-id"];
    const timestamp = req.headers["kick-event-message-timestamp"];
    const signature = req.headers["kick-event-signature"];

    if (
      !verifyKickSignature(eventId, timestamp, signature, rawBody)
    ) {
      return res.status(401).json({ error: "Invalid Kick signature" });
    }

    const body = JSON.parse(rawBody.toString("utf8"));

    // NEW SUB = +1 Z
    if (eventType === "channel.subscription.new") {
      await awardZ({
        userId: body.subscriber.user_id,
        username: body.subscriber.username,
        amount: 1,
        reason: "New subscription",
        eventId,
        metadata: body,
      });
    }

    // EACH GIFTED SUB = +1 Z TO GIFTER
    if (eventType === "channel.subscription.gifts") {
      if (
        body.gifter &&
        !body.gifter.is_anonymous &&
        body.gifter.user_id
      ) {
        const amount = body.giftees?.length || 0;

        if (amount > 0) {
          await awardZ({
            userId: body.gifter.user_id,
            username: body.gifter.username,
            amount,
            reason: `Gifted ${amount} subscription(s)`,
            eventId,
            metadata: body,
          });
        }
      }
    }

    console.log("Kick event processed:", eventType);

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);

    return res.status(500).json({
      error: "Webhook processing failed",
    });
  }
}