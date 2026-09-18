import WebSocket from "ws";
import defaultKick from "./kick-default.json" with { type: "json" };
import { json, request, retryLoop, sleep } from "./net.mjs";
import {
  kickMessage,
  twitchMessage,
  youtubeMessage,
  youtubeRenderer,
} from "./normalize.mjs";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "node:url";
const proto = grpc.loadPackageDefinition(
  protoLoader.loadSync(
    fileURLToPath(new URL("../vendor/stream_list.proto", import.meta.url)),
    { longs: String, enums: String },
  ),
);
export class Connections {
  constructor(store, oauth, feed, emotes) {
    Object.assign(this, { store, oauth, feed, emotes });
    this.controllers = new Map();
    this.states = {};
    this.badges = new Map();
    this.subscriberBadges = [];
  }
  status(p, state) {
    this.states[p] = { ...this.states[p], state, updatedAt: Date.now() };
  }
  start(p) {
    this.controllers.get(p)?.abort();
    const controller = new AbortController();
    this.controllers.set(p, controller);
    const status = (s) => {
      if (!controller.signal.aborted) this.status(p, s);
    };
    if (p !== "kick" && !this.store.token(p)) {
      status("Not connected");
      return;
    }
    if (p === "kick" && !this.store.get("kickChannel")) {
      status("Not connected");
      return;
    }
    status("Connecting");
    retryLoop(controller.signal, (s) => this[p](s, status), status).catch(() =>
      status("Reconnect required"),
    );
  }
  startAll() {
    for (const p of ["kick", "twitch", "youtube"]) this.start(p);
  }
  stop() {
    for (const c of this.controllers.values()) c.abort();
  }
  async socket(
    url,
    signal,
    handler,
    { onOpen, onClose, timeout = 90000, pingOutbound = true } = {},
  ) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      let ended = false,
        last = Date.now();
      const finish = (e) => {
        if (ended) return;
        ended = true;
        clearInterval(timer);
        signal.removeEventListener("abort", abort);
        ws.terminate();
        onClose?.();
        e ? reject(e) : resolve();
      };
      const abort = () => finish();
      signal.addEventListener("abort", abort, { once: true });
      const timer = setInterval(() => {
        if (Date.now() - last > timeout)
          finish(new Error("Connection heartbeat expired"));
        else if (pingOutbound && ws.readyState === WebSocket.OPEN) ws.ping();
      }, 15000);
      ws.on("pong", () => (last = Date.now()));
      ws.on("ping", () => (last = Date.now()));
      ws.on("open", () => Promise.resolve(onOpen?.(ws)).catch(finish));
      ws.on("message", (raw) => {
        last = Date.now();
        try {
          Promise.resolve(handler(JSON.parse(raw), ws, finish)).catch(finish);
        } catch (e) {
          finish(e);
        }
      });
      ws.on("error", finish);
      ws.on("close", () =>
        finish(signal.aborted ? undefined : new Error("Connection closed")),
      );
      if (signal.aborted) abort();
    });
  }
  async kick(signal, status) {
    const slug = this.store.get("kickChannel");
    let info;
    try {
      info = await json(
        `https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`,
        { signal, headers: { "User-Agent": "Mozilla/5.0" } },
      );
      this.store.set("kickInfo:" + slug, info);
    } catch (e) {
      if (signal.aborted) throw e;
      info =
        this.store.get("kickInfo:" + slug) ||
        (slug === defaultKick.slug ? defaultKick : null);
      if (!info) throw e;
    }
    const room = info.chatroom?.id;
    if (!room) throw new Error("Chatroom unavailable");
    const channel = String(info.user?.id || info.id);
    this.store.set("kickChannelId", channel);
    this.subscriberBadges = info.subscriber_badges || [];
    void this.emotes.load("kick", channel);
    let lastBadgeRefresh = Date.now();
    const refreshBadges = async () => {
      if (Date.now() - lastBadgeRefresh < 5 * 60000) return;
      lastBadgeRefresh = Date.now();
      try {
        const fresh = await json(
          `https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`,
          { signal, headers: { "User-Agent": "Mozilla/5.0" } },
        );
        if (signal.aborted || !Array.isArray(fresh.subscriber_badges)) return;
        this.subscriberBadges = fresh.subscriber_badges;
        this.store.set("kickInfo:" + slug, fresh);
      } catch {
        /* Keep the last successful badge list during provider outages. */
      }
    };
    await this.socket(
      "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=7.6.0&flash=false",
      signal,
      async (m, ws) => {
        const data = typeof m.data === "string" ? JSON.parse(m.data) : m.data;
        if (m.event === "pusher:connection_established") {
          ws.send(
            JSON.stringify({
              event: "pusher:subscribe",
              data: { auth: "", channel: `chatrooms.${room}.v2` },
            }),
          );
        }
        if (m.event === "pusher_internal:subscription_succeeded")
          status("Connected");
        if (m.event === "pusher:ping")
          ws.send(JSON.stringify({ event: "pusher:pong", data: {} }));
        if (m.event?.endsWith("ChatMessageEvent")) {
          void refreshBadges();
          this.feed.push(
            kickMessage(data, channel, this.emotes, this.subscriberBadges),
            { enrich: true },
          );
          void this.emotes.load("kick", channel);
        }
        if (m.event?.endsWith("MessageDeletedEvent"))
          this.feed.moderate({
            platform: "kick",
            channel,
            id: String(data.message.id),
          });
        if (m.event?.endsWith("UserBannedEvent"))
          this.feed.moderate({
            platform: "kick",
            channel,
            userId: String(data.user.id),
          });
        if (m.event?.endsWith("ChatroomClearEvent"))
          this.feed.moderate({ platform: "kick", channel });
      },
    );
  }
  async twitch(signal, status) {
    const user = this.store.token("twitch").user,
      channel = user.id;
    void this.emotes.load("twitch", channel);
    const badgeResults = await Promise.allSettled(
      [
        "https://api.twitch.tv/helix/chat/badges/global",
        `https://api.twitch.tv/helix/chat/badges?broadcaster_id=${channel}`,
      ].map((url) => this.oauth.api("twitch", url)),
    );
    for (const result of badgeResults)
      if (result.status === "fulfilled")
        for (const b of result.value.data || [])
          for (const v of b.versions)
            this.badges.set(`${b.set_id}/${v.id}`, v.image_url_2x);
    const seen = new Set();
    const session = async (url, migrating = false, onWelcome) => {
      let next;
      try {
        await this.socket(
          url,
          signal,
          async (m, ws, finish) => {
            const type = m.metadata?.message_type;
            if (type === "session_welcome") {
              if (!migrating) {
                for (const event of [
                  "channel.chat.message",
                  "channel.chat.message_delete",
                  "channel.chat.clear",
                  "channel.chat.clear_user_messages",
                ])
                  await this.oauth.api(
                    "twitch",
                    "https://api.twitch.tv/helix/eventsub/subscriptions",
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        type: event,
                        version: "1",
                        condition: {
                          broadcaster_user_id: channel,
                          user_id: channel,
                        },
                        transport: {
                          method: "websocket",
                          session_id: m.payload.session.id,
                        },
                      }),
                    },
                  );
              }
              onWelcome?.();
              status("Connected");
            }
            if (type === "session_reconnect") {
              const target = new URL(m.payload.session.reconnect_url);
              if (
                target.protocol !== "wss:" ||
                !target.hostname.endsWith(".twitch.tv")
              )
                throw new Error("Invalid reconnect destination");
              if (!next) {
                // Keep the old transport until the new session welcomes us.
                next = session(target.href, true, () => finish());
                next.catch(finish);
              }
            }
            if (type === "revocation")
              throw Object.assign(new Error("Authorization revoked"), {
                status: 401,
              });
            if (type !== "notification") return;
            const id = m.metadata.message_id;
            if (seen.has(id)) return;
            seen.add(id);
            if (seen.size > 10000) seen.delete(seen.values().next().value);
            const e = m.payload.event,
              t = m.payload.subscription.type;
            if (t === "channel.chat.message") {
              this.feed.push(
                twitchMessage(
                  { ...e, timestamp: m.metadata.message_timestamp },
                  channel,
                  this.emotes,
                  this.badges,
                ),
              );
              void this.emotes.load("twitch", channel);
            } else if (t === "channel.chat.message_delete")
              this.feed.moderate({
                platform: "twitch",
                channel,
                id: e.message_id,
              });
            else if (t === "channel.chat.clear_user_messages")
              this.feed.moderate({
                platform: "twitch",
                channel,
                userId: e.target_user_id,
              });
            else if (t === "channel.chat.clear")
              this.feed.moderate({ platform: "twitch", channel });
          },
          { pingOutbound: false, timeout: 45000 },
        );
      } catch (error) {
        if (!next) throw error;
      }
      if (next) await next;
    };
    await session("wss://eventsub.wss.twitch.tv/ws");
  }

  async youtubeBroadcast(preferredChat) {
    const broadcasts = await this.oauth.api(
      "youtube",
      "https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet&broadcastStatus=active&broadcastType=all&maxResults=50",
    );
    let broadcast =
      broadcasts.items?.find(
        (b) => b.snippet?.liveChatId === preferredChat && preferredChat,
      ) || broadcasts.items?.find((b) => b.snippet?.liveChatId);
    if (!broadcast) {
      const upcoming = await this.oauth.api(
        "youtube",
        "https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet&broadcastStatus=upcoming&broadcastType=all&maxResults=50",
      );
      broadcast = upcoming.items
        ?.filter((b) => b.snippet?.liveChatId)
        .sort(
          (a, b) =>
            Date.parse(a.snippet.scheduledStartTime || "9999-01-01") -
            Date.parse(b.snippet.scheduledStartTime || "9999-01-01"),
        )[0];
    }
    return broadcast;
  }
  async watchYoutubeBroadcast(broadcast, signal, onSwitch) {
    while (!signal.aborted) {
      await sleep(this.youtubeDiscoveryIntervalMs || 30000, undefined, {
        signal,
      });
      try {
        const latest = await this.youtubeBroadcast(
          broadcast.snippet.liveChatId,
        );
        if (signal.aborted) return;
        this.states.youtube = { ...this.states.youtube, discoveryError: null };
        if (latest?.snippet.liveChatId !== broadcast.snippet.liveChatId) {
          onSwitch();
          return;
        }
      } catch {
        if (!signal.aborted)
          this.states.youtube = {
            ...this.states.youtube,
            discoveryError: "Broadcast check delayed; retrying",
          };
      }
    }
  }
  async youtube(signal, status) {
    const broadcast = await this.youtubeBroadcast();
    if (signal.aborted) return;
    if (!broadcast) {
      this.states.youtube = {
        ...this.states.youtube,
        video: null,
        title: null,
        detail: null,
        error: null,
        lastResponseAt: null,
        lastMessageAt: null,
      };
      status("Waiting for a scheduled or live stream with chat enabled");
      await sleep(30000, undefined, { signal });
      return;
    }
    const chat = broadcast.snippet.liveChatId,
      video = broadcast.id,
      channel = this.store.token("youtube").user.id;
    this.states.youtube = {
      ...this.states.youtube,
      video,
      title: broadcast.snippet.title || video,
      detail: null,
      lastResponseAt: null,
      lastMessageAt:
        this.states.youtube?.video === video
          ? this.states.youtube.lastMessageAt
          : null,
    };
    status("Connecting");
    void this.emotes.load("youtube", channel);
    const session = new AbortController();
    const stopSession = () => session.abort();
    signal.addEventListener("abort", stopSession, { once: true });
    if (signal.aborted) session.abort();
    const watching = this.watchYoutubeBroadcast(
      broadcast,
      session.signal,
      () => {
        status("Switching to current broadcast");
        session.abort();
      },
    ).catch(() => {});
    const rich = new AbortController();
    const cancel = () => rich.abort();
    session.signal.addEventListener("abort", cancel, { once: true });
    if (session.signal.aborted) rich.abort();
    const enriching = retryLoop(
      rich.signal,
      (s) => this.youtubeRich(video, channel, s),
      () => {
        this.states.youtube = {
          ...this.states.youtube,
          detail: "Native YouTube graphics reconnecting",
        };
      },
    ).catch(() => {});
    try {
      await this.youtubeStream(chat, channel, session.signal, status);
    } finally {
      session.abort();
      rich.abort();
      signal.removeEventListener("abort", stopSession);
      session.signal.removeEventListener("abort", cancel);
      await Promise.all([watching, enriching]);
    }
    if (!signal.aborted) await sleep(1000, undefined, { signal });
  }
  createYoutubeClient() {
    return new proto.youtube.api.v3.V3DataLiveChatMessageService(
      "youtube.googleapis.com:443",
      grpc.credentials.createSsl(),
      { "grpc.keepalive_time_ms": 30000, "grpc.keepalive_timeout_ms": 10000 },
    );
  }
  async youtubeStream(chat, channel, signal, status) {
    const access = await this.oauth.access("youtube");
    if (signal.aborted) return;
    const client = this.createYoutubeClient();
    const metadata = new grpc.Metadata();
    metadata.set("authorization", "Bearer " + access);
    const cursor = this.store.get("youtubeCursor");
    const stream = client.streamList(
      {
        liveChatId: chat,
        part: ["id", "snippet", "authorDetails"],
        ...(cursor?.chat === chat ? { pageToken: cursor.token } : {}),
      },
      metadata,
      { deadline: Date.now() + 25 * 60000 },
    );
    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(firstResponse);
        signal.removeEventListener("abort", abort);
        error ? reject(error) : resolve();
      };
      const abort = () => {
        finish();
        stream.cancel();
      };
      const firstResponse = setTimeout(() => {
        this.states.youtube = {
          ...this.states.youtube,
          error: "No chat response; reconnecting",
        };
        status("Reconnecting");
        finish(new Error("YouTube first response timed out"));
        stream.cancel();
      }, this.youtubeFirstResponseTimeoutMs || 45000);
      signal.addEventListener("abort", abort, { once: true });
      // Headers only confirm transport, not that YouTube accepted this chat.
      stream.on("data", (d) => {
        if (settled || signal.aborted) return;
        clearTimeout(firstResponse);
        this.states.youtube = {
          ...this.states.youtube,
          lastResponseAt: Date.now(),
          error: null,
        };
        status("Connected");
        if (d.nextPageToken)
          this.store.set("youtubeCursor", { chat, token: d.nextPageToken });
        for (const e of d.items || []) {
          const s = e.snippet || {};
          if (s.userBannedDetails)
            this.feed.moderate({
              platform: "youtube",
              channel,
              userId: s.userBannedDetails.bannedUserDetails.channelId,
            });
          else if (s.messageDeletedDetails)
            this.feed.moderate({
              platform: "youtube",
              channel,
              id: s.messageDeletedDetails.deletedMessageId,
            });
          else if (
            s.hasDisplayContent !== false &&
            (s.displayMessage || s.textMessageDetails?.messageText)
          ) {
            this.feed.push(youtubeMessage(e, channel, this.emotes));
            this.states.youtube.lastMessageAt = Date.now();
          }
        }
        if (d.offlineAt) {
          status("Broadcast ended; checking for next stream");
          abort();
        }
      });
      stream.on("error", (e) => {
        if (settled) return;
        this.states.youtube = {
          ...this.states.youtube,
          error: `Chat connection interrupted (code ${e.code}); retrying`,
        };
        status("Reconnecting");
        if (e.code === grpc.status.UNAUTHENTICATED) {
          const t = this.store.token("youtube");
          if (t) this.store.token("youtube", { ...t, expiresAt: 0 });
          e.status = 401;
        }
        if (e.code === grpc.status.RESOURCE_EXHAUSTED) {
          e.status = 429;
          e.retryAfter = 60000;
        }
        if (e.code === grpc.status.INVALID_ARGUMENT)
          this.store.set("youtubeCursor", null);
        if (signal.aborted || e.code === grpc.status.DEADLINE_EXCEEDED)
          finish();
        else finish(e);
      });
      stream.on("end", () => {
        if (!settled) status("Reconnecting");
        finish();
      });
      stream.on("close", () =>
        finish(signal.aborted ? undefined : new Error("YouTube stream closed")),
      );
      if (signal.aborted) abort();
    }).finally(() => client.close());
  }
  async youtubeRich(video, channel, signal) {
    const html = await (
      await request(
        `https://www.youtube.com/live_chat?is_popout=1&v=${encodeURIComponent(video)}`,
        { signal },
      )
    ).text();
    let continuation = html.match(/"continuation":"([^"]+)"/)?.[1];
    const version =
      html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1] ||
      "2.20210128.02.00";
    if (!continuation) throw new Error("No continuation");
    while (!signal.aborted) {
      const d = await json(
        "https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?prettyPrint=false",
        {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: { client: { clientName: "WEB", clientVersion: version } },
            continuation,
          }),
        },
      );
      const chat = d.continuationContents?.liveChatContinuation;
      if (!chat) throw new Error("Chat ended");
      if (signal.aborted) return;
      this.states.youtube = {
        ...this.states.youtube,
        detail: "Native emotes and badge graphics available",
      };
      for (const a of chat.actions || []) {
        if (a.markChatItemAsDeletedAction)
          this.feed.moderate({
            platform: "youtube",
            channel,
            id: a.markChatItemAsDeletedAction.targetItemId,
          });
        if (a.removeChatItemAction)
          this.feed.moderate({
            platform: "youtube",
            channel,
            id: a.removeChatItemAction.targetItemId,
          });
        if (a.markChatItemsByAuthorAsDeletedAction)
          this.feed.moderate({
            platform: "youtube",
            channel,
            userId: a.markChatItemsByAuthorAsDeletedAction.externalChannelId,
          });
        const item =
          a.addChatItemAction?.item || a.replaceChatItemAction?.replacementItem;
        if (item) {
          const renderer = Object.values(item).find(
            (r) => r.id && r.authorName,
          );
          if (renderer)
            this.feed.push(youtubeRenderer(renderer, channel, this.emotes), {
              enrich: true,
            });
        }
      }
      const c = chat.continuations
        ?.map((x) => x.invalidationContinuationData || x.timedContinuationData)
        .find(Boolean);
      if (!c?.continuation) throw new Error("No continuation");
      continuation = c.continuation;
      await sleep(
        Math.max(200, Math.min(3000, c.timeoutMs || 1000)),
        undefined,
        { signal },
      );
    }
  }
}
