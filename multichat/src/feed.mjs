import { EventEmitter } from "node:events";
export class Feed extends EventEmitter {
  constructor({ limit = 200, jitter = 40, now = Date.now, store } = {}) {
    super();
    Object.assign(this, { limit, jitter, now, store });
    this.messages = [];
    this.pending = [];
    this.seen = new Map(store?.get("seen", []) || []);
    this.tombstones = new Map(store?.get("tombstones", []) || []);
    this.sequence = 0;
    this.replayFloor = store?.get("feed-watermark", 0) || 0;
    this.watermark = this.replayFloor;
  }
  key(m) {
    return `${m.platform}:${m.channel}:${m.id}`;
  }
  blocked(m) {
    const t = m.timestamp;
    return (
      this.tombstones.has(this.key(m)) ||
      t <=
        (this.tombstones.get(`${m.platform}:${m.channel}:user:${m.user.id}`) ||
          0) ||
      t <= (this.tombstones.get(`${m.platform}:${m.channel}:clear`) || 0)
    );
  }
  push(m, { enrich = false } = {}) {
    if (!m?.id || !m.user || !m.channel) return;
    const now = this.now();
    m = {
      ...m,
      timestamp:
        Number.isFinite(m.timestamp) && m.timestamp <= now + 5000
          ? m.timestamp
          : now,
      receivedAt: now,
    };
    if (this.blocked(m) || m.timestamp <= this.replayFloor) return;
    this.watermark = Math.max(this.watermark, m.timestamp);
    const key = this.key(m);
    if (this.seen.has(key)) {
      if (enrich) {
        const old =
          this.messages.find((x) => this.key(x) === key) ||
          this.pending.find((x) => this.key(x) === key);
        if (old) {
          Object.assign(old, m, { sequence: old.sequence });
          this.emit("event", { type: "update", message: old });
        }
      }
      return;
    }
    this.seen.set(key, now);
    m.sequence = ++this.sequence;
    this.pending.push(m);
    if (this.sequence % 256 === 0) this.prune();
    if (!this.timer) this.timer = setTimeout(() => this.flush(), this.jitter);
  }
  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    const batch = this.pending.splice(0).filter((m) => !this.blocked(m));
    batch.sort((a, b) => a.timestamp - b.timestamp || a.sequence - b.sequence);
    this.messages.push(...batch);
    this.messages.sort(
      (a, b) => a.timestamp - b.timestamp || a.sequence - b.sequence,
    );
    this.messages = this.messages.slice(-this.limit);
    if (batch.length) this.emit("event", { type: "messages", messages: batch });
  }
  moderate({ platform, channel, id, userId, timestamp = this.now() }) {
    const prefix = `${platform}:${channel}:`;
    this.tombstones.set(
      id ? prefix + id : userId ? prefix + "user:" + userId : prefix + "clear",
      id ? this.now() : timestamp,
    );
    this.messages = this.messages.filter((m) => !this.blocked(m));
    this.pending = this.pending.filter((m) => !this.blocked(m));
    this.prune();
    this.emit("event", {
      type: "remove",
      platform,
      channel,
      id,
      userId,
      timestamp,
    });
  }
  prune() {
    const before = this.now() - 24 * 3600000;
    for (const map of [this.seen, this.tombstones]) {
      for (const [k, v] of map) if (v < before) map.delete(k);
      while (map.size > 30000) map.delete(map.keys().next().value);
    }
  }
  checkpoint() {
    this.store?.set("seen", [...this.seen].slice(-1000));
    this.store?.set("feed-watermark", this.watermark);
    this.store?.set("tombstones", [...this.tombstones].slice(-5000));
  }
  close() {
    clearTimeout(this.timer);
    this.checkpoint();
  }
}
