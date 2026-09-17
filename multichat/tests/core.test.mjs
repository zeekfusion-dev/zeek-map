import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Feed } from "../src/feed.mjs";
import { Emotes } from "../src/emotes.mjs";
import {
  kickMessage,
  twitchMessage,
  youtubeRenderer,
  youtubeMessage,
} from "../src/normalize.mjs";
import { Store, equal } from "../src/store.mjs";
const msg = (id, time = 1000, platform = "kick", user = "u") => ({
  id,
  platform,
  channel: "c",
  timestamp: time,
  user: { id: user, name: user, badges: [] },
  segments: [{ type: "text", text: "hi" }],
});
test("mixed feed orders out-of-order batches without platform grouping", () => {
  const f = new Feed({ now: () => 2000 });
  f.push(msg("1", 1003));
  f.push(msg("2", 1001, "twitch"));
  f.push(msg("3", 1002, "youtube"));
  f.flush();
  assert.deepEqual(
    f.messages.map((x) => x.id),
    ["2", "3", "1"],
  );
  f.close();
});
test("dedup is scoped to platform and channel", () => {
  const f = new Feed({ now: () => 2000 });
  f.push(msg("1"));
  f.push(msg("1"));
  f.push(msg("1", 1000, "twitch"));
  f.flush();
  assert.equal(f.messages.length, 2);
  f.close();
});
test("deletion before jitter flush prevents display and late resurrection", () => {
  const f = new Feed({ now: () => 2000 });
  f.push(msg("1"));
  f.moderate({ platform: "kick", channel: "c", id: "1" });
  f.flush();
  assert.equal(f.messages.length, 0);
  f.push(msg("1"));
  f.flush();
  assert.equal(f.messages.length, 0);
  f.close();
});
test("ban removes old messages, keeps other users/platforms, permits later messages", () => {
  const f = new Feed({ now: () => 4000 });
  f.push(msg("1"));
  f.push(msg("2", 1000, "kick", "other"));
  f.push(msg("3", 1000, "twitch"));
  f.flush();
  f.moderate({ platform: "kick", channel: "c", userId: "u", timestamp: 2000 });
  f.push(msg("4", 3000));
  f.push(msg("late", 1500));
  f.flush();
  assert.deepEqual(
    f.messages.map((x) => x.id),
    ["2", "3", "4"],
  );
  f.close();
});
test("channel clear isolated; future clock skew clamped; history bounded", () => {
  const f = new Feed({ limit: 10, now: () => 4000 });
  for (let i = 0; i < 2000; i++) f.push(msg(String(i), 1e20));
  f.flush();
  assert.equal(f.messages.length, 10);
  assert.equal(f.messages[0].timestamp, 4000);
  f.moderate({ platform: "twitch", channel: "c" });
  assert.equal(f.messages.length, 10);
  f.moderate({ platform: "kick", channel: "c" });
  assert.equal(f.messages.length, 0);
  f.close();
});
test("rich enrichment replaces same message without duplicate", () => {
  const f = new Feed({ now: () => 2000 });
  f.push(msg("1"));
  f.flush();
  f.push(
    {
      ...msg("1"),
      segments: [
        { type: "emote", text: "hi", url: "https://example.com/a.webp" },
      ],
    },
    { enrich: true },
  );
  assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].segments[0].type, "emote");
  f.close();
});
test("encrypted tokens survive restart and never stored as plaintext", () => {
  const path = join(mkdtempSync(join(tmpdir(), "chat-test-")), "chat.sqlite"),
    s = new Store(path, "test-key");
  s.token("twitch", {
    access_token: "a-very-private-token",
    refresh_token: "refresh",
  });
  assert.equal(s.token("twitch").access_token, "a-very-private-token");
  assert(!readFileSync(path).includes("a-very-private-token"));
  const wrong = new Store(":memory:", "wrong-key");
  assert.throws(() => wrong.unseal(s.get("token:twitch")));
  wrong.db.close();
  s.db.close();
  const s2 = new Store(path, "test-key");
  assert.equal(s2.token("twitch").refresh_token, "refresh");
  s2.db.close();
});
test("dedup and moderation survive restart", () => {
  const s = new Store(":memory:", "test-key");
  const f = new Feed({ store: s, now: () => 2000 });
  f.push(msg("1"));
  f.moderate({ platform: "kick", channel: "c", id: "2" });
  f.close();
  const next = new Feed({ store: s, now: () => 2001 });
  next.push(msg("1"));
  next.push(msg("2"));
  next.flush();
  assert.equal(next.messages.length, 0);
  next.close();
  s.db.close();
});
test("Kick selected graphical badges, correct subscriber month, native emote and reply", () => {
  const m = kickMessage(
    {
      id: "a",
      sender: {
        id: 1,
        username: "u",
        identity: {
          color: "#53fc18",
          badges_v2: [
            { selected: true, image_url: "https://example.com/level.png" },
            { selected: false, image_url: "https://example.com/no.png" },
          ],
          badges: [{ type: "subscriber", count: 7 }, { type: "moderator" }],
        },
      },
      content: "hello [emote:123:Wave] 😀",
      metadata: {
        original_sender: { username: "parent" },
        original_message: { content: "hey" },
      },
    },
    "c",
    new Emotes(),
    [
      { months: 1, badge_image: { src: "https://example.com/1.png" } },
      { months: 6, badge_image: { src: "https://example.com/6.png" } },
    ],
  );
  assert.equal(m.user.badges.length, 3);
  assert.equal(m.user.badges[1].url, "https://example.com/6.png");
  assert.equal(
    m.segments.find((x) => x.type === "emote").url,
    "https://files.kick.com/emotes/123/fullsize",
  );
  assert.equal(m.reply.name, "parent");
});
test("Twitch unicode and exact subscriber badge versions", () => {
  const m = twitchMessage(
    {
      message_id: "m",
      chatter_user_id: "u",
      chatter_user_name: "User",
      badges: [{ set_id: "subscriber", id: "3006" }],
      message: {
        fragments: [
          { type: "text", text: "😀 " },
          { type: "emote", text: "Kappa", emote: { id: "25" } },
        ],
      },
    },
    "c",
    new Emotes(),
    new Map([["subscriber/3006", "https://example.com/tier3.png"]]),
  );
  assert.equal(m.user.badges[0].version, "3006");
  assert.equal(m.segments[0].text, "😀");
  assert.equal(m.segments.at(-1).type, "emote");
});
test("YouTube native membership art and emoji", () => {
  const m = youtubeRenderer(
    {
      id: "1",
      authorName: { simpleText: "User" },
      authorExternalChannelId: "UC1",
      authorBadges: [
        {
          liveChatAuthorBadgeRenderer: {
            tooltip: "Member (2 months)",
            customThumbnail: {
              thumbnails: [{ url: "https://example.com/member.png" }],
            },
          },
        },
      ],
      message: {
        runs: [
          {
            emoji: {
              emojiId: "hi",
              image: { thumbnails: [{ url: "https://example.com/emoji.gif" }] },
            },
          },
        ],
      },
    },
    "c",
    new Emotes(),
  );
  assert.equal(m.user.badges[0].url, "https://example.com/member.png");
  assert.equal(m.segments[0].url, "https://example.com/emoji.gif");
});
test("official YouTube only shows actual roles", () => {
  const m = youtubeMessage(
    {
      id: "1",
      snippet: { displayMessage: "hi" },
      authorDetails: {
        displayName: "User",
        isChatModerator: true,
        isVerified: false,
      },
    },
    "c",
    new Emotes(),
  );
  assert.deepEqual(m.user.badges, [{ label: "Moderator" }]);
});
test("third-party emote tokenization preserves whitespace and case", () => {
  const e = new Emotes();
  e.maps.set(
    "kick:c",
    new Map([
      [
        "Wave",
        { type: "emote", text: "Wave", url: "https://example.com/w.webp" },
      ],
    ]),
  );
  const p = e.text("Wave  wave\n😀", "kick", "c");
  assert.equal(p[0].type, "emote");
  assert.equal(p.map((x) => x.text).join(""), "Wave  wave\n😀");
});
test("secret compare", () => {
  assert(equal("abc", "abc"));
  assert(!equal("abc", ""));
});
