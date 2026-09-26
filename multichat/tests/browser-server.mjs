// Isolated manual browser test server. Never mounted by the production entrypoint.
import { createApp } from "../src/server.mjs";
import { Store } from "../src/store.mjs";
import {
  kickMessage,
  twitchMessage,
  youtubeMessage,
} from "../src/normalize.mjs";
import { Emotes } from "../src/emotes.mjs";
import { fileURLToPath } from "node:url";
const store = new Store(":memory:", "browser-test-only");
store.set("overlayKey", "browser-test-only");
const service = createApp({
  store,
  origin: "http://localhost:8787",
  password: "browser-test-only",
  connect: false,
});
const emotes = new Emotes();
let counter = 0;
function insert(count, historical = false) {
  for (let i = 0; i < count; i++) {
    const n = ++counter,
      stamp = new Date(
        Date.now() - (historical ? (count - i) * 2000 : 0),
      ).toISOString();
    const text = `Message ${n}: live reliability test ` + "longword".repeat(15);
    const p = n % 3;
    const m =
      p === 0
        ? kickMessage(
            {
              id: String(n),
              created_at: stamp,
              content: text,
              sender: {
                id: 1,
                username: "KickTest",
                identity: { badges: [{ type: "subscriber", count: 1 }] },
              },
            },
            "test",
            emotes,
          )
        : p === 1
          ? twitchMessage(
              {
                message_id: String(n),
                timestamp: stamp,
                chatter_user_id: "2",
                chatter_user_name: "TwitchTest",
                message: { text },
              },
              "test",
              emotes,
              new Map(),
            )
          : youtubeMessage(
              {
                id: String(n),
                snippet: { publishedAt: stamp, displayMessage: text },
                authorDetails: { channelId: "3", displayName: "YouTubeTest" },
              },
              "test",
              emotes,
            );
    service.feed.push(m);
    service.feed.push(m); // Deliberate provider duplicate.
  }
  service.feed.flush();
}
insert(450, true);
service.app.get("/test", (_, res) =>
  res.sendFile(fileURLToPath(new URL("./browser-test.html", import.meta.url)), {
    dotfiles: "allow",
  }),
);
service.app.get("/browser-test.js", (_, res) =>
  res.sendFile(fileURLToPath(new URL("./browser-test.js", import.meta.url)), {
    dotfiles: "allow",
  }),
);
service.app.post("/test/messages", (req, res) => {
  insert(Math.min(350, Number(req.body.count) || 1));
  res.json({ counter });
});
service.app.post("/test/disconnect", (_, res) => {
  for (const ws of service.sockets.clients) ws.terminate();
  insert(250);
  res.json({ counter });
});
service.app.post("/test/moderate", (_, res) => {
  service.feed.moderate({ platform: "kick", channel: "test", id: "450" });
  res.json({ ok: true });
});
service.server.listen(8787, "0.0.0.0", () =>
  console.log("Isolated browser test: http://localhost:8787/test"),
);
