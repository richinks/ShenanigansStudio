/**
 * pwa/src/lib/fadr.js
 * SvelteKit client helpers — FADR stem jobs + Supabase reads
 *
 * Env (pwa/.env.local):
 *   PUBLIC_FADR_WORKER_URL   http://localhost:3001
 */
import { PUBLIC_FADR_WORKER_URL } from '$env/static/public';
import { supabase } from '$lib/supabase';

const WORKER = PUBLIC_FADR_WORKER_URL ?? 'http://localhost:3001';

// ─── Submit a new stem job ────────────────────────────────────────────────────
/**
 * @param {string} assetId   FADR asset id (from fadr_metadata.json)
 * @param {'main'|'drum-stem'} stemType
 * @returns {Promise<{ taskId: string }>}
 */
export async function submitStemJob(assetId, stemType = 'main') {
  const res = await fetch(`${WORKER}/submit`, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ assetId, stemType }),
  });
  if (!res.ok) throw new Error(`fadr-worker /submit ${res.status}: ${await res.text()}`);
  return res.json();   // { taskId }
}

// ─── Poll one task's status ───────────────────────────────────────────────────
/**
 * @param {string} taskId   FADR task id
 * @returns {Promise<{ status: string, stems?: object[] }>}
 */
export async function getStemStatus(taskId) {
  const res = await fetch(`${WORKER}/status/${taskId}`);
  if (!res.ok) throw new Error(`fadr-worker /status ${res.status}`);
  return res.json();
}

// ─── Poll until complete (with timeout) ──────────────────────────────────────
/**
 * Polls getStemStatus every intervalMs until status is 'complete'|'error'|'timeout'.
 * @param {string} taskId
 * @param {{ intervalMs?: number, maxWaitMs?: number }} opts
 */
export async function pollUntilDone(taskId, { intervalMs = 5000, maxWaitMs = 600_000 } = {}) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const result = await getStemStatus(taskId);
    if (['complete', 'error', 'timeout', 'cancelled'].includes(result.status)) return result;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`pollUntilDone: timed out after ${maxWaitMs}ms for task ${taskId}`);
}

// ─── Supabase reads ───────────────────────────────────────────────────────────

/** All songs joined to their latest stem job (uses songs_with_stems view). */
export async function getSongsWithStems() {
  const { data, error } = await supabase
    .from('songs_with_stems')
    .select('*')
    .order('priority')
    .order('title');
  if (error) throw error;
  return data;
}

/** Stems for a specific song (all jobs, newest first). */
export async function getStemsBySong(songId) {
  const { data, error } = await supabase
    .from('stems')
    .select('*')
    .eq('song_id', songId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** All pending/processing stem jobs — useful for a progress dashboard. */
export async function getActiveStemJobs() {
  const { data, error } = await supabase
    .from('stems')
    .select('*')
    .in('status', ['pending', 'processing'])
    .order('submitted_at');
  if (error) throw error;
  return data;
}
