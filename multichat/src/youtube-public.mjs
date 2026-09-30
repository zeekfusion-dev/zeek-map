import { request } from "./net.mjs";
export function publicBroadcast(html, channel) {
  const raw = html.match(
    /(?:var\s+)?ytInitialPlayerResponse\s*=\s*({.*?});/s,
  )?.[1];
  if (!raw)
    throw Object.assign(new Error("YouTube public broadcast unavailable"), {
      reason: "PublicBroadcastUnavailable",
    });
  const player = JSON.parse(raw),
    video = player.videoDetails,
    live = player.microformat?.playerMicroformatRenderer?.liveBroadcastDetails;
  if (
    video?.channelId !== channel ||
    !/^[\w-]{11}$/.test(video.videoId) ||
    !video.isLiveContent ||
    live?.endTimestamp
  )
    throw Object.assign(new Error("Waiting for a public YouTube live stream"), {
      reason:
        player.playabilityStatus?.status === "LOGIN_REQUIRED"
          ? "YouTubeHostVerificationRequired"
          : "PublicBroadcastNotLive",
    });
  return { id: video.videoId, title: video.title };
}
export async function discoverPublicBroadcast(channel, signal) {
  if (!/^UC[\w-]{22}$/.test(channel))
    throw new Error("Invalid YouTube channel");
  const options = {
    signal,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    },
  };
  const listing = await (
    await request(`https://www.youtube.com/channel/${channel}/streams`, options)
  ).text();
  return publicChannelBroadcast(listing, channel);
}

export function publicChannelBroadcast(html, channel) {
  const raw = html.match(/(?:var\s+)?ytInitialData\s*=\s*({.*?});/s)?.[1];
  if (!raw)
    throw Object.assign(new Error("Public channel unavailable"), {
      reason: "PublicChannelUnavailable",
    });
  const data = JSON.parse(raw);
  if (data.metadata?.channelMetadataRenderer?.externalId !== channel)
    throw new Error("Unexpected YouTube channel");
  let found;
  const walk = (value) => {
    if (!value || typeof value !== "object" || found) return;
    const modern = value.lockupViewModel;
    const old = value.videoRenderer;
    const id = modern?.contentId || old?.videoId;
    const badges =
      modern?.contentImage?.thumbnailViewModel?.overlays ||
      old?.thumbnailOverlays;
    if (
      id &&
      /^[\w-]{11}$/.test(id) &&
      /"(?:badgeStyle|style)":"(?:THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE|LIVE)"/.test(
        JSON.stringify(badges),
      )
    ) {
      found = {
        id,
        title:
          modern?.metadata?.lockupMetadataViewModel?.title?.content ||
          old?.title?.runs?.map((r) => r.text).join("") ||
          id,
      };
      return;
    }
    for (const v of Object.values(value)) walk(v);
  };
  walk(data.contents);
  if (!found)
    throw Object.assign(new Error("Waiting for a public YouTube live stream"), {
      reason: "PublicBroadcastNotLive",
    });
  return found;
}
