# ZeekFusion login data and bot review — September 16, 2026

## What to tell a viewer

“When you sign in with Kick, ZeekFusion stores your Kick username, Kick account ID, and a secure login-session record in our Supabase database. When you use the points and games features, we also store the records needed for your balance, game results, rewards, and entries. Our login implementation does not save your email address, profile image, or Kick password. Ordinary viewer Kick access tokens are used during sign-in and are not saved to our database.”

This describes the application implementation. Kick, Supabase, and Vercel also operate their own systems and logs; it is not a claim about every provider's retention policy.

## Where login data goes

The browser redirects to Kick. Vercel-hosted server code handles the OAuth callback, verifies the Kick identity, and creates a separate website session. Application records are stored in the Supabase PostgreSQL project used by this site. This is a custom session system, not Supabase Auth user registration. No public user-directory page was added.

| Information | Stored by this application? | Location / lifecycle |
|---|---|---|
| Kick username | Yes | `z_sessions.username`; also `z_users.username` and feature records after participation |
| Kick user ID | Yes | `z_sessions.kick_user_id`; stable identity for points and feature records |
| Email address | Not persisted by the login implementation | A Kick identity response may include extra fields, but only `user_id` and `name` are used to create the session |
| Profile image / biography | Not persisted by the login implementation | Any additional identity-response fields are transient; the site's ZeekFusion artwork is a site asset |
| Kick password | No | Authentication occurs at Kick |
| Ordinary viewer OAuth access / refresh tokens | Not persisted | Returned to the server during authentication; access token used to verify identity, then no database write or application cache retains either token |
| OAuth state and PKCE verifier | Temporarily | Encrypted `z_oauth` browser cookie, 10-minute lifetime, Secure / HttpOnly / SameSite=Lax; cleared on completion/failure |
| Website session token | Yes, but only its SHA-256 hash in the DB | Random raw token in Secure / HttpOnly / SameSite=Lax `z_session` browser cookie; `z_sessions` stores hash, ID, username and expiration; 7-day lifetime |
| Owner's Kick bot access / refresh tokens | Yes, encrypted | `z_bot.encrypted_tokens`; AES-256-GCM, encrypted using a key derived from the server-only Kick client secret; needed for ongoing chat posting / refresh |
| App-level Kick token | Temporarily | Server-process memory cache with expiration; used for channel status |
| Connected creator social tokens / app credentials | Yes, encrypted when configured | `z_social_connections.app_cipher` and `token_cipher`; separate from viewer login |

Logging in alone creates a session row. `z_users` and other participation records are created/updated by points, conversion, reward, chat-command and game operations, rather than the OAuth callback itself. Usernames copied into older records may reflect the name used at the time.

## Supabase tables containing user-related information

- `z_sessions`: username, Kick ID, hashed session token, expiration.
- `z_users`: Kick ID, username, current and lifetime Zs, timestamps, legacy Arcade eligibility balance. Live table columns were checked.
- `z_transactions`: Kick ID, amount, reason, deduplication/event identifier, metadata, timestamp.
- `z_rounds`: trivia winner ID/username, question/answers, reward and times.
- `z_redemptions`: requesting Kick ID, reward, cost, fulfillment status and date.
- `z_conversion_tickets`: requesting Kick ID, BotRix points, proposed Zs, approval status, moderator deduction note and dates.
- `z_games`: participant IDs/names, stakes, outcome, payouts and times.
- `z_game_steps`: actor ID and idempotent game-response receipts.
- `z_run_secrets`, `z_rps_secrets`, `z_blackjack_secrets`: game secrets linked by game ID; indirectly linked to participants.
- `z_activity`: public usernames and community activity/results, amounts and dates.
- `z_giveaway_entries`, `z_giveaways`: entrant/winner IDs and usernames.
- `z_admin_log`: owner ID, action and details, which can include affected IDs, names and adjustment reasons.
- `z_command_limits`: Kick ID and last balance-command time.
- `z_webhook_receipts`: webhook event IDs/timestamps used to reject duplicate deliveries; no full chat transcript.
- `z_outbox`: generated outgoing messages, potentially mentioning usernames/balances; delivery status and deduplication keys.
- `z_rate_limits`: keyed HMAC identifiers derived from an IP or account ID, counts and expiration; no raw IP column.
- `z_bot`: encrypted owner bot credentials.
- `z_social_connections`: connected creator account information and encrypted connection credentials.
- `z_kicks_events`, `z_kicks_remainders`: legacy paid-event records keyed by Kick ID. Paid earning is disabled; historic records were not deleted.

`z_runtime` holds channel/bot status, not a viewer profile. `z_clips` contains public creator video metadata. Site content contains public editorial material. No race-named table exists in this project's public schema, and no Bought Race Tickets UI exists in the synced repository; the requested race-label change needs the actual implementation identified first.

## Access and retention

The site's server performs identity/owner checks and accesses Supabase with a server-only credential. The hardening migration enables RLS and denies anonymous/authenticated direct table/RPC access. The database regression checks verify these grants. Public endpoints deliberately expose leaderboard usernames/balances and activity/results; private session tokens, emails, game secrets, and moderator notes are not intentionally included.

Expired sessions are removed by the minute scheduler and opportunistic cleanup. Webhook receipt cleanup removes records older than a day in batches. Rate-limit entries older than expiry plus an hour are cleaned opportunistically. These are batch cleanup mechanisms, not strict deletion-at-the-exact-expiry guarantees. Most ledger, game, moderation and giveaway records have no automatic retention/deletion policy in the code. Logout deletes the current session, not participation history.

No major privacy architecture changes were made. Potential improvements to discuss first: define retention/deletion rules for old game receipts and moderation notes; review legacy paid-event records; minimize token-response fields saved for the owner; review Vercel/Supabase logs and backups. OAuth callbacks contain a temporary authorization code in the URL, so provider request logs deserve attention. Database failure logs can include up to 300 characters of provider error text. Encryption relies on the same server secret used for Kick, so rotating that secret needs a planned token re-encryption or reconnection process.

## Bot findings

- Supabase's question scheduler is enabled every minute; recent cron executions succeeded.
- Twelve consecutive recent scheduled HTTP responses were 200, with no timeouts, during this inspection. Vercel also showed successful `/api/z/tick` requests.
- A historical timeout was retained in `z_runtime.bot_error`, even after healthy offline timer checks. The code only cleared that field after sending a chat message. Scheduler errors now have a separate `tick_error` field and clear on successful checks, without masking unresolved chat-delivery errors.
- Chat webhook events were excluded from `last_webhook_at` updates. Accepted, deduplicated chat receipts now update it inside the database transaction. Signature checking and replay protection remain intact.
- The stored bot connection was updated September 16 at 21:38 UTC. This confirms a saved connection, not a live send test.
- No webhook receipts remained for the previous 24 hours. The previous status timestamp was September 15 at 04:16 UTC; before this change that field excluded chat and cannot establish the last chat event.
- The outbox contained one confirmed sent message and no failed/sending messages. The channel was offline. No evidence of a current schema/write failure appeared in the checks.
- Vercel's available last-hour error-filtered entries were Node `url.parse()` deprecation warnings on successful requests, not failed bot deliveries. Older history requires a higher Vercel log-retention plan; no plan change was made.

A complete live inbound/outbound verification still needs an actual Kick chat event (`!zs`) and a live trivia round. I did not spoof events, publish a test chat message, or claim delivery was verified while offline. Event subscription configuration at Kick has not been independently verified from these logs.
