/**
 * =============================================================================
 * Shenanigans Studio — FADR Worker Server
 * =============================================================================
 * HTTP server (port 9092) that bridges the SvelteKit frontend to the FADR API.
 *
 * API contract confirmed from fadr_extract.py:
 *   Base URL : https://api.fadr.com
 *   Auth     : Authorization: Bearer {FADR_API_KEY}
 *
 *   Endpoints used:
 *     GET  /assets                          → list all user assets
 *     GET  /assets/:id                      → get single asset
 *     GET  /assets/download/:stemId/hq      → {url} signed download URL
 *     GET  /assets/download/:stemId/midi    → {url} signed MIDI download URL
 *     POST /assets/upload2                  → {url, s3Path} presigned S3 upload
 *     POST /assets                          → register uploaded asset
 *     POST /assets/stem                     → submit stem job
 *                                             body: {_id, stemType}
 *                                             stemType: "main" | "drum-stem"
 *     GET  /tasks/:taskId                   → poll task
 *                                             done: task.task.status.complete
 *                                             output: task.task.output.assets[]
 *
 * =============================================================================
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Resolve env file from pwa root (two levels up: servers/fadr-worker/ → pwa/)
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../');

// Load .env.local first (SvelteKit convention), fall back to .env
config({ path: resolve(ROOT, '.env.local') });
config({ path: resolve(ROOT, '.env') });        // fallback — no-op if already loaded
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// ─── Config ──────────────────────────────────────────────────────────────────

const PORT              = process.env.FADR_WORKER_PORT     ?? 9092;
const FADR_API_KEY      = process.env.FADR_API_KEY;
const FADR_BASE_URL     = process.env.FADR_API_BASE         ?? 'https://api.fadr.com';
const POLL_INTERVAL_MS  = (Number(process.env.FADR_POLL_SECONDS)   || 5)   * 1_000;
const POLL_MAX_ATTEMPTS = Math.ceil(
  (Number(process.env.FADR_TIMEOUT_SECONDS) || 900) /
  (Number(process.env.FADR_POLL_SECONDS)    || 5)
); // e.g. 900s / 5s = 180 attempts

const SUPABASE_URL         = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

for (const [key, val] of Object.entries({
  FADR_API_KEY,
  PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_KEY,
})) {
  if (!val) {
    console.error(`[fadr-worker] ❌ Missing required env var: ${key}`);
    process.exit(1);
  }
}

// ─── Supabase ────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── State ───────────────────────────────────────────────────────────────────

/** @type {Map<string, { timer: NodeJS.Timeout, attempts: number }>} */
const activePollers = new Map();

/** @type {Set<import('express').Response>} */
const sseClients = new Set();

// ─── FADR API helpers ────────────────────────────────────────────────────────

const FADR_HEADERS = {
  Authorization: `Bearer ${FADR_API_KEY}`,
  'Content-Type': 'application/json',
};

async function fadrGet(path) {
  const res  = await fetch(`${FADR_BASE_URL}${path}`, { headers: FADR_HEADERS, timeout: 30_000 });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(`FADR ${res.status} ${path}`), { status: res.status, body: json });
  return json;
}

async function fadrPost(path, body) {
  const res  = await fetch(`${FADR_BASE_URL}${path}`, {
    method: 'POST', headers: FADR_HEADERS,
    body: JSON.stringify(body), timeout: 30_000,
  });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(`FADR ${res.status} ${path}`), { status: res.status, body: json });
  return json;
}

// ─── SSE broadcast ───────────────────────────────────────────────────────────

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch { sseClients.delete(client); }
  }
}

// ─── Supabase helpers ────────────────────────────────────────────────────────

async function upsertStem(taskId, patch) {
  const { error } = await supabase
    .from('stems')
    .upsert({ fadr_task_id: taskId, updated_at: new Date().toISOString(), ...patch },
            { onConflict: 'fadr_task_id' });
  if (error) console.error('[fadr-worker] Supabase error:', error.message);
}

// ─── Polling engine ──────────────────────────────────────────────────────────
//
// FADR task response shape (from fadr_extract.py):
//   { task: { _id, status: { complete: bool }, output: { assets: [] } } }

function startPolling(taskId, assetId, songName) {
  if (activePollers.has(taskId)) return;

  let attempts = 0;
  let interval = POLL_INTERVAL_MS;

  console.log(`[fadr-worker] ▶ Polling task ${taskId} for "${songName}"`);

  const tick = async () => {
    attempts++;
    try {
      const data   = await fadrGet(`/tasks/${taskId}`);
      const task   = data?.task ?? {};
      const done   = task?.status?.complete === true;
      const failed = task?.status?.error    === true;

      broadcast('job:update', { taskId, assetId, songName, attempts, done, failed });

      if (done && !failed) {
        stopPolling(taskId);

        // Collect output stem assets
        const outputAssets = task?.output?.assets ?? [];
        console.log(`[fadr-worker] ✅ "${songName}" complete — ${outputAssets.length} output asset(s)`);

        // Resolve signed download URLs for each stem
        const stems = [];
        for (const a of outputAssets) {
          const stemId   = a._id;
          const stemType = a?.metaData?.stemType ?? 'unknown';
          try {
            const hq   = await fadrGet(`/assets/download/${stemId}/hq`);
            const midi = await fadrGet(`/assets/download/${stemId}/midi`).catch(() => null);
            stems.push({
              stemId,
              stemType,
              assetData: a,
              downloadUrl:     hq?.url   ?? null,
              midiDownloadUrl: midi?.url ?? null,
            });
          } catch (e) {
            console.warn(`[fadr-worker] Could not get download URL for stem ${stemId}:`, e.message);
          }
        }

        await upsertStem(taskId, {
          fadr_asset_id: assetId,
          song_name: songName,
          status: 'complete',
          stems_json: JSON.stringify(stems),
          completed_at: new Date().toISOString(),
        });

        broadcast('job:complete', { taskId, assetId, songName, stems });
        return;
      }

      if (failed) {
        stopPolling(taskId);
        const errMsg = task?.status?.message ?? 'FADR task failed';
        await upsertStem(taskId, { status: 'error', error_message: errMsg });
        broadcast('job:error', { taskId, assetId, songName, error: errMsg });
        console.error(`[fadr-worker] ❌ Task ${taskId} failed: ${errMsg}`);
        return;
      }

      if (attempts >= POLL_MAX_ATTEMPTS) {
        stopPolling(taskId);
        await upsertStem(taskId, { status: 'timeout', error_message: `Timed out after ${attempts} attempts` });
        broadcast('job:timeout', { taskId, assetId, songName, attempts });
        console.warn(`[fadr-worker] ⏱ Task ${taskId} timed out`);
        return;
      }

      // Back off slightly each tick, cap at 30 s
      interval = Math.min(interval + 1_000, 30_000);
      activePollers.set(taskId, { timer: setTimeout(tick, interval), attempts });

    } catch (err) {
      console.error(`[fadr-worker] Poll error (attempt ${attempts}):`, err.message);
      if (attempts >= POLL_MAX_ATTEMPTS) {
        stopPolling(taskId);
        broadcast('job:error', { taskId, assetId, songName, error: err.message });
        await upsertStem(taskId, { status: 'error', error_message: err.message });
        return;
      }
      interval = Math.min(interval * 2, 30_000);
      activePollers.set(taskId, { timer: setTimeout(tick, interval), attempts });
    }
  };

  activePollers.set(taskId, { timer: setTimeout(tick, POLL_INTERVAL_MS), attempts });
}

function stopPolling(taskId) {
  const p = activePollers.get(taskId);
  if (p) { clearTimeout(p.timer); activePollers.delete(taskId); }
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get('/health', (_req, res) => res.json({
  status: 'ok',
  activePollers: activePollers.size,
  sseClients: sseClients.size,
}));

// ── SSE ─────────────────────────────────────────────────────────────────────
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 25_000);
  sseClients.add(res);

  res.write(`event: connected\ndata: ${JSON.stringify({
    activePollers: [...activePollers.keys()],
  })}\n\n`);

  req.on('close', () => { clearInterval(ping); sseClients.delete(res); });
});

// ── GET /assets — list all user assets from FADR ────────────────────────────
app.get('/assets', async (_req, res) => {
  try {
    const data   = await fadrGet('/assets');
    const assets = Array.isArray(data) ? data : (data?.assets ?? []);
    res.json({ count: assets.length, assets });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ── GET /assets/:id — single asset ──────────────────────────────────────────
app.get('/assets/:id', async (req, res) => {
  try {
    const asset = await fadrGet(`/assets/${req.params.id}`);
    res.json(asset);
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ── GET /assets/:id/download — signed HQ + MIDI URLs ────────────────────────
app.get('/assets/:id/download', async (req, res) => {
  try {
    const hq   = await fadrGet(`/assets/download/${req.params.id}/hq`);
    const midi = await fadrGet(`/assets/download/${req.params.id}/midi`).catch(() => null);
    res.json({ downloadUrl: hq?.url ?? null, midiUrl: midi?.url ?? null });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ── POST /jobs — submit a new stem job ──────────────────────────────────────
//
// Two modes:
//   1. assetId provided  → asset already exists in FADR, submit stem job directly
//   2. fileUrl provided  → upload new file first, then submit
//
// Body: { assetId?, fileUrl?, songName, stemType? }
//   stemType defaults to "main" — use "drum-stem" for kick/snare separation
//
app.post('/jobs', async (req, res) => {
  let { assetId, fileUrl, songName = 'Untitled', stemType = 'main' } = req.body;

  if (!assetId && !fileUrl) {
    return res.status(400).json({ error: 'Provide either assetId or fileUrl' });
  }

  try {
    // ── Step 1: Upload if no assetId ──────────────────────────────────────
    if (!assetId && fileUrl) {
      console.log(`[fadr-worker] Uploading "${songName}" from ${fileUrl}`);

      // Get a presigned S3 URL from FADR
      const fileName = fileUrl.split('/').pop() ?? 'upload.mp3';
      const ext      = fileName.split('.').pop() ?? 'mp3';
      const upload   = await fadrPost('/assets/upload2', { name: fileName, extension: ext });

      // PUT the file to S3
      const fileRes  = await fetch(fileUrl, { timeout: 120_000 });
      if (!fileRes.ok) throw new Error(`Could not fetch source file: ${fileRes.status}`);
      const fileBlob = await fileRes.buffer();

      await fetch(upload.url, {
        method: 'PUT',
        body: fileBlob,
        headers: { 'Content-Type': ext === 'mp3' ? 'audio/mpeg' : 'audio/wav' },
      });

      // Register the asset
      const newAsset = await fadrPost('/assets', {
        name: songName, extension: ext, s3Path: upload.s3Path,
      });
      assetId = newAsset?.asset?._id;
      if (!assetId) throw new Error('FADR did not return an asset ID after upload');
      console.log(`[fadr-worker] ✅ Asset created: ${assetId}`);
    }

    // ── Step 2: Submit stem job ───────────────────────────────────────────
    // POST /assets/stem  body: { _id: assetId, stemType }
    const jobRes = await fadrPost('/assets/stem', { _id: assetId, stemType });
    const taskId = jobRes?.task?._id;
    if (!taskId) throw new Error('FADR did not return a task ID');

    console.log(`[fadr-worker] 🚀 Task ${taskId} submitted for "${songName}" (stemType=${stemType})`);

    await upsertStem(taskId, {
      fadr_asset_id: assetId,
      song_name: songName,
      stem_type: stemType,
      status: 'pending',
      submitted_at: new Date().toISOString(),
    });

    startPolling(taskId, assetId, songName);
    broadcast('job:submitted', { taskId, assetId, songName, stemType });

    res.status(202).json({ taskId, assetId, songName, stemType, status: 'pending' });

  } catch (err) {
    console.error('[fadr-worker] Job submission error:', err.message, err.body ?? '');
    res.status(err.status ?? 500).json({ error: err.message, detail: err.body ?? null });
  }
});

// ── GET /jobs — list tracked jobs from Supabase ──────────────────────────────
app.get('/jobs', async (req, res) => {
  const { status } = req.query;
  try {
    let q = supabase.from('stems').select('*').order('submitted_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ jobs: data, activePollers: [...activePollers.keys()] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /jobs/:taskId ────────────────────────────────────────────────────────
app.get('/jobs/:taskId', async (req, res) => {
  const { taskId } = req.params;
  try {
    const { data, error } = await supabase.from('stems')
      .select('*').eq('fadr_task_id', taskId).single();
    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      // Not cached yet — ask FADR directly
      const live = await fadrGet(`/tasks/${taskId}`);
      return res.json({ source: 'fadr', task: live });
    }
    res.json({ source: 'supabase', stem: data, polling: activePollers.has(taskId) });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ── DELETE /jobs/:taskId — cancel polling ────────────────────────────────────
app.delete('/jobs/:taskId', async (req, res) => {
  const { taskId } = req.params;
  stopPolling(taskId);
  await upsertStem(taskId, { status: 'cancelled', error_message: 'Cancelled by user' });
  broadcast('job:cancelled', { taskId });
  res.json({ taskId, status: 'cancelled' });
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n[fadr-worker] ✅ Running on http://localhost:${PORT}`);
  console.log(`[fadr-worker]    FADR API : ${FADR_BASE_URL}`);
  console.log(`[fadr-worker]    Poll     : every ${POLL_INTERVAL_MS}ms, max ${POLL_MAX_ATTEMPTS} attempts`);
  console.log(`[fadr-worker]    Supabase : ${SUPABASE_URL}`);
  console.log(`[fadr-worker]    SSE      : http://localhost:${PORT}/events\n`);
});

// ─── Graceful shutdown ───────────────────────────────────────────────────────

function shutdown(sig) {
  console.log(`\n[fadr-worker] ${sig} — shutting down`);
  for (const id of activePollers.keys()) stopPolling(id);
  for (const c of sseClients) { try { c.end(); } catch {} }
  process.exit(0);
}
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
