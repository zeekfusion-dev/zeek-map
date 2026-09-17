# ZeekFusion multichat

A standalone hosted Node service in the ZeekFusion repository. It serves a private `/dashboard`, transparent `/overlay`, and one authenticated WebSocket mixed feed. No AI calls or local streaming companion are used.

## Deployment

Render web service, Node 22.16+, root `multichat`, build `npm ci --ignore-scripts`, start `npm start`, health `/healthz`. Use an always-running paid instance and a 1 GB persistent disk at `/var/data`; set `DATA_PATH=/var/data/chat.sqlite`. Run only one instance because the feed and SQLite writer are single-process. The included `render.yaml` describes this setup. Free sleeping instances and ephemeral disks do not meet the reliability requirement.

Set PUBLIC_ORIGIN to the actual HTTPS service origin (without a trailing slash), ADMIN_PASSWORD to a unique password of at least 16 characters, and ENCRYPTION_KEY to a randomly generated value of at least 32 characters. Preserve the encryption key and disk across redeployments. Do not commit secrets. The private overlay key is generated once and stored on the disk; its URL fragment is not sent in HTTP requests. It is passed as the first WebSocket frame. It authorizes read-only chat access, never dashboard management.

Add the custom domain `chat.zeekfusion.com` in Render and its CNAME in the domain’s DNS. After the domain is verified, use it for PUBLIC_ORIGIN and provider callbacks, then restart the service.

## Connect accounts

- Kick: enter the channel slug in the dashboard. The public Pusher path is the same connection used by Moblin, including selected badges_v2/levels, native status/subscriber badges, replies, deletes, and bans. Public Kick channel discovery can be rejected by datacenter anti-bot protections; this must be verified on the deployed host.
- Twitch: create an app at https://dev.twitch.tv/console/apps, with callback `PUBLIC_ORIGIN/auth/twitch/callback`; store TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET. Connect the broadcaster account once in the dashboard. EventSub receives chat and clear/delete events with user:read:chat. Global and channel-specific badge versions are loaded from Helix.
- YouTube: enable YouTube Data API v3 in Google Cloud, configure an OAuth web app and callback `PUBLIC_ORIGIN/auth/youtube/callback`; store YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET. Connect your channel once. For durable refresh tokens, move your OAuth consent app out of external Testing (testing refresh tokens normally expire in seven days). Verification may be required by Google. The service automatically finds the account’s active broadcast every 30 seconds while offline.
- Optional Kick official backup: create a dedicated Kick developer app, set callback `PUBLIC_ORIGIN/auth/kick/callback`, configure webhook `PUBLIC_ORIGIN/webhooks/kick`, store KICK_CLIENT_ID/KICK_CLIENT_SECRET, and authorize from the dashboard. Do not replace the existing ZeekFusion website’s Kick webhook. Signed official messages deduplicate against the richer Pusher path.

## Behavior and limitations

Messages use platform timestamps where available, a 40 ms buffer, and stable chronological insertion. Cross-platform order cannot be perfect when providers deliver late events or omit timestamps. No extra network wait is added for emote catalogs. The overlay keeps at most 200 messages. Third-party emote catalogs cache for five minutes, loading independently so one failed provider does not block chat.

Tokens are AES-256-GCM encrypted in SQLite with automatic refresh and single-flight rotation. Provider loops back off independently. YouTube uses the official gRPC streamList for low-latency messages and resumes by page token, plus Moblin’s web-chat continuation endpoint for native emoji, custom membership badge imagery, and deletion events omitted by the official stream. The web endpoint is unofficial and can change. The dashboard must not imply graphical enrichment works when it is unavailable. Role labels are used when the platform supplies a role but no image, rather than inventing a badge or level.

The current build still requires live authorized platform testing, screenshots for exact visual matching, and deployment verification. Automated fixture tests do not establish production platform compatibility. Initial sample messages are confined to `/preview`; the actual `/overlay` never generates fake chat.

The recent feed is intentionally not replayed after a server restart; deduplication and deletion tombstones persist to prevent old/deleted messages resurfacing. Checkpoints occur every 15 seconds and on graceful shutdown. Platform events during an outage cannot always be recovered. A single persistent-disk instance has a short interruption on deployment; OBS reconnects automatically.

## Tests and development

`npm ci --ignore-scripts`, `npm test`. Tests exercise ordering, deduplication, deletion-before-delivery, bans, platform isolation, history limits, badge/emote normalization, encrypted restart recovery, dashboard CSRF/authentication, read-only WebSocket access, OAuth state, and refresh concurrency. Local preview: set development-only ADMIN_PASSWORD and ENCRYPTION_KEY plus PUBLIC_ORIGIN=http://localhost:8787, then `npm start`.

No application secrets or chat content are written to request logs. Upstream badge/emote images load directly over HTTPS and benefit from browser/CDN caching. Assets are rendered as text nodes or validated image URLs, never chat-authored HTML.

## Source and licensing

Moblin current source was inspected at commit acd6fa4df534c770a2abbe89476dccfcf5e0e836. See `vendor/NOTICE.md`, MIT attribution, and Google sample Apache license.
