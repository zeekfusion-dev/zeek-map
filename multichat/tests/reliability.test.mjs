import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { setImmediate } from "node:timers/promises";
import { readFileSync } from "node:fs";
import { Connections } from "../src/connections.mjs";
import {
  kickMessage,
  kickSubscriberBadge,
  kickSubscriberDefault,
} from "../src/normalize.mjs";
import { Emotes } from "../src/emotes.mjs";
const tiers = JSON.parse(
  readFileSync(new URL("../src/kick-default.json", import.meta.url)),
).subscriber_badges;
test("Kick one-month uses native icon; all custom milestone boundaries retain correct images", () => {
  for (const [months, expected] of [
    [1, null],
    [2, 2],
    [3, 3],
    [5, 3],
    [6, 6],
    [8, 6],
    [9, 9],
    [11, 9],
    [12, 12],
    [17, 12],
    [18, 18],
    [24, 18],
  ])
    assert.equal(
      kickSubscriberBadge({ count: months }, [...tiers].reverse()),
      expected
        ? tiers.find((t) => t.months === expected).badge_image.src
        : kickSubscriberDefault,
    );
  const m = kickMessage(
    {
      id: "one",
      sender: {
        identity: {
          badges: [{ type: "subscriber", text: "Subscriber", count: 1 }],
        },
      },
      content: "Hello",
    },
    "c",
    new Emotes(),
    tiers,
  );
  assert.equal(m.user.badges[0].url, kickSubscriberDefault);
});
test("Kick prefers native supplied artwork, avoids duplicate subscriber roles and invalid tier URLs", () => {
  assert.equal(
    kickSubscriberBadge(
      { count: 1, image_url: "https://files.kick.com/direct.png" },
      tiers,
    ),
    "https://files.kick.com/direct.png",
  );
  assert.equal(
    kickSubscriberBadge({ count: "6" }, [
      { months: 6, badge_image: { src: "javascript:bad" } },
      ...tiers.filter((t) => t.months === 3),
    ]),
    tiers.find((t) => t.months === 3).badge_image.src,
  );
  const m = kickMessage(
    {
      sender: {
        identity: {
          badges_v2: [
            {
              type: "subscriber",
              selected: true,
              image_url: "https://files.kick.com/selected.png",
            },
          ],
          badges: [{ type: "subscriber", count: 1 }],
        },
      },
    },
    "c",
    new Emotes(),
    tiers,
  );
  assert.equal(m.user.badges.length, 1);
  assert.equal(m.user.badges[0].url, "https://files.kick.com/selected.png");
});
function fixture(cursor) {
  const state = new Map([["youtubeCursor", cursor]]),
    stream = new EventEmitter(),
    messages = [],
    statuses = [];
  let closed = 0,
    cancelled = 0,
    request;
  stream.cancel = () => {
    cancelled++;
    stream.emit("error", { code: 1 });
    stream.emit("close");
  };
  const c = new Connections(
    {
      get: (k) => state.get(k),
      set: (k, v) => state.set(k, v),
      token: () => ({ user: { id: "owner" } }),
    },
    { access: async () => "test-token" },
    { push: (m) => messages.push(m), moderate: () => {} },
    new Emotes(),
  );
  c.createYoutubeClient = () => ({
    streamList: (r) => {
      request = r;
      return stream;
    },
    close: () => closed++,
  });
  const controller = new AbortController();
  return {
    c,
    state,
    stream,
    controller,
    messages,
    statuses,
    run: () =>
      c.youtubeStream("chat", "owner", controller.signal, (s) =>
        statuses.push(s),
      ),
    get closed() {
      return closed;
    },
    get cancelled() {
      return cancelled;
    },
    get request() {
      return request;
    },
  };
}
test("YouTube headers are not ready; data confirms ready, delivers text details, saves resume cursor", async () => {
  const f = fixture({ chat: "chat", token: "resume" }),
    running = f.run();
  await setImmediate();
  assert.equal(f.request.pageToken, "resume");
  f.stream.emit("metadata", {});
  assert.deepEqual(f.statuses, []);
  f.stream.emit("data", {
    nextPageToken: "next",
    items: [
      {
        id: "message",
        snippet: {
          textMessageDetails: { messageText: "hello" },
          publishedAt: new Date().toISOString(),
        },
        authorDetails: { channelId: "viewer", displayName: "Viewer" },
      },
    ],
  });
  assert.equal(f.statuses.at(-1), "Connected");
  assert.equal(f.messages[0].segments[0].text, "hello");
  assert.ok(f.c.states.youtube.lastMessageAt);
  assert.deepEqual(f.state.get("youtubeCursor"), {
    chat: "chat",
    token: "next",
  });
  f.controller.abort();
  await running;
  assert.equal(f.closed, 1);
});
test("YouTube first-response stall cancels connection for retry", async () => {
  const f = fixture();
  f.c.youtubeFirstResponseTimeoutMs = 10;
  await assert.rejects(f.run(), /first response timed out/);
  assert.equal(f.closed, 1);
  assert.equal(f.cancelled, 1);
  assert.ok(!f.statuses.includes("Connected"));
});
test("YouTube invalid cursor clears, different broadcasts never reuse cursor", async () => {
  const f = fixture({ chat: "old", token: "old-token" }),
    running = f.run(),
    rejected = assert.rejects(running, (e) => e.code === 3);
  await setImmediate();
  assert.equal(f.request.pageToken, undefined);
  f.stream.emit("error", { code: 3 });
  await rejected;
  assert.equal(f.state.get("youtubeCursor"), null);
  assert.equal(f.closed, 1);
});
test("YouTube close after headers rejects rather than staying falsely connected", async () => {
  const f = fixture(),
    rejected = assert.rejects(f.run(), /closed/);
  await setImmediate();
  f.stream.emit("metadata", {});
  f.stream.emit("close");
  await rejected;
  assert.ok(!f.statuses.includes("Connected"));
  assert.equal(f.closed, 1);
});
test("YouTube scheduled chat cancelled when another broadcast goes live", async () => {
  const f = fixture();
  f.c.youtubeDiscoveryIntervalMs = 1;
  let discovery = 0,
    aborted = false;
  f.c.youtubeBroadcast = async () =>
    ++discovery === 1
      ? { id: "scheduled", snippet: { liveChatId: "scheduled-chat" } }
      : { id: "live", snippet: { liveChatId: "live-chat" } };
  f.c.emotes = { load: () => {} };
  f.c.youtubeRich = async (_, __, signal) =>
    new Promise((resolve) =>
      signal.addEventListener("abort", resolve, { once: true }),
    );
  f.c.youtubeStream = async (_, __, signal) =>
    new Promise((resolve) =>
      signal.addEventListener(
        "abort",
        () => {
          aborted = true;
          resolve();
        },
        { once: true },
      ),
    );
  await f.c.youtube(f.controller.signal, (s) => f.statuses.push(s));
  assert.ok(aborted);
  assert.ok(f.statuses.includes("Switching to current broadcast"));
});
test("YouTube discovery failures leave healthy chat running and retry", async () => {
  const f = fixture();
  f.c.youtubeDiscoveryIntervalMs = 1;
  let calls = 0,
    switched = false;
  const current = { snippet: { liveChatId: "current" } };
  f.c.youtubeBroadcast = async () => {
    if (++calls === 1) throw new Error("outage");
    f.controller.abort();
    return current;
  };
  await f.c.watchYoutubeBroadcast(
    current,
    f.controller.signal,
    () => (switched = true),
  );
  assert.equal(calls, 2);
  assert.equal(switched, false);
});
