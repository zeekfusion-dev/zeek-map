import test from "node:test";
import assert from "node:assert/strict";
import {
  kickReward,
  kickPin,
  KickActivityCopies,
} from "../src/kick-activity.mjs";
import { Feed } from "../src/feed.mjs";
import { Store } from "../src/store.mjs";
import { Emotes } from "../src/emotes.mjs";
import { Connections } from "../src/connections.mjs";
const emotes = new Emotes();
const reward = {
  reward_title: "Hydrate",
  user_id: 42,
  username: "Viewer",
  user_input: "Drink water",
  channel_id: 7,
};
const message = {
  id: "m",
  content: "Pinned [emote:37226:KEKW]",
  created_at: new Date().toISOString(),
  sender: {
    id: 42,
    username: "Viewer",
    identity: { badges: [{ type: "subscriber", count: 1 }] },
  },
};
test("public reward payload renders input and preserves repeated identical redemptions", () => {
  const a = kickReward(reward, "c", emotes),
    b = kickReward(reward, "c", emotes);
  assert.equal(a.activity.title, "redeemed: Hydrate");
  assert.equal(a.user.name, "Viewer");
  assert.equal(a.segments.map((s) => s.text).join(""), "Drink water");
  assert.notEqual(a.id, b.id);
  const copies = new KickActivityCopies();
  assert.equal(copies.duplicate("reward", reward, "channel_7"), false);
  assert.equal(copies.duplicate("reward", reward, "channel.7"), true);
  assert.equal(copies.duplicate("reward", reward, "channel_7"), false);
  assert.equal(copies.duplicate("reward", reward, "channel.7"), true);
  assert.equal(kickReward({}, "c", emotes), null);
});
test("pins retain badge/emote rendering, survive reader reconnect and expire or clear on moderation", () => {
  const store = new Store(":memory:", "test");
  let now = Date.now();
  const f = new Feed({ store, now: () => now });
  const pin = kickPin({ message, duration: 60 }, "c", emotes, [], now);
  assert.equal(pin.message.segments.at(-1).type, "emote");
  assert.ok(pin.message.user.badges[0].url);
  f.setPin(pin);
  f.checkpoint();
  const restored = new Feed({ store, now: () => now });
  assert.equal(restored.currentPin().message.id, "m");
  now += 61000;
  assert.equal(restored.currentPin(), null);
  now -= 61000;
  f.moderate({ platform: "kick", channel: "c", id: "m" });
  assert.equal(f.currentPin(), null);
  f.close();
  restored.close();
  store.db.close();
});
test("actual Kick socket handler subscribes reward channels and routes reward, pin and unpin independently", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        id: 7,
        user: { id: 9 },
        chatroom: { id: 8 },
        subscriber_badges: [],
      }),
    );
  const store = new Store(":memory:", "test");
  store.set("kickChannel", "test");
  const f = new Feed();
  const e = new Emotes();
  e.load = async () => {};
  const c = new Connections(store, {}, f, e);
  const subscribed = [];
  c.kickTransportDescriptor = async () => ({
    provider: "pusher",
    credentials: { app_key: "test", cluster: "us2" },
  });
  c.socket = async (url, signal, handler) => {
    const ws = { send: (s) => subscribed.push(JSON.parse(s).data.channel) };
    await handler({ event: "pusher:connection_established", data: {} }, ws);
    assert.deepEqual(subscribed, [
      "chatrooms.8.v2",
      "chatroom_8",
      "channel_7",
      "channel.7",
    ]);
    const send = (event, data, channel = "chatrooms.8.v2") =>
      handler({ event, data: JSON.stringify(data), channel }, ws);
    await send("RewardRedeemedEvent", reward, "channel_7");
    await send("RewardRedeemedEvent", reward, "channel.7");
    f.flush();
    assert.equal(f.messages.length, 1);
    await send("App\\Events\\ChatMessageEvent", message);
    f.flush();
    await send("App\\Events\\PinnedMessageCreatedEvent", {
      message,
      duration: 60,
    });
    assert.equal(f.currentPin().message.id, "m");
    await send("App\\Events\\PinnedMessageDeletedEvent", {});
    assert.equal(f.currentPin(), null);
    assert.equal(
      f.messages.length,
      2,
      "unpin must not delete regular chat or disconnect socket",
    );
  };
  try {
    await c.kick(new AbortController().signal, () => {});
  } finally {
    globalThis.fetch = original;
    f.close();
    store.db.close();
  }
});
