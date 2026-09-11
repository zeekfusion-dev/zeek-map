# ZeekFusion Z Vault

The existing React/Vite site remains on GitHub → Vercel. Supabase owns balances,
transactions, questions, redemptions, giveaway entries, sessions and the scheduler.

## Launch defaults

- Question winner: 1 Z, every 30 minutes while live, 60 seconds to answer.
- Paid subscriptions, renewals, gifts, KICKs, and donations never award Zs.
- BotRix conversions: enabled, 1,000 verified free-earned points per Z, cap 5 Zs/week.
- Decimals: two places. The legacy KICKs award function is retired.
- No reward products or giveaways are automatically opened. Owner creates them.
- Giveaways use one free entry per Kick account, independent of Z balance.
- Zs have no cash value. Rates are adjustable prospectively from owner Controls.

## Installation

Apply migrations 001, 003, 004, 005, then 002 and 006–009 in Supabase SQL Editor. Existing
balances remain numerically unchanged. Run `tests/database.sql` inside a
transaction and ROLLBACK to validate against a disposable/isolated test state.
The first deployment uses the already configured SUPABASE_URL,
SUPABASE_SECRET_KEY, KICK_CLIENT_ID, KICK_CLIENT_SECRET, KICK_REDIRECT_URI.
The redirect URI must be https://www.zeekfusion.com/api/kick/callback.

Owner setup can start directly at /api/kick/login?bot=1 (the callback verifies
the broadcaster ID before storing anything). Alternatively, visit /#/vault and
sign in with the ZeekFusion Kick account. Controls → Activate
Kick bot requests user:read and chat:write and stores encrypted refreshable
tokens server-side. Viewer login requests only user:read. The cron job is dormant
until a bot token exists. It then checks live status every minute and asks at the
configured cadence. An offline response closes pending/open rounds. Timer errors
and ambiguous chat delivery failures are visible in Controls.

The existing six Kick event subscriptions are reused. The legacy test-z endpoint
is retired. Webhook processing verifies the signature over raw bytes, the
broadcaster, and timestamp, and uses unique transaction IDs to deduplicate awards.
KICK_SETUP_KEY still protects the existing subscription setup route.

## Behavior and operations

Question answers are matched as complete normalized phrases, ignoring case,
punctuation and diacritics. The first valid answer transaction received wins;
messages before the question opens or after expiry are excluded. The broadcaster
cannot win. All answers remain server-side. `!zs` is limited to once per viewer
per 30 seconds. Ordinary chat is never permanently logged.

Outbox posts are claimed before sending. A network failure with unknown delivery
status is surfaced rather than automatically replayed, avoiding duplicate chat
posts. Such a failed question is cancelled and the next scheduled question can
proceed. Owner Controls can reconnect tokens and check live status.

Rewards deduct balances atomically with stock and the request ledger. Refunds
are idempotent. Manual adjustments require reasons. BotRix conversions require
manual verification AND deduction in BotRix before owner approval; the website
does not imply or attempt a BotRix API integration. Defaults and caps are edited
in Controls.

Giveaway draws use crypto.randomInt across the full entry count after closing,
with a row lock and one final result. Only the owner can create or draw. Supply
prize details and rules before opening entries. No giveaways are seeded.

All Z tables use RLS and deny anon/authenticated database access. The API exposes
only curated public leaderboard/activity data; viewer-specific data requires an
HttpOnly session. Owner actions require Kick ID 20306616 and same-origin POST.
OAuth uses PKCE, state, an encrypted short-lived cookie and encrypted bot tokens.
Changing KICK_CLIENT_SECRET invalidates stored bot tokens; reconnect afterward.

## Validation

`node --test tests/*.test.mjs`
`npm run build`

Database tests cover decimal awards, duplicate deliveries, overdrafts, stock,
redemption/refund idempotency, answer timing, one winner, rejection of paid KICKs and
public privilege restrictions. No purchases or production test rewards needed.

## Existing homepage work

The uncommitted Mainframe video experiment is preserved in the original Desktop
checkout. Home and Vault now share one responsive navigation component. The live static
face remains in place until Zeek's own animation is ready.

## Community Arena

The Overview has a balance/rank/recent-result header, horizontal Top 5, and a
real activity feed. The complete leaderboard has its own paginated section.
Arcade, How It Works, Rewards, Giveaways, My activity, and owner Controls are
separate tabs. No missions or fabricated production activity are seeded.

Coin Flip reserves 1–100 whole Zs when posted; it remains open while the creator
is offline. Up to five open challenges per player. The opponent matches the
stake and a cryptographically random server coin decides the winner. The full
pot is paid atomically; cancelled open challenges refund the creator once.
Plinko uses eight server-generated independent binary turns. Total-return
multipliers left to right are 8, 2, 1.5, .75, .5, .75, 1.5, 2, 8. The 256 equally
likely paths give 98.046875% mean return. The board animates the recorded path.
No client-supplied outcome or multiplier is accepted. Creation is rate-limited
to one new game every two seconds. Request IDs make network retries idempotent.

Arcade transfers use a dedicated ledger operation: refunds and returned stakes
never inflate all-time earnings. Only net positive game profit counts toward
rank. Row locks serialize competing accepts, cancellation and balance spending;
account locks are ordered consistently for two-account settlements. Game,
rank, three-game streak, trivia and redemption events enter the activity feed.

Historic paid/converted credits are conservatively excluded from wagers while
remaining spendable on stream interactions. There is no migration balance reset.
BotRix approvals require verified free-activity provenance (including historical
points), actual deduction and recorded proof. A database trigger enforces the
approval marker. The site does not change BotRix settings or deduct points there;
the owner must disable all paid point rewards and exclude historic paid points.
Zs cannot be bought or converted to cash, merchandise, or gift cards.

Run tests/arcade-database.sql inside BEGIN/ROLLBACK on a test transaction.
Rollback verification covers escrow, settlement, duplicate requests, immutable
outcomes on retries, self/third-player rejection, cancellation, legacy exclusions,
paid-credit rejection, activity publishing, and denied public database privileges.
Browser layout checks used local-only fixtures that are never deployed.
