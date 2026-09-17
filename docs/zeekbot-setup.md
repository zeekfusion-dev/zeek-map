# ZeekBot connection and command update

## One-time setup

1. Create the real Kick account **ZeekBot**, including any account verification Kick requires.
2. In Kick developer settings, create a **separate OAuth app for ZeekBot chat**. Set its redirect URL to `https://www.zeekfusion.com/api/kick/callback`. Keep the existing website/streamer app and webhook subscriptions intact.
3. In the Vercel project's production environment variables, securely set `KICK_BOT_CLIENT_ID` and `KICK_BOT_CLIENT_SECRET` from that new app, then redeploy. Do not paste secrets or passwords into chat. `KICK_BOT_USERNAME` defaults to `ZeekBot`. Optionally pin its numeric ID with `KICK_BOT_USER_ID` as an extra check.
4. Sign into ZeekFusion.com with the **ZeekFusion** owner account. Keep this website session open. In another tab in that same browser, switch the Kick website login to **ZeekBot**. Switching Kick's login does not replace the website's separate owner session.
5. Return to Z Market → Owner Controls → **Connect ZeekBot**. Approve `user:read` and `chat:write` while Kick identifies the account as ZeekBot. If Kick shows ZeekFusion, stop and switch the Kick account first.
6. Controls should show **Chat sender: ZeekBot**. You can then switch the Kick website back to your streamer account. The website never signs you in as the bot or gives the bot owner access.
7. In your channel, check `!z`, `!zcommand` and an intentional reward purchase. The sender should be the actual ZeekBot account. If channel chat restrictions reject the bot, adjust the account's channel permissions as appropriate.

The separate app is used only for ZeekBot authorization and refresh. Existing streamer app credentials continue supporting website login and current webhook subscriptions. Bot access and refresh tokens are encrypted server-side, stored separately from viewer/owner sessions, and rejected unless their verified identity is ZeekBot and is not the streamer ID. Refresh rechecks that the identity has not changed. Legacy streamer tokens cannot be used for automated chat. There is no fallback sender.

## Commands

- `!z` / `!zs`: existing balance, with `zeekfusion.com/#/market`.
- `!buy <reward name>`: existing shared reward redemption pipeline.
- `!zcommand` / `!zcommands`: help generated directly from the same command registry used by dispatch.

The actual route is `/market` in `App.jsx`; `/vault` is only a compatibility redirect.

## Duplicate prevention

The database deduplicates incoming events and Kick message IDs, then inserts one uniquely keyed outbox row. Purchases retain their deterministic redemption ID. Help has a per-user cooldown. Outbox workers atomically claim each pending row before contacting Kick, even if a worker lock expires. Ambiguous network sends are marked failed and are not automatically replayed; this trades possible missing replies for avoiding duplicate messages. Stale non-round replies are cancelled after two minutes rather than appearing as a reconnect backlog. New commands after a successful connection produce new replies; failed old replies are not replayed.

## Verification and status

67 automated tests passed. Coverage includes real-token sender selection with mocked provider responses, rejection of streamer/wrong-account grants, separate client credentials during refresh, owner-only connection, unchanged owner session after bot OAuth, account changes during refresh, concurrent outbox claims, no retry after ambiguous delivery, registry-derived help and current Market route. Rollback-only SQL checks passed for help, event/message deduplication, rate limits, Market balance URL, private permissions, and all previous reward purchase cases. Production build passed.

Actual ZeekBot account creation, app credentials and user OAuth consent are required before live chat verification. Automated chat replies and trivia posts remain paused until then; balances, rewards, overlays and viewer login remain intact.

Official references: [Kick OAuth](https://docs.kick.com/getting-started/generating-tokens-oauth2-flow) and [Chat API](https://docs.kick.com/apis/chat). Sending `type: user` uses the account that authorized the token and targets ZeekFusion's channel. It does not change or imitate the sender's username.
