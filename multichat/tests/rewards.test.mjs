import test from "node:test";
import assert from "node:assert/strict";
import { redemption } from "../src/rewards.mjs";
import { youtubeMessage, youtubeRenderer } from "../src/normalize.mjs";
import { Emotes } from "../src/emotes.mjs";
import { Feed } from "../src/feed.mjs";
import { Connections } from "../src/connections.mjs";
const emotes = new Emotes();
test("custom and automatic Twitch redemptions retain title, viewer text, native emotes and stable ID", () => {
  const e = {
    id: "redemption",
    user_id: "u",
    user_name: "Viewer",
    redeemed_at: new Date().toISOString(),
    reward: { title: "Hydrate" },
    user_input: "Please drink water",
  };
  const m = redemption("twitch", e, "c", emotes);
  assert.equal(m.id, "reward:redemption");
  assert.equal(m.activity.title, "redeemed: Hydrate");
  assert.equal(m.segments.map((s) => s.text).join(""), e.user_input);
  const automatic = redemption(
    "twitch",
    {
      ...e,
      user_input: undefined,
      reward: { type: "send_highlighted_message" },
      message: {
        fragments: [{ type: "emote", text: "Kappa", emote: { id: "25" } }],
      },
    },
    "c",
    emotes,
  );
  assert.equal(automatic.activity.title, "redeemed: send highlighted message");
  assert.equal(automatic.segments[0].type, "emote");
});
test("Kick reward status changes update one chronological entry; retries do not duplicate it", () => {
  const f = new Feed();
  const e = {
    id: "r",
    redeemer: { user_id: 123, username: "Viewer" },
    reward: { title: "Hydrate" },
    user_input: "hello",
    status: "pending",
    redeemed_at: new Date().toISOString(),
  };
  f.push(redemption("kick", e, "c", emotes), { enrich: true });
  f.flush();
  const seq = f.messages[0].sequence;
  f.push(redemption("kick", { ...e, status: "accepted" }, "c", emotes), {
    enrich: true,
  });
  f.flush();
  assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].activity.status, "accepted");
  assert.equal(f.messages[0].sequence, seq);
  f.close();
});
test("YouTube paid and membership activity is distinct and graphics survive either arrival order", () => {
  for (const detail of [
    "superChatDetails",
    "superStickerDetails",
    "memberMilestoneChatDetails",
    "newSponsorDetails",
    "membershipGiftingDetails",
    "giftMembershipReceivedDetails",
    "giftDetails",
  ]) {
    const m = youtubeMessage(
      {
        id: detail,
        snippet: {
          publishedAt: new Date().toISOString(),
          [detail]: {
            userComment: "hello",
            amountDisplayString: "$5",
            giftName: "Rose",
            comboCount: 2,
          },
        },
        authorDetails: { channelId: "u", displayName: "Viewer" },
      },
      "c",
      emotes,
    );
    assert.ok(m.activity, detail);
  }
  const official = youtubeMessage(
    {
      id: "paid",
      snippet: {
        publishedAt: new Date().toISOString(),
        superChatDetails: { userComment: "hello", amountDisplayString: "$5" },
      },
      authorDetails: { channelId: "u", displayName: "Viewer" },
    },
    "c",
    emotes,
  );
  const rich = youtubeRenderer(
    {
      id: "paid",
      timestampUsec: Date.now() * 1000,
      authorExternalChannelId: "u",
      authorName: { simpleText: "Viewer" },
      authorBadges: [
        {
          liveChatAuthorBadgeRenderer: {
            tooltip: "Member",
            customThumbnail: {
              thumbnails: [{ url: "https://example.com/badge.png" }],
            },
          },
        },
      ],
      message: { runs: [{ text: "hello" }] },
    },
    "c",
    emotes,
  );
  for (const pair of [
    [official, rich],
    [rich, official],
  ]) {
    const f = new Feed();
    for (const m of pair) {
      f.push(m, { enrich: true });
      f.flush();
    }
    assert.equal(f.messages.length, 1);
    assert.ok(f.messages[0].activity);
    assert.ok(f.messages[0].user.badges[0].url);
    f.close();
  }
});
test("Twitch adds both reward subscriptions only with permission; failures cannot disconnect chat", async () => {
  for (const fail of [false, true]) {
    const token = {
      user: { id: "u" },
      scope: ["user:read:chat", "channel:read:redemptions"],
    };
    const calls = [];
    const store = { token: () => token };
    const oauth = {
      api: async (_, url, opts) => {
        if (!opts) return { data: [] };
        const body = JSON.parse(opts.body);
        calls.push(body);
        if (fail && body.type.includes("reward")) throw new Error("403");
        return {};
      },
    };
    const f = new Feed();
    const c = new Connections(store, oauth, f, {
      ...emotes,
      load: async () => {},
    });
    const states = [];
    c.socket = async (_, signal, handler) => {
      await handler(
        {
          metadata: { message_type: "session_welcome" },
          payload: { session: { id: "s" } },
        },
        {},
        () => {},
      );
    };
    await c.twitch(new AbortController().signal, (s) => states.push(s));
    assert.equal(calls.length, 6);
    assert.equal(states.at(-1), "Connected");
    assert.equal(calls[4].condition.user_id, undefined);
    assert.equal(calls[5].version, "2");
    assert.match(c.states.twitch.rewards, fail ? /failed/ : /Connected/);
    f.close();
  }
});
