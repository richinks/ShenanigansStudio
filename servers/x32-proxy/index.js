/**
 * =============================================================================
 * Shenanigans Studio — X32 Proxy Server
 * =============================================================================
 * HTTP/SSE server (port 9091) that bridges the SvelteKit PWA to the
 * Behringer X32 Rack via OSC over UDP.
 *
 * X32 OSC protocol reference:
 *   IP   : X32_IP   (default 192.168.1.5)
 *   Port : X32_PORT (default 10023)
 *
 * Common OSC addresses:
 *   /ch/NN/mix/fader    float 0.0–1.0   channel fader
 *   /ch/NN/mix/on       int   0|1        channel mute (0=off/muted, 1=on)
 *   /ch/NN/config/name  str             channel name
 *   /dca/N/fader        float 0.0–1.0   DCA fader
 *   /dca/N/on           int   0|1        DCA on/off
 *   /main/st/mix/fader  float 0.0–1.0   main LR fader
 *   /xremote                            subscribe for 10s of push updates
 *   /-action/clearsolo                  clear all solos
 *
 * HTTP API:
 *   GET  /health                    server status
 *   POST /osc                       send arbitrary OSC  { address, args[] }
 *   GET  /fader/:target             get fader level     (ch/01, dca/1, main)
 *   POST /fader/:target             set fader level     { value: 0.0–1.0 }
 *   POST /mute/:target              set mute state      { on: true|false }
 *   GET  /snapshot                  get full channel/DCA snapshot
 *   GET  /events                    SSE stream of live X32 parameter changes
 * =============================================================================
 */

import { config }       from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import express           from 'express';
import cors              from 'cors';
import osc               from 'osc';

// ─── Env ─────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../');
config({ path: resolve(ROOT, '.env.local') });
config({ path: resolve(ROOT, '.env') });

const PORT     = Number(process.env.X32_PROXY_PORT) || 9091;
const X32_IP   = process.env.X32_IP   ?? '192.168.1.5';
const X32_PORT = Number(process.env.X32_PORT) || 10023;

// ─── OSC UDP port ─────────────────────────────────────────────────────────────
const udpPort = new osc.UDPPort({
  localAddress : '0.0.0.0',
  localPort    : 0,           // OS assigns ephemeral port for receiving
  remoteAddress: X32_IP,
  remotePort   : X32_PORT,
  metadata     : true,
});

// Pending one-shot response callbacks keyed by OSC address
const pendingCallbacks = new Map();   // address → { resolve, reject, timer }

// SSE clients
const sseClients = new Set();

udpPort.on('message', (msg) => {
  const address = msg.address;
  const args    = (msg.args ?? []).map(a => a.value ?? a);

  // Resolve any waiting HTTP request
  const pending = pendingCallbacks.get(address);
  if (pending) {
    clearTimeout(pending.timer);
    pendingCallbacks.delete(address);
    pending.resolve({ address, args });
  }

  // Broadcast to SSE clients
  const payload = JSON.stringify({ address, args, ts: Date.now() });
  for (const client of sseClients) {
    client.write(`data: ${payload}\n\n`);
  }
});

udpPort.on('error', (err) => {
  console.error('[x32-proxy] OSC error:', err.message);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sendOsc(address, args = []) {
  const oscArgs = args.map(a =>
    typeof a === 'number' && Number.isInteger(a)
      ? { type: 'i', value: a }
      : typeof a === 'number'
        ? { type: 'f', value: a }
        : { type: 's', value: String(a) }
  );
  udpPort.send({ address, args: oscArgs });
}

function queryOsc(address, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingCallbacks.delete(address);
      reject(new Error(`OSC timeout for ${address}`));
    }, timeoutMs);
    pendingCallbacks.set(address, { resolve, reject, timer });
    sendOsc(address);
  });
}

// Resolve /fader/:target → OSC address
// target examples: ch/01  dca/1  main
function faderAddress(target) {
  if (target.startsWith('ch/'))  return `/ch/${target.slice(3).padStart(2,'0')}/mix/fader`;
  if (target.startsWith('dca/')) return `/dca/${target.slice(4)}/fader`;
  if (target === 'main')         return `/main/st/mix/fader`;
  throw new Error(`Unknown target: ${target}`);
}

function muteAddress(target) {
  if (target.startsWith('ch/'))  return `/ch/${target.slice(3).padStart(2,'0')}/mix/on`;
  if (target.startsWith('dca/')) return `/dca/${target.slice(4)}/on`;
  throw new Error(`Unknown target for mute: ${target}`);
}

// ─── /xremote subscription (keeps push updates flowing) ───────────────────────
// The X32 requires /xremote to be sent every ≤10s to keep streaming parameters.
let xremoteInterval = null;
function startXremote() {
  sendOsc('/xremote');
  xremoteInterval = setInterval(() => sendOsc('/xremote'), 9_000);
  console.log('[x32-proxy] /xremote subscription active');
}

// ─── Express ─────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// GET /health
app.get('/health', (_req, res) => res.json({
  status   : 'ok',
  x32      : { ip: X32_IP, port: X32_PORT },
  sseClients: sseClients.size,
}));

// POST /osc   { address: '/ch/01/mix/fader', args: [0.75] }
app.post('/osc', (req, res) => {
  const { address, args = [] } = req.body;
  if (!address) return res.status(400).json({ error: 'address required' });
  try {
    sendOsc(address, args);
    res.json({ sent: true, address, args });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /fader/:target   → { address, value }
app.get('/fader/:target(*)', async (req, res) => {
  try {
    const addr   = faderAddress(req.params.target);
    const result = await queryOsc(addr);
    res.json({ address: addr, value: result.args[0] ?? null });
  } catch (err) {
    res.status(504).json({ error: err.message });
  }
});

// POST /fader/:target   { value: 0.75 }
app.post('/fader/:target(*)', (req, res) => {
  const { value } = req.body;
  if (value == null) return res.status(400).json({ error: 'value required (0.0–1.0)' });
  try {
    const addr = faderAddress(req.params.target);
    sendOsc(addr, [Number(value)]);
    res.json({ sent: true, address: addr, value: Number(value) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /mute/:target   { on: true }  (true = unmuted/on, false = muted)
app.post('/mute/:target(*)', (req, res) => {
  const { on } = req.body;
  if (on == null) return res.status(400).json({ error: 'on (bool) required' });
  try {
    const addr = muteAddress(req.params.target);
    sendOsc(addr, [on ? 1 : 0]);
    res.json({ sent: true, address: addr, on: Boolean(on) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /snapshot   — queries all 32 channels + 8 DCAs + main fader in parallel
app.get('/snapshot', async (_req, res) => {
  const queries = [];
  for (let ch = 1; ch <= 32; ch++) {
    const pad = String(ch).padStart(2, '0');
    queries.push(queryOsc(`/ch/${pad}/mix/fader`));
    queries.push(queryOsc(`/ch/${pad}/mix/on`));
  }
  for (let dca = 1; dca <= 8; dca++) {
    queries.push(queryOsc(`/dca/${dca}/fader`));
    queries.push(queryOsc(`/dca/${dca}/on`));
  }
  queries.push(queryOsc('/main/st/mix/fader'));

  const results = await Promise.allSettled(queries);
  const snapshot = {};
  for (const r of results) {
    if (r.status === 'fulfilled') {
      snapshot[r.value.address] = r.value.args[0] ?? null;
    }
  }
  res.json(snapshot);
});

// GET /events   — SSE stream
app.get('/events', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  res.write('data: {"connected":true}\n\n');
  sseClients.add(res);

  req.on('close', () => sseClients.delete(res));
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
udpPort.open();
udpPort.on('ready', () => {
  startXremote();
  app.listen(PORT, () => {
    console.log('');
    console.log('============================================');
    console.log('  Shenanigans Studio — X32 Proxy');
    console.log('============================================');
    console.log(`  HTTP  : http://localhost:${PORT}`);
    console.log(`  X32   : ${X32_IP}:${X32_PORT} (OSC/UDP)`);
    console.log('');
    console.log('  Routes:');
    console.log('    GET  /health');
    console.log('    POST /osc          { address, args[] }');
    console.log('    GET  /fader/:target   (ch/01, dca/1, main)');
    console.log('    POST /fader/:target   { value: 0.0–1.0 }');
    console.log('    POST /mute/:target    { on: bool }');
    console.log('    GET  /snapshot');
    console.log('    GET  /events       SSE stream');
    console.log('============================================');
    console.log('');
  });
});
