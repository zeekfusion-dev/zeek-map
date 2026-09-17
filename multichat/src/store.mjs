import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import crypto from "node:crypto";
export class Store {
  constructor(path, key) {
    mkdirSync(dirname(path), { recursive: true });
    this.key = crypto.createHash("sha256").update(key).digest();
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    );
  }
  get(key, fallback = null) {
    const r = this.db.prepare("SELECT value FROM kv WHERE key=?").get(key);
    return r ? JSON.parse(r.value) : fallback;
  }
  set(key, value) {
    this.db
      .prepare(
        "INSERT INTO kv VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, JSON.stringify(value));
    return value;
  }
  seal(value) {
    const iv = crypto.randomBytes(12),
      c = crypto.createCipheriv("aes-256-gcm", this.key, iv);
    const body = Buffer.concat([c.update(JSON.stringify(value)), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
  }
  unseal(value) {
    const b = Buffer.from(value, "base64url"),
      d = crypto.createDecipheriv("aes-256-gcm", this.key, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]));
  }
  token(platform, value) {
    if (value !== undefined)
      this.set("token:" + platform, value === null ? null : this.seal(value));
    const data = this.get("token:" + platform);
    return data ? this.unseal(data) : null;
  }
}
export const secret = () => crypto.randomBytes(32).toString("base64url");
export function equal(a, b) {
  const x = crypto
      .createHash("sha256")
      .update(String(a || ""))
      .digest(),
    y = crypto
      .createHash("sha256")
      .update(String(b || ""))
      .digest();
  return crypto.timingSafeEqual(x, y);
}
