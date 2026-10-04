/**
 * pwa/src/lib/x32.js
 * SvelteKit client helpers — X32 Proxy (port 9091)
 *
 * Env (pwa/.env.local):
 *   PUBLIC_X32_PROXY_URL   http://localhost:9091
 */
import { PUBLIC_X32_PROXY_URL } from '$env/static/public';

const PROXY = PUBLIC_X32_PROXY_URL ?? 'http://localhost:9091';

// ─── Fader & mute commands ────────────────────────────────────────────────────
/**
 * target examples:  'ch/01'  'ch/12'  'dca/1'  'main'
 */
export const x32 = {
  /** Get fader level (0.0–1.0). @returns {Promise<{ address, value }>} */
  getFader(target)           { return _get(`/fader/${target}`); },
  /** Set fader level (0.0–1.0). */
  setFader(target, value)    { return _post(`/fader/${target}`,  { value }); },
  /** Set mute state. on=true means channel is ACTIVE (not muted). */
  setMute(target, on)        { return _post(`/mute/${target}`,   { on }); },
  /** Send arbitrary OSC. @param {string} address  @param {any[]} args */
  sendOsc(address, args = []) { return _post('/osc', { address, args }); },
  /** Full 32ch + 8 DCA + main snapshot. @returns {Promise<Record<string,number>>} */
  getSnapshot()              { return _get('/snapshot'); },
  /** Proxy health. */
  health()                   { return _get('/health'); },
};

// ─── Convenience fader helpers ────────────────────────────────────────────────

/** Set a channel fader. ch = 1–32, value = 0.0–1.0 */
export function setChannelFader(ch, value) {
  return x32.setFader(`ch/${String(ch).padStart(2, '0')}`, value);
}

/** Mute a channel. ch = 1–32 */
export function muteChannel(ch)   { return x32.setMute(`ch/${String(ch).padStart(2,'0')}`, false); }
/** Unmute a channel. ch = 1–32 */
export function unmuteChannel(ch) { return x32.setMute(`ch/${String(ch).padStart(2,'0')}`, true); }

/** Set a DCA fader. dca = 1–8, value = 0.0–1.0 */
export function setDcaFader(dca, value) { return x32.setFader(`dca/${dca}`, value); }

// ─── SSE subscription ────────────────────────────────────────────────────────
/**
 * Subscribe to live X32 parameter changes via SSE.
 *
 * @param {function} onEvent   Called with { address, args[], ts } on each X32 push.
 * @param {function} [onError] Called on connection error.
 * @returns {function}         Unsubscribe — call in onDestroy().
 *
 * @example
 *   import { subscribeToX32 } from '$lib/x32';
 *   import { onDestroy } from 'svelte';
 *
 *   let faders = $state({});
 *   const unsub = subscribeToX32(evt => {
 *     if (evt.address?.includes('/mix/fader')) {
 *       faders[evt.address] = evt.args[0];
 *     }
 *   });
 *   onDestroy(unsub);
 */
export function subscribeToX32(onEvent, onError) {
  if (typeof EventSource === 'undefined') return () => {};   // SSR guard

  const es = new EventSource(`${PROXY}/events`);

  es.onmessage = (e) => {
    try { onEvent(JSON.parse(e.data)); }
    catch { /* ignore malformed */ }
  };

  es.onerror = (e) => onError?.(e);

  return () => es.close();
}

// ─── Internal fetch helpers ───────────────────────────────────────────────────

async function _get(path) {
  const res = await fetch(`${PROXY}${path}`);
  if (!res.ok) throw new Error(`x32-proxy ${path} → ${res.status}`);
  return res.json();
}

async function _post(path, body) {
  const res = await fetch(`${PROXY}${path}`, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`x32-proxy ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}
