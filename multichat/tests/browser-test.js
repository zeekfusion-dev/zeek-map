const results = document.querySelector("#results");
const obs = document.querySelector("#obs"),
  reader = document.querySelector("#reader");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const view = (f) => f.contentDocument.querySelector(".chat-viewport");
const rows = (f) => [...f.contentDocument.querySelectorAll(".chat-line")];
const ids = (f) => rows(f).map((n) => Number(n.dataset.id.split(":").at(-1)));
const bottom = (f) =>
  view(f).scrollHeight - view(f).clientHeight - view(f).scrollTop < 3;
const post = async (path, body = {}) =>
  (
    await fetch("/test/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  ).json();
const check = (yes, label) => {
  results.textContent += "\n" + (yes ? "PASS " : "FAIL ") + label;
  if (!yes) throw Error(label);
};
const waitFor = async (fn) => {
  const end = Date.now() + 10000;
  while (!fn()) {
    if (Date.now() > end) throw Error("Timed out");
    await sleep(50);
  }
};
function older() {
  const v = view(reader);
  v.dispatchEvent(
    new reader.contentWindow.WheelEvent("wheel", { deltaY: -500 }),
  );
  v.scrollTop = 0;
  v.dispatchEvent(new Event("scroll"));
}
const anchor = () =>
  rows(reader).find((n) => n.getBoundingClientRect().bottom > 0);
document.querySelector("#run").onclick = async () => {
  results.textContent = "Running";
  document.querySelector("#run").disabled = true;
  try {
    const latencies = [];
    await waitFor(() => rows(obs).length && rows(reader).length);
    check(bottom(obs) && bottom(reader), "both views initially show newest");
    // Timestamp DOM delivery itself; background-tab polling timers are throttled.
    let renderedAt = performance.now();
    const observer = new MutationObserver(() => {
      renderedAt = performance.now();
    });
    observer.observe(obs.contentDocument.querySelector(".chat-feed"), {
      childList: true,
      subtree: true,
    });
    for (let i = 0; i < 4; i++) {
      older();
      await sleep(300);
    }
    const pinned = anchor(),
      pinId = pinned.dataset.id,
      pinTop = pinned.getBoundingClientRect().top;
    check(
      ids(reader).some((n) => n < 100),
      "reader loads older history automatically",
    );
    check(
      !reader.contentDocument.querySelector(".jump-live").hidden,
      "reader offers jump to newest",
    );
    for (let i = 0; i < 36; i++) {
      const start = performance.now(),
        { counter } = await post("messages", { count: 3 });
      await waitFor(
        () => ids(obs).at(-1) === counter && ids(reader).at(-1) === counter,
      );
      latencies.push(renderedAt - start);
      check(
        [counter - 2, counter - 1, counter].every(
          (n) => ids(obs).includes(n) && ids(reader).includes(n),
        ),
        `batch ${i + 1}: every message present in both views`,
      );
      check(
        bottom(obs) && renderedAt - start < 2000,
        `batch ${i + 1}: OBS at bottom; delivery ${Math.round(renderedAt - start)}ms`,
      );
      const same = rows(reader).find((n) => n.dataset.id === pinId);
      check(
        same && Math.abs(same.getBoundingClientRect().top - pinTop) < 2,
        `batch ${i + 1}: reader position stable`,
      );
      await sleep(5000);
    }
    for (const width of [160, 260, 450, 800]) {
      obs.style.width = width + "px";
      await sleep(100);
      check(
        bottom(obs) && view(obs).scrollWidth <= view(obs).clientWidth,
        `width ${width}: latest visible, no horizontal overflow`,
      );
    }
    obs.style.height = "0px";
    await sleep(100);
    obs.style.height = "500px";
    await sleep(100);
    check(bottom(obs), "hidden/reshown overlay follows");
    const { counter } = await post("disconnect");
    await waitFor(
      () => ids(obs).at(-1) === counter && ids(reader).at(-1) === counter,
    );
    check(bottom(obs), "OBS automatically reconnects and displays latest");
    check(
      ids(reader).includes(counter - 249),
      "reader recovers more than 100 missed messages",
    );
    check(
      !reader.contentDocument.querySelector(".jump-live").hidden,
      "reconnect keeps reader paused",
    );
    await post("moderate");
    await sleep(100);
    check(!ids(reader).includes(450), "deletions synchronize");
    reader.contentDocument.querySelector(".jump-live").click();
    await sleep(100);
    check(bottom(reader), "jump to newest resumes reader");
    const all = ids(reader);
    check(new Set(all).size === all.length, "no duplicate messages");
    check(
      all.every((n, i) => !i || n > all[i - 1]),
      "chronological order",
    );
    check(
      Array.from({ length: 108 }, (_, i) => 451 + i).every((n) =>
        all.includes(n),
      ),
      "all 108 messages from paused period retained",
    );
    results.textContent += `\nMaximum batch delivery latency: ${Math.round(Math.max(...latencies))}ms`;
    results.textContent += "\nCOMPLETE: all checks passed";
  } catch (e) {
    results.textContent += "\nFAILED: " + e.message;
  }
};
