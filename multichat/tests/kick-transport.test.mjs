import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { kickDescriptor, kickCentrifuge } from "../src/kick-transport.mjs";
test("Kick discovers the current provider instead of accepting the retired socket", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.match(url, /channels\/19330932\/chat\/connection/);
    assert.equal(
      JSON.parse(options.body).capabilities.accepted_providers.length,
      2,
    );
    return new Response(
      JSON.stringify({
        data: {
          mode: "websocket",
          connections: [
            {
              provider: "centrifugo",
              credentials: {
                url: "wss://realtime.platform.kick.com/connection/websocket",
              },
            },
          ],
        },
      }),
    );
  };
  try {
    assert.equal((await kickDescriptor(19330932)).provider, "centrifugo");
  } finally {
    globalThis.fetch = original;
  }
});
test("Centrifugo forwards native chat envelopes, acknowledges subscriptions, and cleans up on abort", async () => {
  let client;
  class Fake extends EventEmitter {
    constructor() {
      super();
      client = this;
      this.subs = [];
    }
    newSubscription(topic) {
      const s = new EventEmitter();
      s.subscribe = () => {};
      s.topic = topic;
      this.subs.push(s);
      return s;
    }
    connect() {
      for (const s of this.subs) s.emit("subscribed");
    }
    disconnect() {
      this.closed = true;
      this.emit("disconnected");
    }
  }
  const c = new AbortController(),
    events = [];
  const task = kickCentrifuge(
    { credentials: { url: "wss://example.com" }, clientId: "test" },
    ["chatrooms.1.v2"],
    c.signal,
    (e) => events.push(e),
    () => {},
    Fake,
  );
  client.subs[0].emit("publication", {
    data: {
      event: "App\\Events\\ChatMessageEvent",
      data: JSON.stringify({ id: "test", content: "hello" }),
    },
  });
  assert.equal(events[0].event, "pusher_internal:subscription_succeeded");
  assert.equal(JSON.parse(events[1].data).content, "hello");
  c.abort();
  await task;
  assert.equal(client.closed, true);
});
