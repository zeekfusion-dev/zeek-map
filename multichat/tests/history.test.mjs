import test from "node:test";
import assert from "node:assert/strict";
import { Feed } from "../src/feed.mjs";
import { Store } from "../src/store.mjs";
const message = (id, timestamp) => ({
  id: String(id),
  platform: "kick",
  channel: "c",
  timestamp,
  user: { id: "viewer" },
  segments: [{ type: "text", text: "message " + id }],
});
test("history retains over 200 messages for 20 minutes and pages without gaps at equal timestamps", () => {
  let now = 2000000;
  const f = new Feed({ now: () => now });
  for (let i = 0; i < 650; i++)
    f.push(message(i, now - 15 * 60000 + Math.floor(i / 3)));
  f.push(message("expired", now - 21 * 60000));
  f.flush();
  assert.equal(f.messages.length, 650);
  let page = f.page(),
    all = [...page.messages];
  assert.equal(page.messages.length, 100);
  while (page.hasMore) {
    page = f.page(page.before);
    all.unshift(...page.messages);
  }
  assert.equal(all.length, 650);
  assert.equal(new Set(all.map((m) => m.id)).size, 650);
  assert.deepEqual(
    all.map((m) => m.id),
    Array.from({ length: 650 }, (_, i) => String(i)),
  );
  now += 6 * 60000;
  assert.equal(f.page().messages.length, 0);
  f.close();
});
test("new arrivals and deletion do not shift a history cursor; deleted messages never load", () => {
  const f = new Feed({ now: () => 2000000 });
  for (let i = 0; i < 250; i++) f.push(message(i, 1900000 + i));
  f.flush();
  const page = f.page();
  f.push(message("new", 2000000));
  f.flush();
  f.moderate({ platform: "kick", channel: "c", id: "149" });
  const older = f.page(page.before);
  assert.equal(older.messages.at(-1).id, "148");
  assert.ok(!older.messages.some((m) => m.id === "new" || m.id === "149"));
  f.close();
});
test("retained scrollback survives restart with ordering, dedup and moderation intact", () => {
  const store = new Store(":memory:", "test");
  const f = new Feed({ store, now: () => 2000000 });
  f.push(message("a", 1999000));
  f.push(message("b", 1999000));
  f.flush();
  f.moderate({ platform: "kick", channel: "c", id: "a" });
  f.close();
  const next = new Feed({ store, now: () => 2000001 });
  assert.deepEqual(
    next.page().messages.map((m) => m.id),
    ["b"],
  );
  next.push(message("b", 1999000));
  next.push(message("c", 2000001));
  next.flush();
  assert.deepEqual(
    next.messages.map((m) => m.id),
    ["b", "c"],
  );
  assert.ok(next.messages[1].sequence > next.messages[0].sequence);
  next.close();
  store.db.close();
});

test("restart preserves pending rows and accepts late unseen platform messages behind the saved timestamp", () => {
  const store = new Store(":memory:", "test");
  const first = new Feed({ store, now: () => 2000000 });
  first.push(message("last-before-restart", 1999900));
  first.close();
  const next = new Feed({ store, now: () => 2001000 });
  next.push(message("last-before-restart", 1999900));
  next.push({
    ...message("late-from-other-platform", 1999800),
    platform: "twitch",
  });
  next.flush();
  assert.deepEqual(
    next.messages.map((m) => m.id),
    ["late-from-other-platform", "last-before-restart"],
  );
  next.close();
  store.db.close();
});
