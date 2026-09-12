# ZeekFusion security and privacy review — September 12, 2026

## Changes delivered

- Homepage streaming buttons share dimensions, padding and fixed icon/arrow columns. Added the Discord community link and official icon.
- Replaced the calendar with blue Vault artwork. Kept the original portrait, with subtle clipped eye movement (maximum 3.2 horizontal / 1.8 vertical source-image pixels). Pointer leave and blur recenter; touch and reduced-motion preferences disable the overlay.
- Added database-backed rate limits to public APIs, session lookups, OAuth, games and authenticated writes. Keys use keyed hashes rather than storing raw IP addresses. Production identity uses Vercel's protected forwarded header; local requests use the socket address. See [Vercel request headers](https://vercel.com/docs/headers/request-headers).
- Rejected malformed/oversized JSON, repeated query values and invalid game actions, versions, cells and enum inputs. Existing exact wager, identifier and configuration validation remains in place.
- Public activity now reads curated activity events rather than private transaction reasons. Retired the legacy setup endpoint that could disclose provider responses. Unexpected errors return generic messages.
- Added atomic webhook receipt processing alongside signature, timestamp, broadcaster and payload validation. Duplicate events cannot award twice; failed processing rolls back the receipt. Existing per-user balance-command cooldown remains.
- Added database checks against negative balance/lifetime totals and fixed redemption-refund lock order to match redemption creation.
- Reasserted row-level security and removed anonymous/authenticated direct table and function permissions for Z data. Server service access remains; user/admin authorization is checked before privileged operations.
- Added CSP, HSTS, frame denial, MIME sniff protection, referrer and permissions policies. Same-origin writes also reject cross-site Fetch Metadata.
- Updated vulnerable dependencies; removed tracked dependency caches from the current repository snapshot and ignored dependencies, builds, local environment files and deployment metadata.

## Existing protections reviewed

Kick OAuth state and PKCE, encrypted provider tokens, hashed sessions and secure HttpOnly cookies; server-owned admin ID; cryptographic game outcomes; private Mines/decks/RPS state; integer wager accounting; locked balances; idempotent request IDs; optimistic game versions; transactional payouts/refunds and manual adjustments; webhook raw-body verification; single-use scheduler credentials. No client-generated result is accepted as authoritative.

## Validation

- All 33 application tests pass, including nine new security regressions.
- Seven database test groups pass in isolated PostgreSQL-compatible PGlite: base database, Arcade, expansion, duels/management, Blackjack, Clips and security. Production scheduler migrations were excluded from this local harness because they depend on pg_cron. Tests use temporary fixtures and transaction rollback.
- Production build passes. Dependency audit reports zero known advisories at review time.
- Production read-only audit found zero Z tables with unsafe anonymous permissions, zero exposed Z functions and zero negative balances. Migration 018 installed successfully.
- Generated output scan found no legal-name matches, local home-directory paths, private-key markers or tested secret prefixes. No source maps are generated. Public API payloads are explicitly selected; private admin notes are no longer used for the public feed.
- Browser checks confirm identical 310 × 52 desktop buttons and 308 × 52 mobile buttons, matching arrow positions, no horizontal overflow at 390px, bounded eye movement, and the Discord destination.
- Real balances were not spent, adjusted or reset for testing.

## Remaining risks and limits

1. Older public Git commits retain the previous author identity and previously tracked caches. The current source/build and new author identity are cleaned, but erasing old Git history requires a coordinated history rewrite; existing forks and external caches cannot be guaranteed erased.
2. Third-party video embeds, thumbnails and external links disclose ordinary connection information to their providers. This review does not remove those requested integrations or establish their retention policies.
3. Application limits reduce abuse but do not replace edge DDoS protection. Hosting-account MFA, access memberships, backup restoration and external provider security are not certified by this code review.
4. Database transaction and locking behavior was reviewed and regression tested; this was not an independent penetration test or a production parallel-load test. Monitor failures and unusual balance activity after release.
5. CSP permits inline styles required by the existing React/3D presentation, while scripts remain restricted to this origin. Keep dependency audits and key/session maintenance ongoing. Zero current dependency advisories is not a guarantee of future safety.
6. Existing logs, backups, provider dashboards and historical third-party content are outside the generated public-site scan. A complete internet-wide removal of private information cannot be claimed.

## Artwork record

Asset: `public/images/z-vault-arena.png` (AI-generated).

Prompt intent: cinematic futuristic electric-blue steel circular gaming vault with Z emblem, glowing tokens and circuit traces concentrated on the right 55%; nearly black left 45% for readable overlay text; landscape 3:2; no calendar, money text or people. The attached agency reference contributed only the eye-following concept, not its layout or branding.
