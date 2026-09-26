# ZeekFusion multichat

A standalone hosted Node service in the ZeekFusion repository. It serves a private `/dashboard`, transparent `/overlay`, and one authenticated WebSocket mixed feed. No AI calls or local streaming companion are used.

## Render Free deployment

Render web service, Node 22.16+, root `multichat`, build `npm ci --ignore-scripts`, start `npm start`, health `/healthz`, plan **Free**, no disk. The included `render.yaml` uses only the free instance.

Render loses its local filesystem on sleep/restart/deploy. All durable state is held in a separate free Supabase project through `migrations/001_state.sql`. A dedicated high-entropy STATE_ACCESS_KEY protects just one encrypted state row; Render uses a publishable/anon STATE_API_KEY, never a Supabase service-role key. Run the migration and provision the singleton with the SHA-256 hash of the dedicated state key. Existing ZeekFusion website tables are not involved.

Set STATE_URL, STATE_API_KEY, STATE_ACCESS_KEY, ADMIN_PASSWORD (16+ characters) and ENCRYPTION_KEY (32+ random characters) in Render. Preserve these values. PUBLIC_ORIGIN is the actual HTTPS origin without a trailing slash; RENDER_EXTERNAL_URL is the default when omitted. External state loads before the HTTP server starts. Initialization fails closed if state is unavailable; it cannot silently replace the OBS key. OAuth grants, refreshed tokens, and settings are saved remotely before reporting success. Routine checkpoints only write changes and run at most once per minute. Optimistic revisions prevent two instances overwriting each other.

The overlay key is generated once and stored in the encrypted external state. The private URL fragment is not sent in HTTP requests, only in the authenticated WebSocket handshake. Read-only overlay access never authorizes dashboard management.

Before streaming, open `/dashboard` or the private overlay URL and allow roughly a minute for Render to wake. Connections start automatically using the restored tokens. The dashboard reports each platform's actual state; YouTube waits for an active broadcast before its live chat can be connected. A linked account alone is not reported as a connected live chat.

The open overlay sends application heartbeat messages to Render every 20 seconds. Render answers, and native ping/pong detects dead peers. A 60-second stale connection reconnects with capped exponential backoff using the same key. The dashboard polls status while open. These are actual inbound requests to Render; responses over server-initiated Twitch/Kick/YouTube connections are not assumed to reset Render's public-ingress idle timer. Kick's signed public HTTP webhooks do count as inbound activity when configured.

After streaming, close the dashboard/overlay and disable the OBS source or use “Shutdown source when not visible”. Otherwise its heartbeats intentionally keep the service awake. No external keep-awake cron or local companion is required. With no inbound traffic, Render can sleep after 15 minutes. Render Free still has monthly usage limits and may restart/suspend services; this is not an uptime guarantee. A separate free Supabase project may pause after prolonged inactivity and need resuming in its dashboard. Render's expiring free Postgres and non-durable free Key Value are intentionally not used.

Add `chat.zeekfusion.com` in Render and its CNAME in DNS. Once verified, use the domain for PUBLIC_ORIGIN and OAuth callbacks. Keep that domain and the saved OBS key unchanged thereafter.

## Connect accounts

- Kick: enter the channel slug in the dashboard. The public Pusher path is the same connection used by Moblin, including selected badges_v2/levels, native status/subscriber badges, replies, deletes, and bans. Public Kick channel discovery can be rejected by datacenter anti-bot protections; this must be verified on the deployed host.
- Twitch: create an app at https://dev.twitch.tv/console/apps, with callback `PUBLIC_ORIGIN/auth/twitch/callback`; store TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET. Connect the broadcaster account once in the dashboard. EventSub receives chat and clear/delete events with user:read:chat. Global and channel-specific badge versions are loaded from Helix.
- YouTube: enable YouTube Data API v3 in Google Cloud, configure an OAuth web app and callback `PUBLIC_ORIGIN/auth/youtube/callback`; store YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET. Connect your channel once. For durable refresh tokens, move your OAuth consent app out of external Testing (testing refresh tokens normally expire in seven days). Verification may be required by Google. The service automatically finds the account’s active broadcast every 30 seconds while offline.
- Optional Kick official backup: create a dedicated Kick developer app, set callback `PUBLIC_ORIGIN/auth/kick/callback`, configure webhook `PUBLIC_ORIGIN/webhooks/kick`, store KICK_CLIENT_ID/KICK_CLIENT_SECRET, and authorize from the dashboard. Do not replace the existing ZeekFusion website’s Kick webhook. Signed official messages deduplicate against the richer Pusher path.

## Behavior and limitations

Messages use platform timestamps where available, a 40 ms buffer, and stable chronological insertion. Cross-platform order cannot be perfect when providers deliver late events or omit timestamps. No extra network wait is added for emote catalogs. The overlay keeps at most 200 messages. Third-party emote catalogs cache for five minutes, loading independently so one failed provider does not block chat.

Tokens and the external state snapshot are AES-256-GCM encrypted with automatic refresh and single-flight rotation. SQLite is only an in-memory cache in the free deployment. Provider loops back off independently. YouTube uses the official gRPC streamList for low-latency messages and resumes by page token, plus Moblin’s web-chat continuation endpoint for native emoji, custom membership badge imagery, and deletion events omitted by the official stream. The web endpoint is unofficial and can change. The dashboard must not imply graphical enrichment works when it is unavailable. Role labels are used when the platform supplies a role but no image, rather than inventing a badge or level.

The current build still requires live authorized platform testing, screenshots for exact visual matching, and deployment verification. Automated fixture tests do not establish production platform compatibility. Initial sample messages are confined to `/preview`; the actual `/overlay` never generates fake chat.

The most recent 20 minutes of chat are retained and checkpointed in encrypted storage. The overlay loads 100 messages initially and requests older pages when scrolled upward. It follows live chat only while at the bottom; returning to the bottom resumes following. Deduplication and deletion tombstones persist to prevent deleted messages resurfacing. Checkpoints occur every 60 seconds and on graceful shutdown; security-critical token writes are immediate. Platform events during an outage cannot always be recovered. Cold starts and deployments interrupt connections; OBS reconnects automatically.

## Tests and development

`npm ci --ignore-scripts`, `npm test`. Tests exercise ordering, deduplication, deletion-before-delivery, bans, platform isolation, history limits, badge/emote normalization, encrypted restart recovery, dashboard CSRF/authentication, read-only WebSocket access, OAuth state, and refresh concurrency. Local preview: set development-only ADMIN_PASSWORD and ENCRYPTION_KEY plus PUBLIC_ORIGIN=http://localhost:8787, then `npm start`.

No application secrets or chat content are written to request logs. Upstream badge/emote images load directly over HTTPS and benefit from browser/CDN caching. Assets are rendered as text nodes or validated image URLs, never chat-authored HTML.

## Source and licensing

Moblin current source was inspected at commit acd6fa4df534c770a2abbe89476dccfcf5e0e836. See `vendor/NOTICE.md`, MIT attribution, and Google sample Apache license.

## OBS and reader independence

Use the existing `/overlay#<private-key>` URL in OBS. It is live-only: gestures cannot pause it, it keeps at most 200 rendered rows, and layout changes always return it to the newest message. The separate `/reader#<same-private-key>` URL (dashboard → Open chat reader) supports 20-minute paged history and a Jump to newest button. Each document owns its own connection, data, and scroll state; neither uses shared browser storage.

Live events render without waiting for animation frames, which can be suspended in hidden browser sources. A stale connection is replaced without waiting for its close handshake. Online, visibility, and restored-page events check connection health. Reconnect snapshots reconcile all retained 20-minute history, including deletions and edits, rather than only 100 recent rows. Beyond that retention window, or if an upstream platform never delivered an event, complete replay cannot be guaranteed. Twitch EventSub and the public Kick socket do not offer chat history replay for their own upstream outages.

### Reward/activity support

- Twitch: custom redemptions (EventSub v1) and automatic redemptions (v2). Reconnect Twitch once to consent to `channel:read:redemptions`; existing chat keeps working without that permission. Dashboard reward status confirms subscription success. No redemption-management permission is requested.
- Kick: signed `channel.reward.redemption.updated` webhook; stable redemption IDs prevent repeat rows as status changes. Requires a Kick developer app, its webhook URL set to `https://<your-host>/webhooks/kick`, client credentials, and authorization with `events:subscribe`. Public Pusher chat alone is not a documented reward subscription. Existing public chat does not depend on this setup.
- YouTube: Super Chats, Super Stickers, memberships/milestones, membership gifts and gift events from the existing live-chat API. The API does not expose a Twitch-style custom channel-points redemption event. No extra scope is needed for the supported events.

Sources: [Twitch EventSub](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/), [Kick webhook payloads](https://github.com/KickEngineering/KickDevDocs/blob/main/events/event-types.md), [YouTube live chat types](https://developers.google.com/youtube/v3/live/docs/liveChatMessages).

### Reproducible browser test

Run `node tests/browser-server.mjs`, open `http://localhost:8787/test` in Chrome, and click Run three-minute independence test. This isolated server uses production views and real WebSockets, with fixtures through all three platform normalizers. It deliberately delivers duplicate upstream messages, holds the reader in old history for three minutes, checks every batch in both views and the reader anchor, resizes OBS to 160/260/450/800px, hides/restores its viewport, terminates both sockets, inserts 250 messages while disconnected, and verifies automatic replay, deletion, chronological order and jump-to-live. It sends no public platform chat and exposes no test endpoints in production. Run `npm test` for automated transport, history, OAuth, moderation, badge, emote and reward checks.
