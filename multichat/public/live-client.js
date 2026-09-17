export class LiveConnection {
  constructor({
    url,
    key,
    onEvent,
    onState,
    WebSocketImpl = WebSocket,
    now = Date.now,
    timers = globalThis,
    random = Math.random,
  }) {
    Object.assign(this, {
      url,
      key,
      onEvent,
      onState,
      WebSocketImpl,
      now,
      timers,
      random,
    });
    this.delay = 1000;
    this.stopped = false;
    this.socket = null;
    this.last = now();
  }
  start() {
    this.connect();
    this.heartbeat = this.timers.setInterval(() => this.tick(), 20000);
    return this;
  }
  connect() {
    if (this.stopped) return;
    this.onState("connecting");
    this.last = this.now();
    const ws = new this.WebSocketImpl(this.url);
    this.socket = ws;
    ws.onopen = () => {
      if (this.socket !== ws) return;
      this.last = this.now();
      ws.send(JSON.stringify({ key: this.key }));
    };
    ws.onmessage = (e) => {
      if (this.socket !== ws) return;
      try {
        const data = JSON.parse(e.data);
        this.last = this.now();
        if (data.type === "snapshot" || data.type === "pong") {
          this.delay = 1000;
          this.onState("connected", data.platforms);
        }
        if (data.type !== "pong") this.onEvent(data);
      } catch {
        this.onState("reconnecting");
      }
    };
    ws.onclose = (e) => {
      if (this.socket !== ws || this.stopped) return;
      this.socket = null;
      if (e.code === 1008) {
        this.stop();
        this.onState("unauthorized");
        return;
      }
      this.onState("reconnecting");
      this.retry = this.timers.setTimeout(
        () => this.connect(),
        this.delay + this.random() * 300,
      );
      this.delay = Math.min(this.delay * 2, 15000);
    };
    ws.onerror = () => {
      if (this.socket === ws) ws.close();
    };
  }
  tick() {
    const ws = this.socket;
    if (!ws) return;
    if (this.now() - this.last > 60000) {
      this.onState("reconnecting");
      ws.close();
      return;
    }
    if (ws.readyState === 1)
      ws.send(JSON.stringify({ type: "ping", at: this.now() }));
  }
  stop() {
    this.stopped = true;
    this.timers.clearInterval(this.heartbeat);
    this.timers.clearTimeout(this.retry);
    this.socket?.close();
    this.socket = null;
  }
}
