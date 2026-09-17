import { setTimeout as sleep } from "node:timers/promises";
export { sleep };
export async function request(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
  });
  if (!r.ok) {
    const e = new Error(`Provider returned ${r.status}`);
    e.status = r.status;
    e.retryAfter = Math.max(
      1000,
      Number(r.headers.get("retry-after") || 0) * 1000,
    );
    throw e;
  }
  return r;
}
export async function json(url, options) {
  return (await request(url, options)).json();
}
export function https(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
export function timestamp(value) {
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : Date.now();
}
export async function retryLoop(signal, work, status) {
  let failures = 0;
  while (!signal.aborted) {
    try {
      await work(signal);
      failures = 0;
    } catch (e) {
      if (signal.aborted) break;
      status(
        e.status === 401
          ? "Reconnect account"
          : e.status === 429
            ? "Rate limited; retrying"
            : "Reconnecting",
      );
      failures++;
      await sleep(
        Math.max(
          e.retryAfter || 0,
          Math.min(60000, 1000 * 2 ** Math.min(failures, 6)) +
            Math.random() * 500,
        ),
        undefined,
        { signal },
      ).catch(() => {});
    }
  }
}
