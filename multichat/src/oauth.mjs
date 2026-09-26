import crypto from "node:crypto";
import { json } from "./net.mjs";
import { secret, equal } from "./store.mjs";
export const providers = {
  twitch: {
    authorize: "https://id.twitch.tv/oauth2/authorize",
    token: "https://id.twitch.tv/oauth2/token",
    scope: "user:read:chat channel:read:redemptions",
  },
  youtube: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/youtube.readonly",
  },
  kick: {
    authorize: "https://id.kick.com/oauth/authorize",
    token: "https://id.kick.com/oauth/token",
    scope: "user:read channel:read events:subscribe",
  },
};
export class OAuth {
  constructor(store, origin) {
    this.store = store;
    this.origin = origin;
    this.pending = new Map();
    this.locks = new Map();
  }
  credentials(p) {
    const prefix = p.toUpperCase();
    return {
      client_id: process.env[prefix + "_CLIENT_ID"],
      client_secret: process.env[prefix + "_CLIENT_SECRET"],
    };
  }
  configured(p) {
    const c = this.credentials(p);
    return Boolean(c.client_id && c.client_secret);
  }
  begin(p, session) {
    if (!providers[p] || !this.configured(p))
      throw Object.assign(
        new Error(
          "Add this platform’s client ID and secret in hosting settings first.",
        ),
        { status: 409 },
      );
    for (const [k, v] of this.pending)
      if (v.expires < Date.now()) this.pending.delete(k);
    const state = secret(),
      verifier = secret();
    this.pending.set(state, {
      p,
      session,
      verifier,
      expires: Date.now() + 600000,
    });
    const url = new URL(providers[p].authorize);
    url.search = new URLSearchParams({
      client_id: this.credentials(p).client_id,
      redirect_uri: `${this.origin}/auth/${p}/callback`,
      response_type: "code",
      scope: providers[p].scope,
      state,
      ...(p === "kick"
        ? {
            code_challenge: crypto
              .createHash("sha256")
              .update(verifier)
              .digest("base64url"),
            code_challenge_method: "S256",
          }
        : {}),
      ...(p === "youtube" ? { access_type: "offline", prompt: "consent" } : {}),
    });
    return url.href;
  }
  async complete(p, code, state, session) {
    const item = this.pending.get(state);
    this.pending.delete(state);
    if (
      !item ||
      item.p !== p ||
      !equal(item.session, session) ||
      item.expires < Date.now()
    )
      throw Object.assign(
        new Error("Connection expired. Please try again from the dashboard."),
        { status: 400 },
      );
    const token = await this.exchange(p, {
      grant_type: "authorization_code",
      code,
      redirect_uri: `${this.origin}/auth/${p}/callback`,
      ...(p === "kick" ? { code_verifier: item.verifier } : {}),
    });
    let user;
    if (p === "twitch") {
      const d = await json("https://api.twitch.tv/helix/users", {
        headers: {
          Authorization: "Bearer " + token.access_token,
          "Client-Id": this.credentials(p).client_id,
        },
      });
      user = {
        id: d.data[0].id,
        name: d.data[0].display_name,
        login: d.data[0].login,
      };
    } else if (p === "youtube") {
      const d = await json(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        { headers: { Authorization: "Bearer " + token.access_token } },
      );
      if (!d.items?.length) throw new Error("No YouTube channel found");
      user = { id: d.items[0].id, name: d.items[0].snippet.title };
    } else {
      const d = await json("https://api.kick.com/public/v1/users", {
        headers: { Authorization: "Bearer " + token.access_token },
      });
      user = { id: String(d.data[0].user_id), name: d.data[0].name };
    }
    this.store.token(p, {
      ...token,
      user,
      expiresAt: Date.now() + token.expires_in * 1000,
    });
    await this.store.flush();
    return user;
  }
  async exchange(p, params) {
    return json(providers[p].token, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...this.credentials(p), ...params }),
    });
  }
  async access(p, force = false) {
    if (this.locks.has(p)) return this.locks.get(p);
    const t = this.store.token(p);
    if (!t) throw Object.assign(new Error("Connect account"), { status: 401 });
    if (!force && t.expiresAt > Date.now() + 120000) {
      await this.store.flush();
      return t.access_token;
    }
    const task = (async () => {
      try {
        const next = await this.exchange(p, {
          grant_type: "refresh_token",
          refresh_token: t.refresh_token,
        });
        this.store.token(p, {
          ...t,
          ...next,
          refresh_token: next.refresh_token || t.refresh_token,
          expiresAt: Date.now() + next.expires_in * 1000,
        });
        await this.store.flush();
        return next.access_token;
      } catch (e) {
        if (e.status === 400) e.status = 401;
        throw e;
      }
    })().finally(() => this.locks.delete(p));
    this.locks.set(p, task);
    return task;
  }
  async api(p, url, options = {}) {
    const call = async (force) =>
      json(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: "Bearer " + (await this.access(p, force)),
          ...(p === "twitch"
            ? { "Client-Id": this.credentials(p).client_id }
            : {}),
        },
      });
    try {
      return await call(false);
    } catch (e) {
      if (e.status === 401) return call(true);
      throw e;
    }
  }
}
