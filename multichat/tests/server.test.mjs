import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import WebSocket from "ws";
import { Store } from "../src/store.mjs";
import { createApp } from "../src/server.mjs";
async function fixture() {
  const store = new Store(":memory:", "test-key"),
    origin = "http://localhost:8787",
    service = createApp({
      store,
      origin,
      password: "test-password-very-long",
      connect: false,
    });
  service.server.listen(0, "127.0.0.1");
  await once(service.server, "listening");
  return {
    ...service,
    store,
    origin,
    url: `http://127.0.0.1:${service.server.address().port}`,
  };
}
async function login(f) {
  const r = await fetch(f.url + "/api/login", {
    method: "POST",
    headers: { Origin: f.origin, "Content-Type": "application/json" },
    body: JSON.stringify({ password: "test-password-very-long" }),
  });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}
test("dashboard is private; login rejects CSRF; overlay key only returned to owner", async () => {
  const f = await fixture();
  try {
    assert.equal((await fetch(f.url + "/api/status")).status, 401);
    assert.equal(
      (
        await fetch(f.url + "/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: "test-password-very-long" }),
        })
      ).status,
      403,
    );
    const cookie = await login(f);
    const d = await (
      await fetch(f.url + "/api/status", { headers: { cookie } })
    ).json();
    assert.match(d.overlayUrl, /\/overlay#[\w-]{43}$/);
    assert.equal(
      (
        await fetch(f.url + "/api/settings", {
          method: "POST",
          headers: { cookie, "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      403,
    );
  } finally {
    f.close();
    f.store.db.close();
  }
});
test("WebSocket requires correct read-only key and streams moderation", async () => {
  const f = await fixture();
  f.connections.status("kick", "Connected");
  f.connections.status("twitch", "Connecting");
  f.connections.status("youtube", "Not connected");
  let ws;
  try {
    ws = new WebSocket(f.url.replace("http:", "ws:") + "/live", {
      origin: f.origin,
    });
    await once(ws, "open");
    const snapshot = once(ws, "message");
    ws.send(JSON.stringify({ key: f.store.get("overlayKey") }));
    const initial = JSON.parse((await snapshot)[0]);
    assert.equal(initial.type, "snapshot");
    assert.deepEqual(Object.keys(initial.platforms).sort(), [
      "kick",
      "twitch",
      "youtube",
    ]);
    assert.equal(initial.platforms.twitch.state, "Connecting");
    const incoming = once(ws, "message");
    f.feed.push({
      id: "1",
      platform: "kick",
      channel: "c",
      timestamp: Date.now(),
      user: { id: "u", name: "user" },
      segments: [],
    });
    f.feed.flush();
    assert.equal(JSON.parse((await incoming)[0]).messages.length, 1);
    const deletion = once(ws, "message");
    f.feed.moderate({ platform: "kick", channel: "c", id: "1" });
    assert.equal(JSON.parse((await deletion)[0]).type, "remove");
  } finally {
    ws?.terminate();
    f.close();
    f.store.db.close();
  }
});
test("wrong overlay key cannot read messages", async () => {
  const f = await fixture();
  let ws;
  try {
    ws = new WebSocket(f.url.replace("http:", "ws:") + "/live", {
      origin: f.origin,
    });
    await once(ws, "open");
    const closed = once(ws, "close");
    ws.send(JSON.stringify({ key: "wrong" }));
    assert.equal((await closed)[0], 1008);
  } finally {
    ws?.terminate();
    f.close();
    f.store.db.close();
  }
});
test("Kick webhook rejects unsigned messages", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (
        await fetch(f.url + "/webhooks/kick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      401,
    );
  } finally {
    f.close();
    f.store.db.close();
  }
});
test("OAuth state is session-bound and single-use", async () => {
  const f = await fixture();
  try {
    f.oauth.credentials = () => ({
      client_id: "client",
      client_secret: "secret",
    });
    const u = new URL(f.oauth.begin("twitch", "session-a"));
    await assert.rejects(
      () =>
        f.oauth.complete(
          "twitch",
          "code",
          u.searchParams.get("state"),
          "session-b",
        ),
      /expired/,
    );
    assert.equal(f.oauth.pending.size, 0);
  } finally {
    f.close();
    f.store.db.close();
  }
});
test("concurrent refresh calls only rotate once and persist refreshed credentials", async () => {
  const f = await fixture();
  try {
    f.store.token("twitch", {
      refresh_token: "old",
      access_token: "expired",
      expiresAt: 0,
      user: { id: "u" },
    });
    let calls = 0;
    f.oauth.exchange = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 15));
      return { access_token: "fresh", refresh_token: "new", expires_in: 3600 };
    };
    assert.deepEqual(
      await Promise.all([f.oauth.access("twitch"), f.oauth.access("twitch")]),
      ["fresh", "fresh"],
    );
    assert.equal(calls, 1);
    assert.equal(f.store.token("twitch").refresh_token, "new");
  } finally {
    f.close();
    f.store.db.close();
  }
});

test("Twitch handoff keeps old socket until welcome and preserves subscriptions", async () => {
  const f = await fixture();
  try {
    f.store.token("twitch", {
      access_token: "token",
      expiresAt: Date.now() + 3600000,
      user: { id: "u" },
    });
    const c = f.connections;
    let subscriptions = 0,
      oldClosed = false,
      welcomed = false;
    c.emotes.load = async () => {};
    f.oauth.api = async (url, path, opts) => {
      if (opts?.method === "POST") subscriptions++;
      return { data: [] };
    };
    c.socket = async (url, signal, handler, options) => {
      assert.equal(options.pingOutbound, false);
      if (url.endsWith("/ws")) {
        await new Promise(async (resolve, reject) => {
          const finish = (e) => {
            oldClosed = true;
            e ? reject(e) : resolve();
          };
          await handler(
            {
              metadata: { message_type: "session_welcome" },
              payload: { session: { id: "first" } },
            },
            {},
            finish,
          );
          await handler(
            {
              metadata: { message_type: "session_reconnect" },
              payload: {
                session: {
                  reconnect_url: "wss://eventsub.wss.twitch.tv/migrate",
                },
              },
            },
            {},
            finish,
          );
        });
      } else {
        assert.equal(oldClosed, false);
        await handler(
          {
            metadata: { message_type: "session_welcome" },
            payload: { session: { id: "second" } },
          },
          {},
          () => {},
        );
        welcomed = true;
        assert.equal(oldClosed, true);
      }
    };
    await c.twitch(new AbortController().signal, () => {});
    assert.equal(subscriptions, 4);
    assert.equal(welcomed, true);
  } finally {
    f.close();
    f.store.db.close();
  }
});

test("authenticated OBS heartbeat receives live service health during quiet chat", async () => {
  const f = await fixture();
  let ws;
  try {
    ws = new WebSocket(f.url.replace("http:", "ws:") + "/live", {
      origin: f.origin,
    });
    await once(ws, "open");
    let response = once(ws, "message");
    ws.send(JSON.stringify({ key: f.store.get("overlayKey") }));
    await response;
    response = once(ws, "message");
    ws.send(JSON.stringify({ type: "ping" }));
    const event = JSON.parse((await response)[0]);
    assert.equal(event.type, "pong");
    assert.equal(typeof event.at, "number");
    assert.equal(typeof event.platforms, "object");
  } finally {
    ws?.terminate();
    await f.close();
    f.store.db.close();
  }
});
test("authorized history pages are chronological while new messages keep streaming", async () => {
  const f = await fixture();
  let ws;
  try {
    for (let i = 0; i < 350; i++)
      f.feed.push({
        id: String(i),
        platform: "kick",
        channel: "c",
        timestamp: Date.now() - 600000 + i,
        user: { id: "v" },
        segments: [],
      });
    f.feed.flush();
    ws = new WebSocket(f.url.replace("http:", "ws:") + "/live", {
      origin: f.origin,
    });
    await once(ws, "open");
    let response = once(ws, "message");
    ws.send(JSON.stringify({ key: f.store.get("overlayKey") }));
    const initial = JSON.parse((await response)[0]);
    assert.equal(initial.messages.length, 100);
    assert.equal(initial.messages[0].id, "250");
    assert.equal(initial.hasMore, true);
    response = once(ws, "message");
    ws.send(JSON.stringify({ type: "history", before: initial.before }));
    const older = JSON.parse((await response)[0]);
    assert.equal(older.type, "history");
    assert.equal(older.messages[0].id, "150");
    assert.equal(older.messages.at(-1).id, "249");
    response = once(ws, "message");
    f.feed.push({
      id: "live",
      platform: "kick",
      channel: "c",
      timestamp: Date.now(),
      user: { id: "v" },
      segments: [],
    });
    f.feed.flush();
    assert.equal(JSON.parse((await response)[0]).messages[0].id, "live");
    response = once(ws, "message");
    ws.send(JSON.stringify({ type: "history", before: older.before }));
    assert.equal(JSON.parse((await response)[0]).messages.at(-1).id, "149");
  } finally {
    ws?.terminate();
    await f.close();
    f.store.db.close();
  }
});

test("independent clients recover all retained messages beyond 100 after disconnect including deletions", async () => {
  const f = await fixture();
  let a, b;
  const open = async (resume) => {
    const ws = new WebSocket(f.url.replace("http:", "ws:") + "/live", {
      origin: f.origin,
    });
    await once(ws, "open");
    const incoming = once(ws, "message");
    ws.send(
      JSON.stringify({
        key: f.store.get("overlayKey"),
        ...(resume ? { resume } : {}),
      }),
    );
    return [ws, JSON.parse((await incoming)[0])];
  };
  try {
    let initial;
    [a, initial] = await open();
    [b] = await open();
    a.terminate();
    await once(a, "close");
    for (let i = 0; i < 350; i++)
      f.feed.push({
        id: String(i),
        platform: "kick",
        channel: "c",
        timestamp: Date.now(),
        user: { id: "u" },
        segments: [],
      });
    const live = once(b, "message");
    f.feed.flush();
    assert.equal(JSON.parse((await live)[0]).messages.length, 350);
    f.feed.moderate({ platform: "kick", channel: "c", id: "30" });
    let replay;
    [a, replay] = await open({ streamId: initial.streamId });
    assert.equal(replay.messages.length, 349);
    assert.equal(replay.hasMore, false);
    assert.ok(!replay.messages.some((m) => m.id === "30"));
    assert.equal(new Set(replay.messages.map((m) => m.id)).size, 349);
    assert.equal((await fetch(f.url + "/reader")).status, 200);
  } finally {
    a?.terminate();
    b?.terminate();
    await f.close();
    f.store.db.close();
  }
});

test("signed Kick redemption webhooks verify, stream viewer input, and deduplicate status updates", async (t) => {
  const crypto = await import("node:crypto");
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const actualFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", (url, opts) =>
    String(url) === "https://api.kick.com/public/v1/public-key"
      ? Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                public_key: publicKey.export({ type: "spki", format: "pem" }),
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        )
      : actualFetch(url, opts),
  );
  const f = await fixture();
  f.store.set("kickChannelId", "123");
  try {
    const e = {
      id: "redemption-1",
      broadcaster: { user_id: 123 },
      redeemer: { user_id: 99, username: "Viewer" },
      reward: { title: "Hydrate" },
      user_input: "Have some water!",
      redeemed_at: new Date().toISOString(),
    };
    for (const status of ["pending", "accepted", "accepted"]) {
      const body = JSON.stringify({ ...e, status }),
        id = crypto.randomUUID(),
        stamp = new Date().toISOString();
      const signature = crypto
        .sign("RSA-SHA256", Buffer.from(`${id}.${stamp}.${body}`), privateKey)
        .toString("base64");
      const response = await fetch(f.url + "/webhooks/kick", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Kick-Event-Message-Id": id,
          "Kick-Event-Message-Timestamp": stamp,
          "Kick-Event-Signature": signature,
          "Kick-Event-Type": "channel.reward.redemption.updated",
        },
        body,
      });
      assert.equal(response.status, 204);
      f.feed.flush();
    }
    assert.equal(f.feed.messages.length, 1);
    assert.equal(f.feed.messages[0].activity.status, "accepted");
    assert.equal(
      f.feed.messages[0].segments.map((s) => s.text).join(""),
      "Have some water!",
    );
  } finally {
    await f.close();
    f.store.db.close();
  }
});
