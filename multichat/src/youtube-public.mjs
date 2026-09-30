import { request } from "./net.mjs";
export function publicBroadcast(html, channel) {
  const raw = html.match(
    /(?:var\s+)?ytInitialPlayerResponse\s*=\s*({.*?});/s,
  )?.[1];
  if (!raw) throw new Error("YouTube public broadcast unavailable");
  const player = JSON.parse(raw),
    video = player.videoDetails,
    live = player.microformat?.playerMicroformatRenderer?.liveBroadcastDetails;
  if (
    video?.channelId !== channel ||
    !/^[\w-]{11}$/.test(video.videoId) ||
    !video.isLiveContent ||
    live?.endTimestamp
  )
    throw new Error("Waiting for a public YouTube live stream");
  return { id: video.videoId, title: video.title };
}
export async function discoverPublicBroadcast(channel, signal) {
  if (!/^UC[\w-]{22}$/.test(channel))
    throw new Error("Invalid YouTube channel");
  const html = await (
    await request(`https://www.youtube.com/channel/${channel}/live`, { signal })
  ).text();
  return publicBroadcast(html, channel);
}
