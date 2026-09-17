import { Store } from "./store.mjs";

// Only a memory cache lives on Render. Every durable snapshot is encrypted
// before it crosses the network; the database API key alone cannot read it.
export class RemoteStore extends Store {
  constructor({ url, apiKey, stateKey, encryptionKey, fetcher = fetch }) {
    super(":memory:", encryptionKey);
    this.remote = { url: url.replace(/\/$/, ""), apiKey, stateKey };
    this.fetcher = fetcher;
    this.version = 0;
    this.dirty = 0;
    this.saved = 0;
    this.error = null;
    this.durable = true;
  }
  async rpc(name, body) {
    const r = await this.fetcher(`${this.remote.url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: this.remote.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_key: this.remote.stateKey, ...body }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok)
      throw new Error(
        r.status === 409
          ? "Storage was changed by another instance. Restart to reload."
          : "Encrypted storage is unavailable.",
      );
    return r.json();
  }
  async initialize() {
    const row = await this.rpc("z_multichat_read", {});
    if (!row || !Number.isInteger(row.revision))
      throw new Error("Multichat storage is not provisioned.");
    const values = row.cipher ? this.unseal(row.cipher) : {};
    if (!values || typeof values !== "object" || Array.isArray(values))
      throw new Error("Invalid saved multichat state.");
    for (const [key, value] of Object.entries(values)) super.set(key, value);
    this.version = row.revision;
    return this;
  }
  set(key, value) {
    if (JSON.stringify(super.get(key)) === JSON.stringify(value)) return value;
    super.set(key, value);
    this.dirty++;
    return value;
  }
  async flush() {
    if (this.saving) {
      await this.saving;
      return this.flush();
    }
    if (this.saved === this.dirty) return;
    this.saving = (async () => {
      while (this.saved !== this.dirty) {
        const generation = this.dirty;
        const values = Object.fromEntries(
          this.db
            .prepare("SELECT key,value FROM kv")
            .all()
            .map((r) => [r.key, JSON.parse(r.value)]),
        );
        try {
          const result = await this.rpc("z_multichat_write", {
            p_revision: this.version,
            p_cipher: this.seal(values),
          });
          if (!Number.isInteger(result?.revision))
            throw new Error("Encrypted storage did not acknowledge the save.");
          this.version = result.revision;
          this.saved = generation;
          this.error = null;
        } catch (e) {
          this.error = e.message;
          throw e;
        }
      }
    })();
    try {
      await this.saving;
    } finally {
      this.saving = null;
    }
  }
  health() {
    return {
      durable: true,
      saved: this.saved === this.dirty,
      error: this.error,
    };
  }
}
