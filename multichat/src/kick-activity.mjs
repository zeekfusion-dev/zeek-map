import { randomUUID } from "node:crypto";
import { redemption } from "./rewards.mjs";
import { kickMessage } from "./normalize.mjs";

// Public Kick Pusher payloads differ from the official webhook payloads.
// Source reference: kichat.js 1.0.4, types/events.d.ts.
export function kickReward(e, channel, emotes) {
  if (!e?.reward_title || !e.user_id || !e.username) return null;
  return redemption(
    "kick",
    {
      id: e.id || e.redemption_id || randomUUID(),
      redeemed_at: e.redeemed_at || e.created_at || new Date().toISOString(),
      reward: { title: e.reward_title },
      redeemer: { user_id: e.user_id, username: e.username },
      user_input: String(e.user_input || ""),
    },
    channel,
    emotes,
  );
}

export function kickPin(e, channel, emotes, badges, now = Date.now()) {
  if (!e?.message?.id || !e.message.sender) return null;
  const message = kickMessage(e.message, channel, emotes, badges);
  const duration = Number(e.duration);
  return {
    message,
    expiresAt:
      Number.isFinite(duration) && duration > 0 ? now + duration * 1000 : null,
  };
}

// The same public event can arrive on legacy and current Pusher channels.
// Match only copies from DIFFERENT channels; repeated identical redemptions
// on the same channel are separate real actions and must not disappear.
export class KickActivityCopies {
  constructor(now = Date.now) {
    this.now = now;
    this.entries = [];
  }
  duplicate(event, payload, source) {
    const now = this.now();
    this.entries = this.entries.filter((e) => now - e.at < 2000);
    const signature = JSON.stringify([event, payload]);
    const copy = this.entries.find(
      (e) => e.signature === signature && !e.sources.has(source),
    );
    if (copy) {
      copy.sources.add(source);
      return true;
    }
    this.entries.push({ signature, sources: new Set([source]), at: now });
    if (this.entries.length > 500) this.entries.shift();
    return false;
  }
}
