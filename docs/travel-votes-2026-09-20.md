# Start Here and destination voting

Start Here has three equal desktop columns (rankings, wallet/help, reward preview) and stacks below 900px. Live Activity remains available; Live Trivia now has a dedicated navigation entry. All rewards remain in the full shop; the overview previews four. No reward, account, or Z data was removed.

Travel voting uses `/api/site?votes=1` and migration 027. The States and Countries tabs share three votes total, with no scheduled reset. Votes may be allocated repeatedly to the same destination. Totals refresh every 10 seconds while the open panel is visible and immediately after a vote.

The server validates the Kick session; guests receive a signed/encrypted, HttpOnly, Secure, SameSite device cookie lasting a year. Only its hash is stored. Account and device identities are merged on sign-in; existing votes remain counted. Linked devices retain the same allowance after logout. If two previously independent identities already cast votes, merging retains all votes and grants no remaining allowance. Shared browsers therefore share an allowance. Clearing cookies, another browser, or a new device can bypass anonymous identification; the site cannot identify a unique human without sign-in. Network and identity rate limits reduce automated abuse but are not proof of personhood.

A database advisory transaction lock serializes allowance checks, identity merges and inserts. Request UUIDs provide idempotency, and replay with changed identity/destination is rejected. RLS blocks direct public table access and only the backend service role may execute the function. Public responses expose aggregate counts and the caller's remaining allowance, never identities or vote history.

The old sample/browser-local counts were not imported as real votes. Real totals start from zero. Tests cover input validation, signed cookies, same-origin enforcement, SQL cap/retry/account merge/logout/permissions checks with rollback. No test votes persist.
