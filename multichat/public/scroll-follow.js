// Layout and programmatic scroll events must never pause the live feed.
// Only an explicit gesture to read older messages can do that.
export class ScrollFollow {
  constructor(viewport) {
    this.viewport = viewport;
    this.following = true;
    this.dragging = false;
    this.lastTop = viewport.scrollTop;
    viewport.addEventListener(
      "wheel",
      (e) => {
        if (e.deltaY < 0) this.pause();
        else if (e.deltaY > 0) this.pausePending = false;
      },
      { passive: true },
    );
    viewport.addEventListener("keydown", (e) => {
      if (
        ["ArrowUp", "PageUp", "Home"].includes(e.key) ||
        (e.key === " " && e.shiftKey)
      )
        this.pause();
      if (["ArrowDown", "PageDown", "End"].includes(e.key))
        this.pausePending = false;
      if (e.key === "End") this.following = true;
    });
    viewport.addEventListener(
      "touchstart",
      (e) => {
        this.touchY = e.touches[0]?.clientY;
      },
      { passive: true },
    );
    viewport.addEventListener(
      "touchmove",
      (e) => {
        const y = e.touches[0]?.clientY;
        if (y > this.touchY) this.pause();
        else if (y < this.touchY) this.pausePending = false;
        this.touchY = y;
      },
      { passive: true },
    );
    viewport.addEventListener("pointerdown", () => {
      this.dragging = true;
      this.lastTop = viewport.scrollTop;
    });
    const release = () => {
      this.dragging = false;
    };
    viewport.addEventListener("pointerup", release);
    viewport.addEventListener("pointercancel", release);
    viewport.addEventListener("pointerleave", release);
    viewport.addEventListener(
      "scroll",
      () => {
        if (this.pausePending && viewport.scrollTop < this.pauseTop)
          this.pausePending = false;
        if (this.dragging && viewport.scrollTop < this.lastTop) {
          this.following = false;
          this.pausePending = false;
        }
        // A paused reader can return to live by scrolling all the way down.
        if (
          !this.pausePending &&
          viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <=
            2
        )
          this.following = true;
        this.lastTop = viewport.scrollTop;
      },
      { passive: true },
    );
  }
  pause() {
    if (this.viewport.scrollTop > 0) {
      this.following = false;
      this.pausePending = true;
      this.pauseTop = this.viewport.scrollTop;
    }
  }
  bottom() {
    if (this.following) this.viewport.scrollTop = this.viewport.scrollHeight;
    this.lastTop = this.viewport.scrollTop;
  }
}
