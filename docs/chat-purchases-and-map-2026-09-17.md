# Targeted map and chat-command update — September 17, 2026

## Commands
Before this update, the implemented command was `!zs`. Trivia answers remain normal chat messages.

- `!z` and `!zs`: show the sender’s existing Z balance (shared balance cooldown).
- `!buy <reward name>`: buy an enabled Z Market reward. Names are case-insensitive and may contain spaces, for example `!buy Scary Sound`.

Kick’s verified webhook supplies the account and message identity. The command resolves the existing reward by name and calls the same `z_redeem` transaction as the website. That transaction checks balance, stock and cooldown, debits Zs, records the redemption, and queues the configured OBS image/audio alert. The existing chat outbox sends confirmation or a helpful rejection. Duplicate webhook messages cannot charge twice; a deterministic redemption ID also survives receipt cleanup. Duplicate reward names are rejected rather than guessed.

## Files changed
- `Map.jsx`: responsive measurement and full-viewport desktop camera projection.
- `pages/Map.css`: remove desktop canvas clipping and mobile intrinsic-width overflow.
- `components/globe-viewport.mjs`: tested projection calculations.
- `components/HeroMedia.jsx`: remove only the offline Follow Zeek on Kick link.
- `api/kick/webhook.js`: dispatch verified chat messages.
- `server/chat-commands.mjs`: command parsing and aliases.
- `migrations/022_chat_reward_commands.sql`: private transactional command handler.
- `tests/chat-commands.test.mjs`: parsing, identity routing and projection tests.
- `tests/chat-commands.sql`: rollback-only database integration coverage.
- `docs/chat-purchases-and-map-2026-09-17.md`: this report.

## Verification
- All 61 automated tests pass; production build and whitespace checks pass.
- Database integration tests pass for balance replies, purchases with spaced/mixed-case names, atomic debit, configured alert payloads, confirmation, duplicate events/messages, permanent purchase deduplication, insufficient balance, invalid names, stock, cooldowns, ambiguous names and private permissions. Test data and outgoing replies were rolled back.
- Separate browser previews at phone widths 320, 375 and 430 pixels show centered, fully visible globes. Projection calculations also cover widths through 768 and desktop sizes through 2560 × 1440.
- Desktop deep zoom visibly exceeds the former canvas boundary; the navbar and controls remain above it. Camera stops at the globe surface rather than passing inside it.
- Isolated browser overlay receives the purchase-shaped payload, loads an image and plays a generated test tone after browser audio permission. No production Zs or live chat messages were used.

## Limits
A real signed message sent through Kick and playback in the owner’s actual OBS installation were not exercised. The server transaction, routing, shared alert queue and browser player were tested separately. Normal browsers may require Enable audio; OBS must permit browser-source audio. The existing large map bundle still produces a build size warning.

The desktop projection uses the existing Three.js camera’s view offset; see https://threejs.org/docs/pages/PerspectiveCamera.html.
