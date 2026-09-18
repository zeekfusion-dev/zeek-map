import { https, timestamp } from "./net.mjs";
// Kick renders this native badge when the channel has no applicable custom tier.
export const kickSubscriberDefault = "/assets/kick-subscriber.svg";
export function kickSubscriberBadge(badge, tiers = []) {
  const direct = https(badge.image_url) || https(badge.badge_image?.src);
  if (direct) return direct;
  const months = Math.max(0, Number(badge.count) || 0);
  return (
    tiers
      .filter((s) => Number(s.months) <= months && https(s.badge_image?.src))
      .sort((a, b) => Number(b.months) - Number(a.months))[0]?.badge_image
      .src || kickSubscriberDefault
  );
}
export function kickMessage(e, channel, emotes, subscriberBadges = []) {
  const u = e.sender || {},
    identity = u.identity || {};
  const badges = (identity.badges_v2 || [])
    .filter((b) => b.selected && https(b.image_url))
    .map((b) => ({
      label: b.title || b.type || "Kick status",
      url: b.image_url,
    }));
  for (const b of identity.badges || []) {
    // Selected native subscriber imagery already represents this role.
    if (
      b.type === "subscriber" &&
      (identity.badges_v2 || []).some(
        (v) => v.selected && v.type === "subscriber" && https(v.image_url),
      )
    )
      continue;
    let url;
    if (b.type === "subscriber") url = kickSubscriberBadge(b, subscriberBadges);
    else if (
      [
        "verified",
        "staff",
        "moderator",
        "og",
        "vip",
        "bot",
        "broadcaster",
        "founder",
        "sub_gifter",
      ].includes(b.type)
    )
      url = `https://raw.githubusercontent.com/id3adeye/kickicons/refs/heads/main/kick-${b.type}.png`;
    badges.push({
      label: b.text || b.type,
      count: b.count,
      url: url === kickSubscriberDefault ? url : https(url),
    });
  }
  return {
    platform: "kick",
    channel: String(channel),
    id: String(e.id || e.message_id || ""),
    timestamp: timestamp(e.created_at),
    user: {
      id: String(u.id || u.user_id || ""),
      name: u.username || u.name || "",
      color: identity.color,
      avatar: u.profile_picture,
      badges,
    },
    segments: emotes.kick(e.content || "", channel),
    reply: e.metadata?.original_sender
      ? {
          name: e.metadata.original_sender.username,
          segments: emotes.kick(
            e.metadata.original_message?.content || "",
            channel,
          ),
        }
      : null,
  };
}
export function twitchMessage(e, channel, emotes, badgeMap) {
  return {
    platform: "twitch",
    channel: String(channel),
    id: e.message_id,
    timestamp: timestamp(e.timestamp),
    user: {
      id: e.chatter_user_id,
      name: e.chatter_user_name,
      color: e.color,
      badges: (e.badges || []).map((b) => ({
        label: b.set_id + (b.info ? " " + b.info : ""),
        version: b.id,
        url: badgeMap.get(`${b.set_id}/${b.id}`),
      })),
    },
    segments: emotes.twitch(
      e.message?.fragments || [{ type: "text", text: e.message?.text || "" }],
      channel,
    ),
    reply: e.reply
      ? {
          name: e.reply.parent_user_name,
          segments: emotes.text(e.reply.parent_message_body, "twitch", channel),
        }
      : null,
  };
}
export function youtubeMessage(e, channel, emotes) {
  const s = e.snippet || {},
    u = e.authorDetails || {};
  return {
    platform: "youtube",
    channel: String(channel),
    id: e.id,
    timestamp: timestamp(s.publishedAt),
    user: {
      id: u.channelId || s.authorChannelId,
      name: u.displayName || "",
      avatar: u.profileImageUrl,
      color: u.isChatOwner
        ? "#ffd600"
        : u.isChatModerator
          ? "#5e84f1"
          : u.isChatSponsor
            ? "#2ba640"
            : "#ffffff",
      badges: [
        ["isChatOwner", "Owner"],
        ["isChatModerator", "Moderator"],
        ["isChatSponsor", "Member"],
        ["isVerified", "Verified"],
      ]
        .filter(([key]) => u[key])
        .map(([, label]) => ({ label })),
    },
    segments: emotes.text(
      s.displayMessage || s.textMessageDetails?.messageText || "",
      "youtube",
      channel,
    ),
  };
}
export function youtubeRenderer(r, channel, emotes) {
  return {
    platform: "youtube",
    channel: String(channel),
    id: r.id,
    timestamp: Number(r.timestampUsec) / 1000 || Date.now(),
    user: {
      id: r.authorExternalChannelId,
      name: r.authorName?.simpleText || "",
      avatar: r.authorPhoto?.thumbnails?.at(-1)?.url,
      badges: (r.authorBadges || [])
        .map((b) => b.liveChatAuthorBadgeRenderer)
        .filter(Boolean)
        .map((b) => ({
          label: b.tooltip || b.icon?.iconType || "Member",
          url: https(b.customThumbnail?.thumbnails?.at(-1)?.url),
        })),
    },
    segments: emotes.youtube(r.message?.runs || r.headerSubtext?.runs, channel),
  };
}
