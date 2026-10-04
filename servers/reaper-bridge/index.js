/**
 * =============================================================================
 * Shenanigans Studio — Reaper Bridge  (port 9090)
 * =============================================================================
 * Strategy: Option A — Wrap, don't replace.
 *
 * This server sits in front of the existing Python Show API (port 5000) and
 * adds two things the Python server cannot do:
 *
 *   1. SSE stream  GET /events
 *      Polls Python every POLL_MS and pushes REAPER state changes to all
 *      connected PWA clients in real time.
 *
 *   2. Transparent HTTP proxy  /* → http://localhost:5000/*
 *      Every other route is forwarded to Python unchanged.  The PWA only
 *      ever talks to port 9090 — Python on 5000 stays off the network.
 *
 * Python Show API (port 5000) assumed endpoints:
 *   GET  /state          → JSON REAPER transport + track state
 *   POST /play           → start playback
 *   POST /stop           → stop playback
 *   POST /record         → arm + record
 *   POST /song           → load song  { name: string }
 *   GET  /tracks         → track list
 *   … any others pass through transparently
 *
 * SSE event shape:
 *   { type: 'state', payload: <Python /state response>, ts: epochMs }
 *   { type: 'error', message: string, ts: epochMs }
 *   { type: 'connected', ts: epochMs }
 *
 * Environment variables (D:\ShenanigansStudio\.env.local):
 *   REAPER_BRIDGE_PORT   port this server listens on   (default 9090)
 *   PYTHON_API_URL       Python Show API base URL       (default http://localhost:5000)
 *   POLL_MS              state poll interval in ms      (default 500)
 * =============================================================================
 */

import { config }        from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import express            from 'express';
import cors               from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

// ─── Env ─────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../');
config({ path: resolve(ROOT, '.env.local') });
config({ path: resolve(ROOT, '.env') });

const PORT       = Number(process.env.REAPER_BRIDGE_PORT) || 9090;
const PYTHON_URL = process.env.PYTHON_API_URL ?? 'http://localhost:5000';
const POLL_MS    = Number(process.env.POLL_MS)  || 500;

// ─── State cache ─────────────────────────────────────────────────────────────
// Keeps last known REAPER state so we only broadcast on actual changes.
let lastStateJson = '';
let pythonOnline  = false;

// ─── SSE client registry ─────────────────────────────────────────────────────
const sseClients = new Set();

function broadcast(type, data) {
  const payload = JSON.stringify({ type, ...data, ts: Date.now() });
  for (const res of sseClients) {
    res.write(`data: ${payload}\n\n`);
  }
}

// ─── Python state poller ─────────────────────────────────────────────────────
async function pollPython() {
  try {
    const res  = await fetch(`${PYTHON_URL}/state`, { signal: AbortSignal.timeout(POLL_MS - 50) });
    const json = await res.text();

    if (!pythonOnline) {
      pythonOnline = true;
      console.log('[reaper-bridge] Python Show API is online');
    }

    if (json !== lastStateJson) {
      lastStateJson = json;
      try {
        broadcast('state', { payload: JSON.parse(json) });
      } catch {
        broadcast('state', { payload: json });
      }
    }
  } catch (err) {
    if (pythonOnline) {
      pythonOnline = false;
      console.warn(`[reaper-bridge] Python Show API offline: ${err.message}`);
      broadcast('error', { message: 'Python Show API unreachable' });
    }
  }
}

// ─── Express ─────────────────────────────────────────────────────────────────
const app = express();

app.use(cors());

// ── GET /health ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({
  bridge      : 'ok',
  pythonOnline,
  pythonUrl   : PYTHON_URL,
  pollMs      : POLL_MS,
  sseClients  : sseClients.size,
}));

// ── GET /events  (SSE) ────────────────────────────────────────────────────────
app.get('/events', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');   // nginx: disable buffering
  res.flushHeaders();

  // Send current state immediately on connect
  res.write(`data: ${JSON.stringify({ type: 'connected', pythonOnline, ts: Date.now() })}\n\n`);
  if (lastStateJson) {
    try {
      res.write(`data: ${JSON.stringify({ type: 'state', payload: JSON.parse(lastStateJson), ts: Date.now() })}\n\n`);
    } catch { /* ignore */ }
  }

  sseClients.add(res);
  console.log(`[reaper-bridge] SSE client connected (total: ${sseClients.size})`);

  // Keepalive ping every 15s so proxies don't close the connection
  const ping = setInterval(() => res.write(': ping\n\n'), 15_000);

  req.on('close', () => {
    clearInterval(ping);
    sseClients.delete(res);
    console.log(`[reaper-bridge] SSE client disconnected (total: ${sseClients.size})`);
  });
});

// ── /* → Python proxy ─────────────────────────────────────────────────────────
// All other routes are forwarded transparently to the Python Show API.
app.use(
  '/',
  createProxyMiddleware({
    target      : PYTHON_URL,
    changeOrigin: true,
    on: {
      error(err, _req, res) {
        console.error('[reaper-bridge] Proxy error:', err.message);
        if (typeof res.status === 'function') {
          res.status(502).json({ error: 'Python Show API unreachable', detail: err.message });
        }
      },
    },
  }),
);

// ─── Boot ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('============================================');
  console.log('  Shenanigans Studio — Reaper Bridge');
  console.log('============================================');
  console.log(`  Bridge  : http://localhost:${PORT}`);
  console.log(`  Python  : ${PYTHON_URL}  (proxied)`);
  console.log(`  Poll    : every ${POLL_MS}ms`);
  console.log('');
  console.log('  Routes:');
  console.log('    GET  /health     bridge + python status');
  console.log('    GET  /events     SSE stream of REAPER state');
  console.log('    /*               transparent proxy → Python :5000');
  console.log('============================================');
  console.log('');

  // Start polling immediately
  pollPython();
  setInterval(pollPython, POLL_MS);
});
