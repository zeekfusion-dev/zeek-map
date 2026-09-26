import test from "node:test";
import assert from "node:assert/strict";
import { ScrollFollow } from "../public/scroll-follow.js";
function fixture() {
  const listeners = new Map();
  const v = {
    scrollTop: 700,
    scrollHeight: 1000,
    clientHeight: 300,
    addEventListener(type, fn) {
      const a = listeners.get(type) || [];
      a.push(fn);
      listeners.set(type, a);
    },
  };
  const state = new ScrollFollow(v);
  const event = (type, data = {}) => {
    for (const fn of listeners.get(type) || []) fn(data);
  };
  return { v, state, event };
}
test("content growth and CEF layout scroll events do not disable automatic scrolling", () => {
  const { v, state, event } = fixture();
  v.scrollHeight = 1200;
  event("scroll");
  assert.equal(state.following, true);
  state.bottom();
  assert.equal(v.scrollTop, 1200);
  v.clientHeight = 0;
  v.scrollTop = 0;
  event("scroll");
  assert.equal(state.following, true);
  v.clientHeight = 300;
  state.bottom();
  assert.equal(v.scrollTop, 1200);
});
test("intentional upward wheel pauses; new messages and history adjustments retain the reader position", () => {
  const { v, state, event } = fixture();
  event("wheel", { deltaY: -80 });
  v.scrollTop = 620;
  event("scroll");
  assert.equal(state.following, false);
  v.scrollHeight += 300;
  state.bottom();
  assert.equal(v.scrollTop, 620);
  v.scrollTop += 400;
  v.scrollHeight += 400;
  event("scroll");
  state.bottom();
  assert.equal(v.scrollTop, 1020);
  assert.equal(state.following, false);
  v.scrollTop = v.scrollHeight - v.clientHeight;
  event("scroll");
  assert.equal(state.following, true);
});
test("keyboard, touch, and scrollbar gestures support scrollback and End resumes live", () => {
  for (const gesture of ["keyboard", "touch", "drag"]) {
    const { v, state, event } = fixture();
    if (gesture === "keyboard") event("keydown", { key: "PageUp" });
    if (gesture === "touch") {
      event("touchstart", { touches: [{ clientY: 100 }] });
      event("touchmove", { touches: [{ clientY: 160 }] });
    }
    if (gesture === "drag") {
      event("pointerdown");
      v.scrollTop = 500;
      event("scroll");
      event("pointerup");
    }
    assert.equal(state.following, false, gesture);
    event("keydown", { key: "End" });
    assert.equal(state.following, true);
    state.bottom();
    assert.equal(v.scrollTop, 1000);
  }
});
test("a queued programmatic scroll cannot cancel an upward gesture before its default movement", () => {
  const { v, state, event } = fixture();
  event("wheel", { deltaY: -80 });
  event("scroll");
  assert.equal(state.following, false);
  v.scrollTop -= 80;
  event("scroll");
  assert.equal(state.following, false);
  v.scrollTop = 700;
  event("scroll");
  assert.equal(state.following, true);
});
