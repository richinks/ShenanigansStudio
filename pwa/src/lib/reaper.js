/**
 * pwa/src/lib/reaper.js
 * SvelteKit client helpers — Reaper Bridge (port 9090)
 *
 * Env (pwa/.env.local):
 *   PUBLIC_REAPER_BRIDGE_URL   http://localhost:9090
 */
import { PUBLIC_REAPER_BRIDGE_URL } from '$env/static/public';

const BRIDGE = PUBLIC_REAPER_BRIDGE_URL ?? 'http://localhost:9090';

// ─── Transport commands ───────────────────────────────────────────────────────

export const reaper = {
  /** Start playback. */
  play()              { return _post('/play'); },
  /** Stop playback. */
  stop()              { return _post('/stop'); },
  /** Pause playback. */
  pause()             { return _post('/pause'); },
  /** Start recording. */
  record()            { return _post('/record'); },
  /** Load a song by name. @param {string} name */
  loadSong(name)      { return _post('/song',  { name }); },
  /** Jump to a marker by name or number. */
  gotoMarker(marker)  { return _post('/marker', { marker }); },
  /** Get current REAPER transport + track state. */
  getState()          { return _get('/state'); },
  /** Get full track list. */
  getTracks()         { return _get('/tracks'); },
  /** Bridge health (includes pythonOnline flag). */
  health()            { return _get('/health'); },
};

// ─── SSE subscription ────────────────────────────────────────────────────────
/**
 * Subscribe to live REAPER state changes via SSE.
 *
 * @param {function} onEvent   Called with parsed event object on each change.
 * @param {function} [onError] Called on connection error.
 * @returns {function}         Unsubscribe — call this in onDestroy().
 *
 * @example
 *   import { subscribeToReaper } from '$lib/reaper';
 *   import { onDestroy } from 'svelte';
 *
 *   let reaperState = $state(null);
 *   const unsub = subscribeToReaper(evt => {
 *     if (evt.type === 'state') reaperState = evt.payload;
 *   });
 *   onDestroy(unsub);
 */
export function subscribeToReaper(onEvent, onError) {
  if (typeof EventSource === 'undefined') return () => {};   // SSR guard

  const es = new EventSource(`${BRIDGE}/events`);

  es.onmessage = (e) => {
    try { onEvent(JSON.parse(e.data)); }
    catch { /* ignore malformed */ }
  };

  es.onerror = (e) => {
    onError?.(e);
  };

  return () => es.close();
}

// ─── Internal fetch helpers ───────────────────────────────────────────────────

async function _get(path) {
  const res = await fetch(`${BRIDGE}${path}`);
  if (!res.ok) throw new Error(`reaper-bridge ${path} → ${res.status}`);
  return res.json();
}

async function _post(path, body) {
  const res = await fetch(`${BRIDGE}${path}`, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`reaper-bridge ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}
