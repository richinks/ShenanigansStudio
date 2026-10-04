<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { submitStemJob } from '$lib/fadr';

  // ── Data ──────────────────────────────────────────────────────────────────
  let songs    = $state([]);
  let stems    = $state({});   // song_id → latest stem row
  let loading  = $state(true);
  let error    = $state(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  let priority = $state('active');   // 'active' | 'wip' | 'retired'
  let search   = $state('');

  const filtered = $derived(
    songs.filter(s =>
      s.priority === priority &&
      (search === '' ||
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.artist.toLowerCase().includes(search.toLowerCase()))
    )
  );

  // ── Load ──────────────────────────────────────────────────────────────────
  onMount(async () => {
    await load();
  });

  async function load() {
    loading = true; error = null;
    try {
      const [songsRes, stemsRes] = await Promise.all([
        supabase.from('songs').select('*').order('title'),
        supabase.from('stems').select('*').order('updated_at', { ascending: false }),
      ]);
      if (songsRes.error) throw songsRes.error;
      if (stemsRes.error) throw stemsRes.error;

      songs = songsRes.data;

      // Build song_id → latest stem map
      const map = {};
      for (const stem of stemsRes.data) {
        if (!map[stem.song_id]) map[stem.song_id] = stem;
      }
      stems = map;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  // ── Submit FADR job ───────────────────────────────────────────────────────
  let submitting = $state({});   // song_id → true

  async function submitJob(song) {
    if (!song.fadr_asset_id) {
      alert(`No FADR asset ID for "${song.title}" — run fadr_extract.py first.`);
      return;
    }
    submitting[song.id] = true;
    try {
      await submitStemJob(song.fadr_asset_id, 'main');
      await load();   // refresh stem status
    } catch (e) {
      alert(`Submit failed: ${e.message}`);
    } finally {
      delete submitting[song.id];
    }
  }

  // ── Stem badge ────────────────────────────────────────────────────────────
  function stemBadge(songId) {
    const s = stems[songId];
    if (!s) return { label: 'No stems', cls: 'none' };
    return {
      complete   : { label: '✓ Ready',      cls: 'complete'   },
      processing : { label: '⟳ Processing', cls: 'processing' },
      pending    : { label: '⏳ Queued',     cls: 'pending'    },
      error      : { label: '✕ Error',       cls: 'error'      },
      timeout    : { label: '✕ Timeout',     cls: 'error'      },
    }[s.status] ?? { label: s.status, cls: 'none' };
  }

  const PRIORITY_TABS = ['active', 'wip', 'retired'];
  const counts = $derived(
    PRIORITY_TABS.reduce((acc, p) => {
      acc[p] = songs.filter(s => s.priority === p).length;
      return acc;
    }, {})
  );
</script>

<!-- ══════════════════════════════════════════════════════════════════════ -->
<div class="songs-page">

  <div class="page-header">
    <h1>Songs</h1>
    <button class="refresh-btn" onclick={load} disabled={loading}>
      {loading ? '…' : '↺'}
    </button>
  </div>

  {#if error}
    <div class="error-banner">⚠ {error}</div>
  {/if}

  <!-- Priority tabs -->
  <div class="tab-bar">
    {#each PRIORITY_TABS as p}
      <button
        class="tab"
        class:active={priority === p}
        onclick={() => priority = p}
      >{p} <span class="count">{counts[p]}</span></button>
    {/each}
  </div>

  <!-- Search -->
  <input
    class="search"
    type="search"
    placeholder="Search title or artist…"
    bind:value={search}
  />

  <!-- Song list -->
  {#if loading}
    <div class="empty">Loading…</div>
  {:else if filtered.length === 0}
    <div class="empty">No songs found.</div>
  {:else}
    <div class="song-list">
      {#each filtered as song (song.id)}
        {@const badge = stemBadge(song.id)}
        {@const stem  = stems[song.id]}
        <div class="song-row">

          <div class="song-info">
            <div class="song-title">{song.title}</div>
            <div class="song-artist">{song.artist}{song.bpm ? ` · ${song.bpm} BPM` : ''}</div>
          </div>

          <div class="stem-col">
            <span class="badge badge-{badge.cls}">{badge.label}</span>
            {#if stem?.status === 'error'}
              <span class="error-msg" title={stem.error_message}>ⓘ</span>
            {/if}
          </div>

          <div class="action-col">
            {#if !stem || ['error','timeout'].includes(stem?.status)}
              <button
                class="submit-btn"
                disabled={submitting[song.id] || !song.fadr_asset_id}
                onclick={() => submitJob(song)}
                title={song.fadr_asset_id ? 'Submit to FADR' : 'No FADR asset ID'}
              >
                {submitting[song.id] ? '…' : '⇑ FADR'}
              </button>
            {:else if stem?.status === 'complete' && stem?.stems_json}
              <a
                class="stems-link"
                href={`/songs/${song.id}`}
              >View stems</a>
            {/if}
          </div>

        </div>
      {/each}
    </div>
  {/if}

</div>

<!-- ══════════════════════════════════════════════════════════════════════ -->
<style>
  :global(body) { background: #0d0d0d; color: #e8e8e8; font-family: system-ui, sans-serif; }

  .songs-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
  .refresh-btn {
    background: none; border: 1px solid #333; color: #aaa;
    border-radius: 6px; padding: .3rem .6rem; cursor: pointer; font-size: 1rem;
  }
  .refresh-btn:disabled { opacity: .4; }

  .error-banner {
    background: #450a0a; border-radius: 8px;
    padding: .75rem 1rem; color: #fca5a5; font-size: .85rem;
  }

  /* Tabs */
  .tab-bar { display: flex; gap: .5rem; }
  .tab {
    background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px;
    padding: .4rem .9rem; cursor: pointer; color: #888; font-size: .85rem;
    text-transform: capitalize; transition: all .15s;
  }
  .tab.active { background: #27272a; color: #f4f4f5; border-color: #3f3f46; }
  .count { color: #555; margin-left: .3rem; }
  .tab.active .count { color: #888; }

  /* Search */
  .search {
    width: 100%; box-sizing: border-box;
    background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px;
    color: #e8e8e8; padding: .6rem .9rem; font-size: .9rem;
    outline: none;
  }
  .search:focus { border-color: #3f3f46; }

  /* Song list */
  .song-list { display: flex; flex-direction: column; gap: .4rem; }
  .song-row {
    display: grid;
    grid-template-columns: 1fr 130px 100px;
    align-items: center;
    gap: .75rem;
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    padding: .65rem .9rem;
    transition: border-color .15s;
  }
  .song-row:hover { border-color: #3f3f46; }

  .song-title  { font-size: .95rem; font-weight: 600; }
  .song-artist { font-size: .78rem; color: #888; margin-top: 2px; }

  /* Stem badge */
  .stem-col { display: flex; align-items: center; gap: .4rem; }
  .badge {
    display: inline-block; border-radius: 6px;
    padding: .2rem .55rem; font-size: .72rem; font-weight: 600;
    white-space: nowrap;
  }
  .badge-complete   { background: #14532d; color: #86efac; }
  .badge-processing { background: #1e3a5f; color: #7dd3fc; }
  .badge-pending    { background: #292524; color: #d6d3d1; }
  .badge-error      { background: #450a0a; color: #fca5a5; }
  .badge-none       { background: #1c1c1e; color: #555; }
  .error-msg        { color: #f87171; cursor: help; font-size: .8rem; }

  /* Action col */
  .action-col { display: flex; justify-content: flex-end; }
  .submit-btn {
    background: #27272a; border: 1px solid #3f3f46;
    color: #a1a1aa; border-radius: 6px; padding: .3rem .65rem;
    font-size: .78rem; cursor: pointer; white-space: nowrap;
  }
  .submit-btn:disabled { opacity: .35; cursor: not-allowed; }
  .submit-btn:not(:disabled):hover { background: #3f3f46; color: #e4e4e7; }
  .stems-link {
    font-size: .78rem; color: #86efac; text-decoration: none;
  }
  .stems-link:hover { text-decoration: underline; }

  .empty { text-align: center; color: #555; padding: 3rem 0; }
</style>
