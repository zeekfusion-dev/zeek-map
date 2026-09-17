const app = document.querySelector("#app");
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const validImage = (url) => {
  try {
    return (
      new URL(url, location.origin).protocol === "https:" ||
      String(url).startsWith("/assets/")
    );
  } catch {
    return false;
  }
};
function picture(url, label, cls) {
  if (!validImage(url))
    return el("span", cls === "badge" ? "badge-label" : "", label);
  const img = el("img", cls);
  img.src = url;
  img.alt = label || "";
  img.title = label || "";
  img.decoding = "async";
  img.addEventListener(
    "error",
    () =>
      img.replaceWith(el("span", cls === "badge" ? "badge-label" : "", label)),
    { once: true },
  );
  return img;
}
function segments(parts) {
  const f = document.createDocumentFragment();
  for (const s of parts || [])
    f.append(
      s.type === "emote"
        ? picture(s.url, s.text, "emote" + (s.zeroWidth ? " zero" : ""))
        : el("span", s.type === "mention" ? "mention" : "", s.text),
    );
  return f;
}
function message(m, settings) {
  const row = el("div", "chat-line");
  row.dataset.id = m.platform + ":" + m.channel + ":" + m.id;
  if (m.reply) {
    const reply = el("div", "reply");
    reply.append(
      el("span", "", `↳ ${m.reply.name}: `),
      segments(m.reply.segments),
    );
    row.append(reply);
  }
  const content = el("span", "chat-content");
  content.append(
    picture("/assets/" + m.platform + ".png", m.platform, "platform-icon"),
  );
  if (settings.avatars && m.user.avatar)
    content.append(picture(m.user.avatar, m.user.name, "avatar"));
  for (const badge of m.user.badges || [])
    content.append(
      badge.url
        ? picture(badge.url, badge.label, "badge")
        : el(
            "span",
            "badge-label",
            badge.label + (badge.count ? " " + badge.count : ""),
          ),
    );
  const name = el("span", "username", m.user.name);
  if (/^#[\da-f]{3,8}$/i.test(m.user.color || ""))
    name.style.color = m.user.color;
  content.append(name, el("span", "", ": "), segments(m.segments));
  row.append(content);
  return row;
}
const defaults = {
  fontSize: 19,
  background: 0,
  bold: true,
  avatars: false,
  maxMessages: 120,
};
function overlay(preview = false) {
  document.documentElement.style.background = "transparent";
  document.body.className = "overlay";
  const viewport = el("div", "chat-viewport"),
    feed = el("div", "chat-feed");
  viewport.append(feed);
  app.append(viewport);
  let data = [],
    settings = { ...defaults },
    scheduled = false,
    animate = true;
  const nodes = new Map();
  const key = (m) => `${m.platform}:${m.channel}:${m.id}`;
  function draw() {
    scheduled = false;
    document.body.style.setProperty("--font", settings.fontSize + "px");
    document.body.style.setProperty("--bubble", settings.background);
    document.body.style.setProperty("--weight", settings.bold ? 700 : 400);
    data.sort(
      (a, b) =>
        a.timestamp - b.timestamp || (a.sequence || 0) - (b.sequence || 0),
    );
    data = data.slice(-settings.maxMessages);
    const keep = new Set(data.map(key));
    for (const [id, n] of nodes)
      if (!keep.has(id)) {
        n.remove();
        nodes.delete(id);
      }
    let previous = null;
    for (const m of data) {
      const id = key(m);
      let n = nodes.get(id);
      if (!n) {
        n = message(m, settings);
        nodes.set(id, n);
        if (!animate) n.style.animation = "none";
      }
      if (n.previousSibling !== previous) {
        if (previous) previous.after(n);
        else feed.prepend(n);
      }
      previous = n;
    }
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: data.length > 20 ? "instant" : "smooth",
    });
    animate = true;
  }
  const render = () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(draw);
    }
  };
  const clearNodes = () => {
    nodes.clear();
    feed.replaceChildren();
    animate = false;
  };
  function handle(e) {
    if (e.type === "settings") {
      settings = { ...defaults, ...e.settings };
      clearNodes();
    }
    if (e.type === "snapshot") {
      data = e.messages;
      settings = { ...defaults, ...e.settings };
      clearNodes();
    }
    if (e.type === "messages") {
      for (const m of e.messages) {
        if (!data.some((x) => key(x) === key(m))) data.push(m);
      }
    }
    if (e.type === "update") {
      const index = data.findIndex((m) => key(m) === key(e.message));
      if (index >= 0) {
        data[index] = e.message;
        nodes.get(key(e.message))?.remove();
        nodes.delete(key(e.message));
      }
    }
    if (e.type === "remove")
      data = data.filter(
        (m) =>
          m.platform !== e.platform ||
          m.channel !== e.channel ||
          (e.id
            ? m.id !== e.id
            : e.userId
              ? m.user.id !== e.userId || m.timestamp > e.timestamp
              : m.timestamp > e.timestamp),
      );
    render();
  }
  if (preview) {
    handle({ type: "snapshot", settings, messages: samples() });
    window.addEventListener("message", (e) => {
      if (e.origin !== location.origin || e.source !== parent) return;
      if (e.data.type === "settings") handle(e.data);
      if (e.data.type === "sample")
        handle({ type: "snapshot", settings, messages: samples() });
    });
    return;
  }
  const token = location.hash.slice(1);
  if (!token) {
    app.append(
      el("p", "error", "Open the private OBS URL from your dashboard."),
    );
    return;
  }
  const warning = el("div", "connection-warning");
  warning.title = "Reconnecting";
  app.append(warning);
  let delay = 1000,
    ws,
    last = Date.now();
  function connect() {
    ws = new WebSocket(location.origin.replace(/^http/, "ws") + "/live");
    ws.onopen = () => ws.send(JSON.stringify({ key: token }));
    ws.onmessage = (e) => {
      last = Date.now();
      try {
        handle(JSON.parse(e.data));
        warning.hidden = true;
        delay = 1000;
      } catch {}
    };
    ws.onclose = () => {
      warning.hidden = false;
      setTimeout(connect, delay + Math.random() * 300);
      delay = Math.min(delay * 2, 15000);
    };
    ws.onerror = () => ws.close();
  }
  connect();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && ws.readyState === 3) warning.hidden = false;
  });
}
function samples() {
  const time = Date.now();
  return [
    {
      platform: "kick",
      name: "ZeekFusion",
      color: "#53fc18",
      badges: [
        {
          label: "broadcaster",
          url: "https://raw.githubusercontent.com/id3adeye/kickicons/refs/heads/main/kick-broadcaster.png",
        },
      ],
      text: "One chat. The whole community. 💚",
    },
    {
      platform: "twitch",
      name: "violetwaves",
      color: "#be8cff",
      badges: [],
      text: "This looks so clean in OBS",
    },
    {
      platform: "kick",
      name: "nightshift",
      color: "#51d4ee",
      badges: [
        {
          label: "moderator",
          url: "https://raw.githubusercontent.com/id3adeye/kickicons/refs/heads/main/kick-moderator.png",
        },
      ],
      text: "@ZeekFusion we’re ready!",
    },
    {
      platform: "twitch",
      name: "orbit",
      color: "#ffbf69",
      badges: [],
      text: "",
      emote: {
        type: "emote",
        text: "Kappa",
        url: "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0",
      },
    },
    {
      platform: "youtube",
      name: "Solaris",
      color: "#2ba640",
      badges: [{ label: "Member" }],
      text: "YouTube checking in 👋",
    },
    {
      platform: "kick",
      name: "Luna",
      color: "#ff80b9",
      badges: [],
      text: "all of us in the same place ✨",
    },
  ].map((s, i) => ({
    id: "sample-" + i,
    platform: s.platform,
    channel: "sample",
    timestamp: time + i,
    sequence: i,
    user: { id: "sample-" + i, name: s.name, color: s.color, badges: s.badges },
    segments: s.emote
      ? [s.emote, s.emote, s.emote]
      : [{ type: "text", text: s.text }],
  }));
}
async function api(path, body) {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(data.error || "Please try again."), {
      status: response.status,
    });
  return data;
}
async function dashboard() {
  let state;
  try {
    state = await api("/api/status");
  } catch (e) {
    if (e.status !== 401) {
      app.textContent = e.message;
      return;
    }
    login();
    return;
  }
  app.innerHTML =
    '<header><div class="brand">ZEEK<span>FUSION</span></div><div class="row"><small>MULTICHAT</small><button id="logout">Sign out</button></div></header><div class="layout"><section><div class="eyebrow">Your stream, together</div><h1>Multichat</h1><p>Connect your channels. Add one URL to OBS.</p><div class="connections" id="platforms"></div><div class="panel"><h2>OBS browser source</h2><input class="url" id="overlayUrl" aria-label="Private OBS browser source URL" readonly><div class="row"><button class="primary" id="copy">Copy URL</button><a class="button" id="open" target="_blank" rel="noreferrer">Open overlay</a></div><p class="help">Paste into an OBS Browser Source. Start at 450 × 800. This dashboard can stay closed while you stream.</p></div><div class="notice">Your OBS link stays the same across streams. Keep the link private.</div><p class="error" id="error" role="status"></p></section><aside class="preview"><div class="row spread"><h2>Overlay preview</h2><span class="sample-label">Sample messages</span></div><div class="preview-frame"><iframe src="/preview" title="Sample multichat overlay"></iframe></div><div class="panel"><h2>Appearance</h2><div class="controls"><label>Text size<input id="font" type="range" min="12" max="48"></label><label>Background opacity<input id="background" type="range" min="0" max="0.9" step="0.05"></label><label class="check"><input id="bold" type="checkbox">Bold messages</label><label class="check"><input id="avatars" type="checkbox">Profile images</label></div><button id="save" class="primary" style="margin-top:20px">Save appearance</button></div></aside></div>';
  const error = document.querySelector("#error");
  const action = (fn) => async () => {
    try {
      error.textContent = "";
      await fn();
    } catch (e) {
      error.textContent = e.message;
    }
  };
  function updatePlatforms() {
    const root = document.querySelector("#platforms");
    root.replaceChildren();
    for (const [p, title] of [
      ["kick", "Kick"],
      ["twitch", "Twitch"],
      ["youtube", "YouTube"],
    ]) {
      const s = state.platforms[p],
        row = el("div", "platform");
      row.append(picture("/assets/" + p + ".png", p, ""));
      const info = el("div");
      info.append(
        el("strong", "", title + (s.account ? " · " + s.account : "")),
        el(
          "span",
          "state" + (s.state === "Connected" ? " live" : ""),
          (s.state || "Not connected") + (s.detail ? " · " + s.detail : ""),
        ),
      );
      row.append(info);
      const connect = el("button", "", s.account ? "Reconnect" : "Connect");
      connect.addEventListener(
        "click",
        action(async () => {
          if (p === "kick") {
            await api("/api/reconnect/kick", {});
            await refresh();
          } else if (s.configured) location.href = "/auth/" + p;
          else
            error.textContent = `${title}: add the client ID and secret in Render → Environment. Callback: ${state.callbacks[p]}`;
        }),
      );
      row.append(connect);
      if (p === "kick") {
        const form = el("form", "subform"),
          input = el("input");
        input.placeholder = "Kick channel name";
        input.setAttribute("aria-label", "Kick channel name");
        input.value = state.kickChannel;
        const save = el("button", "", "Save");
        form.append(input, save);
        form.onsubmit = (e) => {
          e.preventDefault();
          action(async () => {
            await api("/api/kick", { channel: input.value });
            await refresh();
          })();
        };
        row.append(form);
        if (s.configured) {
          const auth = el("a", "help", "Authorize official backup");
          auth.href = "/auth/kick";
          row.append(el("span"), auth);
        }
      } else if (!s.configured) {
        const note = el(
          "div",
          "config-note",
          `${title} app credentials required in hosting settings.`,
        );
        note.style.gridColumn = "2 / -1";
        row.append(note);
      }
      root.append(row);
    }
  }
  const url = document.querySelector("#overlayUrl");
  url.value = state.overlayUrl;
  document.querySelector("#open").href = state.overlayUrl;
  document.querySelector("#copy").onclick = action(async () => {
    await navigator.clipboard.writeText(state.overlayUrl);
    document.querySelector("#copy").textContent = "Copied";
  });
  document.querySelector("#logout").onclick = action(async () => {
    await api("/api/logout", {});
    location.reload();
  });
  const font = document.querySelector("#font"),
    background = document.querySelector("#background"),
    bold = document.querySelector("#bold"),
    avatars = document.querySelector("#avatars");
  font.value = state.settings.fontSize;
  background.value = state.settings.background;
  bold.checked = state.settings.bold;
  avatars.checked = state.settings.avatars;
  const read = () => ({
    ...state.settings,
    fontSize: Number(font.value),
    background: Number(background.value),
    bold: bold.checked,
    avatars: avatars.checked,
  });
  const preview = () =>
    document
      .querySelector("iframe")
      .contentWindow.postMessage(
        { type: "settings", settings: read() },
        location.origin,
      );
  for (const control of [font, background, bold, avatars])
    control.oninput = preview;
  document.querySelector("iframe").onload = preview;
  document.querySelector("#save").onclick = action(async () => {
    state.settings = await api("/api/settings", read());
    document.querySelector("#save").textContent = "Saved";
  });
  updatePlatforms();
  async function refresh() {
    state = await api("/api/status");
    updatePlatforms();
  }
  setInterval(() => {
    if (!document.querySelector(".subform input:focus"))
      refresh().catch(() => {});
  }, 10000);
}
function login() {
  app.innerHTML =
    '<section class="login"><div class="eyebrow">ZeekFusion</div><h1>Multichat</h1><p>Your private streaming dashboard.</p><form><label>Dashboard password<input type="password" name="password" autocomplete="current-password" required></label><button class="primary">Sign in</button><div class="error" role="status"></div></form></section>';
  app.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("/api/login", { password: app.querySelector("input").value });
      await dashboard();
    } catch (err) {
      app.querySelector(".error").textContent = err.message;
    }
  };
}
if (location.pathname === "/overlay") overlay();
else if (location.pathname === "/preview") overlay(true);
else dashboard();
