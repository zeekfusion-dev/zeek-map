# Reward alerts and Market refinements

Owner Controls → reward editor supports title, description, Z price, thumbnail, stream image/GIF, audio, duration (2–120 seconds), volume (0–100%), global reward cooldown (0–86400 seconds), enabled status and finite/unlimited stock. Raster image uploads are limited to 10 MB, audio to 20 MB. Files are public stream assets; upload signing requires the server-verified owner account. Preview plays locally without a purchase or OBS event.

Owner Controls → Stream reward alerts provides a private OBS Browser Source URL. Suggested canvas: 1920 × 1080. Keep the source active (disable “Shutdown source when not visible” and “Refresh browser when scene becomes active”). OBS audio must be enabled; normal browsers may require the Enable audio button. Do not share the private URL. Replace it in Controls if exposed, then update OBS.

## Transaction and delivery design

Migration 021 adds the alert outbox and settings. A successful purchase holds the reward row lock, validates stock/cooldown, atomically debits the user, records the redemption and snapshots one alert. Unique redemption IDs make retries idempotent. Rejected transactions do not emit an alert. Pending alerts are cancelled on refund.

A [Supabase database broadcast](https://supabase.com/docs/guides/realtime/broadcast) carries only a payloadless wake-up. It is not trusted to authorize playback. An HMAC capability in the overlay URL fragment authorizes server queue claims. No database/service credentials are exposed. The browser receives only the existing public publishable key. RLS and grants prohibit direct client access to queue/settings tables and claim/finish functions.

One global queue lock and expiring claim leases serialize consumers. A repeated claim by the same client returns the current alert; another client waits for the lease. Completion is idempotent and tied to the claimant. The consumer drains on subscribe/reconnect, broadcasts and completion; it makes no periodic idle HTTP requests. Errors use capped exponential retries. Images/audio preload together, then display/play for the saved duration. Each asset stops before the next alert. A failed acknowledgement does not replay an item within the current browser instance.

## Practical limits

- A browser crash during playback may replay that interrupted alert after its lease expires. Exactly-once physical audio playback cannot be guaranteed across crashes.
- Keep one persistent OBS source active. An inactive/closed source leaves alerts queued for its return; leases recover abandoned playback.
- External media can disappear or block loading. Uploading assets is more reliable. Files uploaded here are intentionally public.
- MC Sound On/Off is wired to an owner-configured looping music track, off by default. No Minecraft recording was supplied, so no track is installed yet. Add it through Owner Controls → MC menu music.

## Verification

- Full automated suite, including settings/media validation, authorization, forged overlay access, queue serialization, lost acknowledgement recovery and idle behavior.
- Database regression transaction rolled back after checking duplicate debit prevention, cooldown, stock, insufficient funds, snapshots, FIFO ordering, lease recovery, acknowledgement ownership/idempotency, refund cancellation and access grants.
- Real Supabase broadcast successfully woke an isolated local overlay and drained two local-only queued rewards in order. A third media test exercised browser autoplay blocking, and a subsequent user gesture successfully started audio. No production reward or stream alert was created by these previews.
- Migration preserved the existing 74 Zs balance and 102.75 lifetime-earned Zs.
- Desktop MC menu verified flush against navbar and filling the available viewport. Responsive styles preserved; browser viewport override was unavailable in this session, so new mobile rendering could not be independently verified.

Other changes: BotRix tickets show the stored Kick username, current/lifetime leaderboard tabs, current-balance podium/rank, requested copy removals, and removal of the redundant Market Arena banner. Existing games and rewards remain.
