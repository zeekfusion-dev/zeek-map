import crypto from "node:crypto";
import { secret, equal } from "./store.mjs";
const DAY = 86400000;
const digest = (value) =>
  crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
export class Sessions {
  constructor(store, password, now = Date.now) {
    this.store = store;
    this.now = now;
    this.temporary = new Map();
    this.passwordVersion = crypto
      .createHmac("sha256", store.key)
      .update(password)
      .digest("hex");
    try {
      this.remembered = new Map(
        store.get("remembered-sessions")
          ? store.unseal(store.get("remembered-sessions"))
          : [],
      );
    } catch {
      this.remembered = new Map();
    }
    this.prune();
  }
  prune() {
    for (const map of [this.temporary, this.remembered])
      for (const [key, value] of map)
        if (
          value.expires <= this.now() ||
          !equal(value.version, this.passwordVersion)
        )
          map.delete(key);
  }
  valid(id) {
    const key = digest(id),
      value = this.temporary.get(key) || this.remembered.get(key);
    return (
      !!value &&
      value.expires > this.now() &&
      equal(value.version, this.passwordVersion)
    );
  }
  async save() {
    this.store.set(
      "remembered-sessions",
      this.store.seal([...this.remembered]),
    );
    await this.store.flush();
  }
  async create(remember, previous) {
    this.prune();
    const id = secret(),
      key = digest(id),
      maxAge = (remember ? 30 : 7) * DAY;
    const map = remember ? this.remembered : this.temporary;
    this.temporary.delete(digest(previous));
    const removed = this.remembered.delete(digest(previous));
    map.set(key, {
      expires: this.now() + maxAge,
      version: this.passwordVersion,
    });
    while (this.remembered.size > 100)
      this.remembered.delete(this.remembered.keys().next().value);
    if (remember || removed) {
      try {
        await this.save();
      } catch (e) {
        map.delete(key);
        throw e;
      }
    }
    return { id, maxAge };
  }
  async revoke(id) {
    const key = digest(id);
    this.temporary.delete(key);
    if (this.remembered.delete(key)) await this.save();
  }
}
