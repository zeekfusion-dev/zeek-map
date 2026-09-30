import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { Centrifuge } from "centrifuge";
import { json } from "./net.mjs";
const base = "https://web.kick.com/api/v1/realtime";
const headers = {
  "Content-Type": "application/json",
  "x-app-platform": "web",
  Referer: "https://kick.com/",
};
export async function kickDescriptor(channelId, signal) {
  const clientId = randomUUID();
  const response = await json(`${base}/channels/${channelId}/chat/connection`, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      client: { id: clientId, type: "web" },
      capabilities: {
        accepted_providers: [
          { provider: "pusher" },
          { provider: "centrifugo" },
        ],
      },
    }),
  });
  const descriptor = response.data;
  const connection =
    descriptor?.mode === "websocket" &&
    descriptor.connections?.find((c) =>
      ["centrifugo", "pusher"].includes(c.provider),
    );
  if (!connection)
    throw new Error("Kick did not provide a supported chat transport");
  return { ...connection, clientId };
}
export function kickCentrifuge(
  connection,
  topics,
  signal,
  handler,
  status,
  Client = Centrifuge,
) {
  return new Promise((resolve, reject) => {
    let ended = false;
    const client = new Client(connection.credentials.url, {
      websocket: WebSocket,
      getToken: async () => {
        const response = await json(`${base}/auth/connection`, {
          method: "POST",
          headers,
          signal,
          body: JSON.stringify({ client_id: connection.clientId }),
        });
        if (!response.data?.token)
          throw new Error("Kick connection token unavailable");
        return response.data.token;
      },
    });
    const finish = (error) => {
      if (ended) return;
      ended = true;
      clearTimeout(deadline);
      signal.removeEventListener("abort", abort);
      client.disconnect();
      error ? reject(error) : resolve();
    };
    const abort = () => finish();
    // Rediscover after interruptions rather than staying on a retired provider.
    const deadline = setTimeout(
      () => finish(new Error("Kick subscription timed out")),
      45000,
    );
    signal.addEventListener("abort", abort, { once: true });
    client.on("error", () => status("Reconnecting"));
    client.on("disconnected", () =>
      finish(
        signal.aborted ? undefined : new Error("Kick transport disconnected"),
      ),
    );
    client.on("connecting", () => status("Connecting"));
    for (const topic of topics) {
      const sub = client.newSubscription(topic);
      sub.on("subscribed", () => {
        if (ended) return;
        if (topic === topics[0]) clearTimeout(deadline);
        void Promise.resolve(
          handler({
            event: "pusher_internal:subscription_succeeded",
            channel: topic,
            data: {},
          }),
        ).catch(finish);
      });
      sub.on("publication", (ctx) => {
        if (ended) return;
        try {
          const e = ctx.data;
          if (typeof e?.event !== "string") return;
          void Promise.resolve(
            handler({ event: e.event, data: e.data, channel: topic }),
          ).catch(finish);
        } catch (error) {
          finish(error);
        }
      });
      sub.on("error", () => {
        if (topic === topics[0])
          finish(new Error("Kick chat subscription failed"));
      });
      sub.on("unsubscribed", () => {
        if (topic === topics[0])
          finish(new Error("Kick chat subscription ended"));
      });
      sub.subscribe();
    }
    if (signal.aborted) abort();
    else client.connect();
  });
}
