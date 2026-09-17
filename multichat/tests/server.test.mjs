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
  let ws;
  try {
    ws = new WebSocket(f.url.replace("http:", "ws:") + "/live", {
      origin: f.origin,
    });
    await once(ws, "open");
    const snapshot = once(ws, "message");
    ws.send(JSON.stringify({ key: f.store.get("overlayKey") }));
    assert.equal(JSON.parse((await snapshot)[0]).type, "snapshot");
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
