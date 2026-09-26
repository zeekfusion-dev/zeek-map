import test from "node:test";
import assert from "node:assert/strict";
import { RemoteStore } from "../src/remote-store.mjs";
import { LiveConnection } from "../public/live-client.js";
import { Connections } from "../src/connections.mjs";

test("YouTube attaches to scheduled chat before going live and prefers active chat", async () => {
  for (const active of [false, true]) {
    const calls = [];
    let attached;
    const c = Object.create(Connections.prototype);
    c.oauth = {
      api: async (_, url) => {
        calls.push(url);
        if (url.includes("broadcastStatus=active"))
          return {
            items: active
              ? [{ id: "live", snippet: { liveChatId: "live-chat" } }]
              : [],
          };
        return {
          items: [
            {
              id: "later",
              snippet: {
                liveChatId: "later-chat",
                scheduledStartTime: "2030-01-02T00:00:00Z",
              },
            },
            {
              id: "next",
              snippet: {
                liveChatId: "next-chat",
                scheduledStartTime: "2030-01-01T00:00:00Z",
              },
            },
            {
              id: "disabled",
              snippet: { scheduledStartTime: "2029-01-01T00:00:00Z" },
            },
          ],
        };
      },
    };
    c.store = { token: () => ({ user: { id: "owner" } }) };
    c.emotes = { load: () => {} };
    c.states = {};
    c.youtubeRich = (_, __, signal) =>
      new Promise((resolve) =>
        signal.addEventListener("abort", resolve, { once: true }),
      );
    c.youtubeStream = async (chat, channel) => {
      attached = { chat, channel };
    };
    await c.youtube(new AbortController().signal, () => {});
    assert.deepEqual(attached, {
      chat: active ? "live-chat" : "next-chat",
      channel: "owner",
    });
    assert.equal(calls.length, active ? 1 : 2);
  }
});
const makeBackend = () => {
  let state = { revision: 0, cipher: null };
  let requests = 0;
  let fail = false;
  return {
    state: () => state,
    requests: () => requests,
    fail: (value) => (fail = value),
    fetcher: async (url, options) => {
      requests++;
      const data = JSON.parse(options.body);
      if (fail) return { ok: false, status: 503 };
      if (data.p_key !== "dedicated-chat-secret")
        return { ok: false, status: 403 };
      if (url.endsWith("z_multichat_read"))
        return { ok: true, json: async () => ({ ...state }) };
      if (data.p_revision !== state.revision) return { ok: false, status: 409 };
      state = { revision: state.revision + 1, cipher: data.p_cipher };
      return { ok: true, json: async () => ({ revision: state.revision }) };
    },
  };
};
const makeStore = (b) =>
  new RemoteStore({
    url: "https://example.supabase.co",
    apiKey: "publishable",
    stateKey: "dedicated-chat-secret",
    encryptionKey: "encryption-key-kept-in-Render",
    fetcher: b.fetcher,
  });
test("Free cold start restores tokens, appearance and exact overlay key without disk", async () => {
  const b = makeBackend(),
    first = await makeStore(b).initialize();
  first.set("overlayKey", "same-permanent-key");
  first.set("settings", { fontSize: 24 });
  first.token("youtube", {
    access_token: "private-token",
    refresh_token: "rotated-token",
    user: { id: "UC1" },
  });
  await first.flush();
  assert(!b.state().cipher.includes("private-token"));
  first.db.close();
  const woke = await makeStore(b).initialize();
  assert.equal(woke.get("overlayKey"), "same-permanent-key");
  assert.equal(woke.token("youtube").refresh_token, "rotated-token");
  assert.equal(woke.get("settings").fontSize, 24);
  woke.db.close();
});
test("storage writes are acknowledged, coalesced and retried after failure", async () => {
  const b = makeBackend(),
    s = await makeStore(b).initialize();
  s.set("a", 1);
  await Promise.all([s.flush(), s.flush()]);
  const calls = b.requests();
  await s.flush();
  assert.equal(b.requests(), calls);
  b.fail(true);
  s.set("a", 2);
  await assert.rejects(s.flush(), /unavailable/);
  assert.equal(s.health().saved, false);
  b.fail(false);
  await s.flush();
  assert.equal(s.health().saved, true);
  assert.equal(s.health().error, null);
  s.db.close();
});
test("two instances cannot overwrite each other’s refreshed tokens", async () => {
  const b = makeBackend(),
    a = await makeStore(b).initialize(),
    c = await makeStore(b).initialize();
  a.set("token", "new");
  await a.flush();
  c.set("token", "stale");
  await assert.rejects(c.flush(), /another instance/);
  a.db.close();
  c.db.close();
});
test("unavailable remote state fails closed instead of generating a new OBS key", async () => {
  const b = makeBackend();
  b.fail(true);
  const s = makeStore(b);
  await assert.rejects(s.initialize(), /unavailable/);
  assert.equal(s.get("overlayKey"), null);
  s.db.close();
});
function clientFixture() {
  let now = 0;
  const timeouts = [],
    sockets = [],
    states = [];
  class WS {
    constructor() {
      this.readyState = 0;
      this.sent = [];
      sockets.push(this);
    }
    send(data) {
      this.sent.push(JSON.parse(data));
    }
    close(code = 1006) {
      this.readyState = 3;
      this.onclose?.({ code });
    }
    open() {
      this.readyState = 1;
      this.onopen();
    }
    receive(data) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }
  const client = new LiveConnection({
    url: "wss://chat.example/live",
    key: "permanent",
    onEvent: () => {},
    onState: (s) => states.push(s),
    WebSocketImpl: WS,
    now: () => now,
    random: () => 0,
    timers: {
      setTimeout: (f, ms) => {
        timeouts.push({ f, ms });
        return f;
      },
      clearTimeout: () => {},
      setInterval: (f) => f,
      clearInterval: () => {},
    },
  }).start();
  return { client, sockets, states, timeouts, advance: (n) => (now += n) };
}
test("quiet overlay sends inbound heartbeat and stays healthy on pong", () => {
  const f = clientFixture(),
    ws = f.sockets[0];
  ws.open();
  ws.receive({ type: "snapshot", messages: [] });
  f.advance(20000);
  f.client.tick();
  assert.deepEqual(ws.sent[0], { key: "permanent" });
  assert.equal(ws.sent[1].type, "ping");
  ws.receive({ type: "pong" });
  f.advance(40000);
  f.client.tick();
  assert.equal(ws.readyState, 1);
  f.client.stop();
});
test("stale service reconnects with same permanent key", () => {
  const f = clientFixture(),
    ws = f.sockets[0];
  ws.open();
  f.advance(61000);
  f.client.tick();
  assert.equal(ws.readyState, 3);
  assert.equal(f.timeouts.length, 1);
  f.timeouts[0].f();
  f.sockets[1].open();
  assert.equal(f.sockets[1].sent[0].key, "permanent");
  f.client.stop();
});
test("reconnect backoff and invalid links do not busy-loop", () => {
  const f = clientFixture();
  f.sockets[0].close();
  assert.equal(f.timeouts[0].ms, 1000);
  f.timeouts[0].f();
  f.sockets[1].close();
  assert.equal(f.timeouts[1].ms, 2000);
  f.timeouts[1].f();
  f.sockets[2].close(1008);
  assert.equal(f.client.stopped, true);
  assert.equal(f.states.at(-1), "unauthorized");
});

test("stalled CLOSING transport cannot prevent retry; stale callbacks cannot poison new socket", () => {
  const f = clientFixture(),
    old = f.sockets[0];
  old.open();
  old.close = () => {
    old.readyState = 2;
  };
  f.advance(61000);
  f.client.tick();
  assert.equal(f.timeouts.length, 1);
  f.timeouts[0].f();
  const fresh = f.sockets[1];
  fresh.open();
  old.onclose({ code: 1008 });
  old.receive({ type: "snapshot", streamId: "stale", messages: [] });
  assert.equal(f.client.stopped, false);
  assert.equal(f.client.socket, fresh);
  fresh.receive({ type: "snapshot", streamId: "current", messages: [] });
  f.client.reconnect();
  f.timeouts.at(-1).f();
  f.sockets[2].open();
  assert.deepEqual(f.sockets[2].sent[0].resume, { streamId: "current" });
  f.client.stop();
});
test("wake after suspension reconnects once and start is idempotent", () => {
  const f = clientFixture();
  f.client.start();
  assert.equal(f.sockets.length, 1);
  f.sockets[0].open();
  f.advance(61000);
  f.client.wake();
  assert.equal(f.sockets.length, 2);
  f.client.wake();
  assert.equal(f.sockets.length, 2);
  f.client.stop();
});
