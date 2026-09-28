import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/store.mjs";
import { Sessions } from "../src/sessions.mjs";
test("remembered login survives restart, expires after 30 days and never stores its bearer token", async () => {
  const store = new Store(":memory:", "test-key");
  let now = 1000000;
  const sessions = new Sessions(store, "password", () => now);
  const { id, maxAge } = await sessions.create(true);
  assert.equal(maxAge, 30 * 86400000);
  assert.ok(!store.get("remembered-sessions").includes(id));
  assert.ok(
    !JSON.stringify(store.unseal(store.get("remembered-sessions"))).includes(
      id,
    ),
  );
  const restored = new Sessions(store, "password", () => now);
  assert.ok(restored.valid(id));
  now += maxAge;
  assert.equal(restored.valid(id), false);
  store.db.close();
});
test("logout and password changes invalidate remembered login; temporary login is not restored", async () => {
  const store = new Store(":memory:", "test-key");
  const sessions = new Sessions(store, "password");
  const remembered = await sessions.create(true),
    temporary = await sessions.create(false);
  assert.equal(new Sessions(store, "password").valid(temporary.id), false);
  assert.equal(new Sessions(store, "new-password").valid(remembered.id), false);
  await sessions.revoke(remembered.id);
  assert.equal(new Sessions(store, "password").valid(remembered.id), false);
  store.db.close();
});
test("failed durable save does not issue a remembered session; a new login replaces the old cookie", async () => {
  const store = new Store(":memory:", "test-key");
  const sessions = new Sessions(store, "password");
  const first = await sessions.create(true);
  const next = await sessions.create(true, first.id);
  assert.equal(sessions.valid(first.id), false);
  assert.ok(sessions.valid(next.id));
  store.flush = async () => {
    throw Error("storage unavailable");
  };
  await assert.rejects(sessions.create(true), /storage unavailable/);
  assert.equal(sessions.remembered.size, 1);
  store.db.close();
});
