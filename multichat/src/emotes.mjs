import { json, https } from "./net.mjs";
export class Emotes {
  constructor() {
    this.maps = new Map();
    this.refreshed = new Map();
    this.inflight = new Map();
  }
  async load(platform, id) {
    const key = platform + ":" + id;
    if (Date.now() - (this.refreshed.get(key) || 0) < 300000) return;
    if (this.inflight.has(key)) return this.inflight.get(key);
    const task = this.fetch(platform, id).finally(() =>
      this.inflight.delete(key),
    );
    this.inflight.set(key, task);
    return task;
  }
  async fetch(platform, id) {
    const map = new Map(this.maps.get(platform + ":" + id));
    const add = (name, url, zeroWidth = false) => {
      if (name && https(url))
        map.set(name, { type: "emote", text: name, url, zeroWidth });
    };
    const jobs = [
      async () => {
        const data = await json("https://7tv.io/v3/emote-sets/global");
        for (const e of data.emotes || [])
          add(
            e.name,
            "https:" +
              e.data.host.url +
              "/" +
              (
                e.data.host.files.find((f) => f.name === "2x.webp") ||
                e.data.host.files.find((f) => f.name.endsWith(".webp"))
              )?.name,
            Boolean(e.flags & 1),
          );
      },
      async () => {
        const d = await json(
          `https://7tv.io/v3/users/${platform}/${encodeURIComponent(id)}`,
        );
        for (const e of d.emote_set?.emotes || [])
          add(
            e.name,
            "https:" +
              e.data.host.url +
              "/" +
              (
                e.data.host.files.find((f) => f.name === "2x.webp") ||
                e.data.host.files.find((f) => f.name.endsWith(".webp"))
              )?.name,
            Boolean(e.flags & 1),
          );
      },
      async () => {
        for (const e of await json(
          "https://api.betterttv.net/3/cached/emotes/global",
        ))
          add(e.code, `https://cdn.betterttv.net/emote/${e.id}/2x`);
      },
      async () => {
        const d = await json(
          `https://api.betterttv.net/3/cached/users/${platform}/${encodeURIComponent(id)}`,
        );
        for (const e of [...(d.channelEmotes || []), ...(d.sharedEmotes || [])])
          add(e.code, `https://cdn.betterttv.net/emote/${e.id}/2x`);
      },
      async () => {
        const d = await json("https://api.frankerfacez.com/v1/set/global");
        for (const set of Object.values(d.sets || {}))
          for (const e of set.emoticons || [])
            add(
              e.name,
              (e.animated?.["2"] || e.urls["2"] || e.urls["1"]).replace(
                /^\/\//,
                "https://",
              ),
            );
      },
    ];
    if (platform === "twitch")
      jobs.push(async () => {
        const d = await json(
          `https://api.frankerfacez.com/v1/room/id/${encodeURIComponent(id)}`,
        );
        for (const set of Object.values(d.sets || {}))
          for (const e of set.emoticons || [])
            add(
              e.name,
              (e.animated?.["2"] || e.urls["2"] || e.urls["1"]).replace(
                /^\/\//,
                "https://",
              ),
            );
      });
    await Promise.allSettled(jobs.map((fn) => fn()));
    this.maps.set(platform + ":" + id, map);
    this.refreshed.set(platform + ":" + id, Date.now());
  }
  text(text, platform, id) {
    const map = this.maps.get(platform + ":" + id);
    return String(text || "")
      .split(/(\s+)/u)
      .filter(Boolean)
      .map(
        (word) =>
          map?.get(word) || {
            type: word.startsWith("@") ? "mention" : "text",
            text: word,
          },
      );
  }
  kick(text, id) {
    const result = [];
    let start = 0;
    for (const m of String(text).matchAll(/\[emote:(\d+):([^\]]+)\]/g)) {
      result.push(...this.text(text.slice(start, m.index), "kick", id), {
        type: "emote",
        text: m[2],
        url: `https://files.kick.com/emotes/${m[1]}/fullsize`,
      });
      start = m.index + m[0].length;
    }
    result.push(...this.text(text.slice(start), "kick", id));
    return result;
  }
  twitch(fragments, id) {
    return fragments.flatMap((f) =>
      f.type === "emote" && f.emote?.id
        ? [
            {
              type: "emote",
              text: f.text,
              url: `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(f.emote.id)}/default/dark/2.0`,
            },
          ]
        : this.text(f.text, "twitch", id),
    );
  }
  youtube(runs, id) {
    return (runs || []).flatMap((r) =>
      r.emoji?.image?.thumbnails?.length
        ? [
            {
              type: "emote",
              text: r.emoji.shortcuts?.[0] || r.emoji.emojiId || "emote",
              url: r.emoji.image.thumbnails.at(-1).url,
            },
          ]
        : this.text(r.text, "youtube", id),
    );
  }
}
