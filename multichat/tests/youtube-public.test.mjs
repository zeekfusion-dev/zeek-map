import test from "node:test";
import assert from "node:assert/strict";
import { publicBroadcast } from "../src/youtube-public.mjs";
import { Connections } from "../src/connections.mjs";
test("public live discovery verifies the connected channel and rejects ended broadcasts", () => {
  const player = {
    videoDetails: {
      channelId: "channel",
      videoId: "12345678901",
      isLiveContent: true,
      title: "Live",
    },
    microformat: {
      playerMicroformatRenderer: { liveBroadcastDetails: { isLiveNow: true } },
    },
  };
  const html = () => `var ytInitialPlayerResponse = ${JSON.stringify(player)};`;
  assert.equal(publicBroadcast(html(), "channel").id, "12345678901");
  assert.throws(() => publicBroadcast(html(), "wrong"));
  player.microformat.playerMicroformatRenderer.liveBroadcastDetails.endTimestamp =
    "2026-09-30";
  assert.throws(() => publicBroadcast(html(), "channel"));
});
test("quota error uses public chat and does not keep consuming exhausted API quota", async () => {
  const values = new Map();
  const c = new Connections(
    { get: (k, d) => values.get(k) ?? d, set: (k, v) => values.set(k, v) },
    {},
    {},
    {},
  );
  let official = 0,
    fallback = 0;
  c.youtubeOfficial = async () => {
    official++;
    throw Object.assign(new Error("quota"), {
      reason: "quotaExceeded",
      status: 403,
    });
  };
  c.youtubePublic = async () => {
    fallback++;
  };
  await c.youtube(new AbortController().signal, () => {});
  await c.youtube(new AbortController().signal, () => {});
  assert.equal(official, 1);
  assert.equal(fallback, 2);
});

test("public channel listing selects live badges only and verifies ownership", async () => {
  const { publicChannelBroadcast } = await import("../src/youtube-public.mjs");
  const channel = "UCguLKMBMaqzIbrjw_fG1tdw";
  const item = {
    lockupViewModel: {
      contentId: "SAVO_NHlWlc",
      metadata: { lockupMetadataViewModel: { title: { content: "Live" } } },
      contentImage: {
        thumbnailViewModel: {
          overlays: [
            {
              thumbnailBottomOverlayViewModel: {
                badges: [
                  {
                    thumbnailBadgeViewModel: {
                      badgeStyle: "THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE",
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    },
  };
  const page = (data) => `var ytInitialData = ${JSON.stringify(data)};`;
  const data = {
    metadata: { channelMetadataRenderer: { externalId: channel } },
    contents: [item],
  };
  assert.equal(publicChannelBroadcast(page(data), channel).id, "SAVO_NHlWlc");
  assert.throws(() => publicChannelBroadcast(page(data), "wrong"));
  item.lockupViewModel.contentImage.thumbnailViewModel.overlays = [];
  assert.throws(() => publicChannelBroadcast(page(data), channel), /Waiting/);
});
