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
  const html = await (
    await request(`https://www.youtube.com/channel/${channel}/live`, {
      signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      },
    })
  ).text();
  return publicBroadcast(html, channel);
}
