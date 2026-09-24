import express from "express";
import crypto from "node:crypto";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "node:url";
import { Store, secret, equal } from "./store.mjs";
import { RemoteStore } from "./remote-store.mjs";
import { Feed } from "./feed.mjs";
import { Emotes } from "./emotes.mjs";
import { OAuth, providers } from "./oauth.mjs";
import { Connections } from "./connections.mjs";
import { json } from "./net.mjs";
import { kickMessage } from "./normalize.mjs";
export function createApp({ store, origin, password, connect = true } = {}) {
  const app = express(),
    server = createServer(app),
    feed = new Feed({ store }),
    emotes = new Emotes(),
    oauth = new OAuth(store, origin),
    connections = new Connections(store, oauth, feed, emotes),
    sockets = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  if (!store.get("kickChannel"))
    store.set("kickChannel", process.env.KICK_CHANNEL || "zeekfusion");
  const overlayKey =
    store.get("overlayKey") || store.set("overlayKey", secret());
  const sessions = new Map(),
    attempts = new Map();
  const settings = () =>
    store.get("settings", {
      fontSize: 19,
      background: 0,
      bold: true,
      avatars: false,
      maxMessages: 120,
    });
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    res.set({
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self' ws: wss:; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'",
      "Cache-Control": "no-store",
    });
    next();
  });
  const cookie = (req) =>
    String(req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("chat_session="))
      ?.slice(13);
  const authenticated = (req) => {
    const id = cookie(req),
      expires = sessions.get(id);
    if (!expires || expires < Date.now()) {
      sessions.delete(id);
      return false;
    }
    return true;
  };
  const owner = (req, res, next) =>
    authenticated(req)
      ? next()
      : res.status(401).json({ error: "Sign in to your dashboard." });
  const sameOrigin = (req, res, next) =>
    req.headers.origin === origin
      ? next()
      : res.status(403).json({ error: "Use the dashboard to make changes." });
  let kickPublicKey;
  app.post(
    "/webhooks/kick",
    express.raw({ type: "application/json", limit: "256kb" }),
    async (req, res) => {
      try {
        const id = req.get("Kick-Event-Message-Id"),
          stamp = req.get("Kick-Event-Message-Timestamp"),
          sig = req.get("Kick-Event-Signature");
        if (
          !id ||
          !sig ||
          !stamp ||
          !Number.isFinite(Date.parse(stamp)) ||
          Math.abs(Date.now() - Date.parse(stamp)) > 300000
        )
          return res.sendStatus(401);
        if (!kickPublicKey)
          kickPublicKey = (
            await json("https://api.kick.com/public/v1/public-key")
          ).data.public_key;
        const signed = Buffer.concat([
          Buffer.from(`${id}.${stamp}.`),
          req.body,
        ]);
        if (
          !crypto.verify(
            "RSA-SHA256",
            signed,
            kickPublicKey,
            Buffer.from(sig, "base64"),
          )
        )
          return res.sendStatus(401);
        const e = JSON.parse(req.body),
          channel = String(e.broadcaster?.user_id);
        if (channel !== store.get("kickChannelId")) return res.sendStatus(204);
        const type = req.get("Kick-Event-Type");
        if (type === "chat.message.sent")
          feed.push(
            kickMessage(e, channel, emotes, connections.subscriberBadges),
          );
        if (type === "moderation.banned")
          feed.moderate({
            platform: "kick",
            channel,
            userId: String(e.banned_user?.user_id),
          });
        return res.sendStatus(204);
      } catch {
        return res.sendStatus(503);
      }
    },
  );
  app.use(express.json({ limit: "16kb" }));
  app.post("/api/login", sameOrigin, (req, res) => {
    const ip = req.ip,
      now = Date.now();
    const record = attempts.get(ip) || { count: 0, until: now + 60000 };
    if (record.until < now) {
      record.count = 0;
      record.until = now + 60000;
    }
    record.count++;
    attempts.set(ip, record);
    if (record.count > 10)
      return res
        .status(429)
        .json({ error: "Please wait a minute before trying again." });
    if (!equal(req.body.password, password))
      return res.status(401).json({ error: "Incorrect dashboard password." });
    const id = secret();
    sessions.set(id, now + 7 * 86400000);
    res.cookie("chat_session", id, {
      httpOnly: true,
      secure: origin.startsWith("https:"),
      sameSite: "lax",
      maxAge: 7 * 86400000,
      path: "/",
    });
    res.json({ ok: true });
  });
  app.post("/api/logout", sameOrigin, owner, (req, res) => {
    sessions.delete(cookie(req));
    res.clearCookie("chat_session");
    res.json({ ok: true });
  });
  app.get("/api/status", owner, (req, res) =>
    res.json({
      platforms: Object.fromEntries(
        Object.keys(providers).map((p) => [
          p,
          {
            ...connections.states[p],
            configured: oauth.configured(p),
            account:
              store.token(p)?.user?.name ||
              (p === "kick" ? store.get("kickChannel") : null),
          },
        ]),
      ),
      storage: store.health(),
      ready:
        Object.values(connections.states).length === 3 &&
        Object.values(connections.states).every((s) => s.state === "Connected"),
      settings: settings(),
      overlayUrl: `${origin}/overlay#${overlayKey}`,
      kickChannel: store.get("kickChannel", ""),
      callbacks: Object.fromEntries(
        Object.keys(providers).map((p) => [p, `${origin}/auth/${p}/callback`]),
      ),
    }),
  );
  app.post("/api/settings", sameOrigin, owner, async (req, res) => {
    const b = req.body;
    const next = {
      fontSize: Math.max(12, Math.min(48, Number(b.fontSize) || 19)),
      background: Math.max(0, Math.min(0.9, Number(b.background) || 0)),
      bold: Boolean(b.bold),
      avatars: Boolean(b.avatars),
      maxMessages: Math.max(20, Math.min(200, Number(b.maxMessages) || 120)),
    };
    store.set("settings", next);
    await store.flush();
    broadcast({ type: "settings", settings: next });
    res.json(next);
  });
  app.post("/api/kick", sameOrigin, owner, async (req, res) => {
    const channel = String(req.body.channel || "")
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9_-]{1,64}$/.test(channel))
      return res.status(400).json({ error: "Enter your Kick channel name." });
    store.set("kickChannel", channel);
    await store.flush();
    connections.start("kick");
    res.json({ ok: true });
  });
  app.post("/api/reconnect/:platform", sameOrigin, owner, (req, res) => {
    if (!providers[req.params.platform]) return res.sendStatus(404);
    connections.start(req.params.platform);
    res.json({ ok: true });
  });
  app.get("/auth/:platform", owner, (req, res, next) => {
    try {
      res.redirect(oauth.begin(req.params.platform, cookie(req)));
    } catch (e) {
      next(e);
    }
  });
  app.get("/auth/:platform/callback", owner, async (req, res, next) => {
    try {
      const p = req.params.platform;
      if (!providers[p]) return res.sendStatus(404);
      await oauth.complete(
        p,
        String(req.query.code || ""),
        String(req.query.state || ""),
        cookie(req),
      );
      if (p === "kick") {
        const token = store.token("kick");
        store.set("kickChannelId", token.user.id);
        try {
          await oauth.api(
            "kick",
            "https://api.kick.com/public/v1/events/subscriptions",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                broadcaster_user_id: Number(token.user.id),
                events: [
                  { name: "chat.message.sent", version: 1 },
                  { name: "moderation.banned", version: 1 },
                ],
                method: "webhook",
              }),
            },
          );
          store.set("kickWebhook", true);
        } catch {
          store.set("kickWebhook", false);
        }
      }
      await store.flush();
      connections.start(p);
      res.redirect("/dashboard");
    } catch (e) {
      next(e);
    }
  });
  const publicDir = fileURLToPath(new URL("../public", import.meta.url));
  app.get("/healthz", (req, res) => res.json({ ok: true }));
  app.get("/", (req, res) => res.redirect("/dashboard"));
  app.get(["/dashboard", "/overlay", "/preview"], (req, res) =>
    res.sendFile(publicDir + "/index.html"),
  );
  app.use(
    express.static(publicDir, { etag: true, maxAge: "1h", index: false }),
  );
  app.use((e, req, res, next) => {
    const status = [400, 401, 403, 409, 429].includes(e.status)
      ? e.status
      : 502;
    res.status(status).json({
      error:
        status === 502
          ? "The platform could not complete this connection. Return to the dashboard and try again."
          : e.message,
    });
  });
  function send(ws, data) {
    if (ws.readyState !== 1) return;
    if (ws.bufferedAmount > 1024 * 1024) {
      ws.close(1013, "Please reconnect");
      return;
    }
    ws.send(JSON.stringify(data));
  }
  function broadcast(event) {
    for (const ws of sockets.clients) if (ws.authorized) send(ws, event);
  }
  feed.on("event", broadcast);
  server.on("upgrade", (req, socket, head) => {
    if (
      req.url !== "/live" ||
      req.headers.origin !== origin ||
      sockets.clients.size >= 50
    ) {
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(req, socket, head, (ws) =>
      sockets.emit("connection", ws, req),
    );
  });
  sockets.on("connection", (ws) => {
    ws.alive = true;
    ws.on("pong", () => (ws.alive = true));
    const deadline = setTimeout(() => ws.close(1008), 5000);
    ws.on("close", () => clearTimeout(deadline));
    ws.on("message", (raw) => {
      try {
        const data = JSON.parse(raw);
        if (ws.authorized) {
          if (data.type === "history") {
            const before = data.before;
            if (
              before &&
              Number.isFinite(before.timestamp) &&
              Number.isFinite(before.sequence)
            )
              send(ws, { type: "history", ...feed.page(before) });
          }
          if (data.type === "ping") {
            ws.alive = true;
            send(ws, {
              type: "pong",
              at: Date.now(),
              platforms: connections.states,
            });
          }
          return;
        }
        if (!equal(data.key, overlayKey)) {
          ws.close(1008);
          return;
        }
        ws.authorized = true;
        clearTimeout(deadline);
        send(ws, {
          type: "snapshot",
          ...feed.page(),
          retainedKeys: feed.messages.map((m) => feed.key(m)),
          settings: settings(),
          platforms: connections.states,
        });
      } catch {
        ws.close(1008);
      }
    });
  });
  const interval = setInterval(() => {
    for (const ws of sockets.clients) {
      if (!ws.alive) ws.terminate();
      else {
        ws.alive = false;
        ws.ping();
      }
    }
    for (const [id, t] of sessions) if (t < Date.now()) sessions.delete(id);
    for (const [ip, a] of attempts)
      if (a.until < Date.now()) attempts.delete(ip);
  }, 15000);
  const checkpoint = setInterval(() => {
    feed.checkpoint();
    void store.flush().catch(() => {});
  }, 60000);
  if (connect) connections.startAll();
  return {
    app,
    server,
    feed,
    connections,
    oauth,
    close: async () => {
      clearInterval(interval);
      clearInterval(checkpoint);
      connections.stop();
      feed.close();
      for (const ws of sockets.clients) ws.terminate();
      sockets.close();
      server.close();
      await store.flush();
    },
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const origin =
    process.env.PUBLIC_ORIGIN ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${process.env.PORT || 8787}`;
  if (!process.env.ENCRYPTION_KEY || !process.env.ADMIN_PASSWORD)
    throw new Error(
      "Set ENCRYPTION_KEY and ADMIN_PASSWORD in the hosting environment.",
    );
  if (
    process.env.ENCRYPTION_KEY.length < 32 ||
    process.env.ADMIN_PASSWORD.length < 16
  )
    throw new Error(
      "Use at least 32 characters for ENCRYPTION_KEY and 16 for ADMIN_PASSWORD.",
    );
  let store;
  if (process.env.RENDER && !process.env.STATE_URL)
    throw new Error(
      "Render Free requires external STATE_URL, STATE_API_KEY and STATE_ACCESS_KEY. Local files are not durable.",
    );
  if (process.env.STATE_URL) {
    if (!process.env.STATE_API_KEY || !process.env.STATE_ACCESS_KEY)
      throw new Error("Complete the encrypted storage configuration.");
    store = await new RemoteStore({
      url: process.env.STATE_URL,
      apiKey: process.env.STATE_API_KEY,
      stateKey: process.env.STATE_ACCESS_KEY,
      encryptionKey: process.env.ENCRYPTION_KEY,
    }).initialize();
  } else
    store = new Store(
      process.env.DATA_PATH || ".data/chat.sqlite",
      process.env.ENCRYPTION_KEY,
    );
  const service = createApp({
    store,
    origin,
    password: process.env.ADMIN_PASSWORD,
  });
  await store.flush();
  service.server.listen(Number(process.env.PORT || 8787), "0.0.0.0", () =>
    console.log("Multichat is listening."),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, async () => {
      const timeout = setTimeout(() => process.exit(1), 25000).unref();
      try {
        await service.close();
        clearTimeout(timeout);
        process.exit(0);
      } catch {
        process.exit(1);
      }
    });
}
