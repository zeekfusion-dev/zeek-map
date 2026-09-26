import { timestamp } from "./net.mjs";

// Stable redemption IDs make webhook retries/status updates one feed entry.
export function redemption(platform, e, channel, emotes) {
  if (!e.id || !e.reward) return null;
  const user =
    platform === "kick"
      ? e.redeemer
      : {
          user_id: e.user_id,
          username: e.user_name || e.user_login,
        };
  if (!user?.user_id) return null;
  const title =
    e.reward.title ||
    String(e.reward.type || "Channel reward").replaceAll("_", " ");
  const input = e.user_input ?? e.message?.text ?? "";
  return {
    platform,
    channel: String(channel),
    id: "reward:" + e.id,
    timestamp: timestamp(e.redeemed_at),
    user: {
      id: String(user.user_id),
      name: user.username,
      avatar: user.profile_picture,
      badges: [],
    },
    activity: {
      type: "redemption",
      title: `redeemed: ${title}`,
      status: e.status,
    },
    segments:
      platform === "twitch" && e.message?.fragments
        ? emotes.twitch(e.message.fragments, channel)
        : emotes.text(input, platform, channel),
  };
}

export function youtubeActivity(s) {
  if (s.superChatDetails)
    return {
      type: "super-chat",
      title:
        `sent a Super Chat ${s.superChatDetails.amountDisplayString || ""}`.trim(),
    };
  if (s.superStickerDetails)
    return {
      type: "super-sticker",
      title:
        `sent a Super Sticker ${s.superStickerDetails.amountDisplayString || ""}`.trim(),
    };
  if (s.memberMilestoneChatDetails)
    return {
      type: "membership",
      title: `celebrated ${s.memberMilestoneChatDetails.memberMonth || ""} months of membership`,
    };
  if (s.newSponsorDetails)
    return { type: "membership", title: "became a member" };
  if (s.membershipGiftingDetails)
    return {
      type: "membership",
      title: `gifted ${s.membershipGiftingDetails.giftMembershipsCount || ""} memberships`,
    };
  if (s.giftMembershipReceivedDetails)
    return { type: "membership", title: "received a gift membership" };
  if (s.giftDetails)
    return {
      type: "gift",
      title: `sent ${s.giftDetails.giftName || "a gift"}${s.giftDetails.comboCount ? ` ×${s.giftDetails.comboCount}` : ""}`,
    };
  return null;
}
