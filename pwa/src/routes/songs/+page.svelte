<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { submitStemJob } from '$lib/fadr';

  let songs = [];
  let activeTab = 'active';
  let loading = true;
  let stemming = {};
  let search = '';
  let error = null;

  $: filtered = songs.filter(s => {
    const matchTab = s.status === activeTab;
    const matchSearch = !search || s.title.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  onMount(async () => {
    const { data, error: err } = await supabase.from('songs').select('*').order('title');
    if (err) { error = err.message; } else { songs = data ?? []; }
    loading = false;
  });

  async function handleStemJob(songId) {
    stemming = { ...stemming, [songId]: true };
    try { await submitStemJob(songId); } finally { stemming = { ...stemming, [songId]: false }; }
  }
</script>

<div class="songs-page">
  <div class="page-header">
    <h2 class="page-title">🎵 Songs</h2>
    <input class="search" bind:value={search} placeholder="Search…" />
  </div>

  <div class="tabs">
    {#each ['active', 'wip', 'retired'] as tab}
      <button class="tab" class:active={activeTab === tab} on:click={() => (activeTab = tab)}>
        {tab === 'active' ? 'Active' : tab === 'wip' ? 'In Progress' : 'Retired'}
        <span class="tab-count">{songs.filter(s => s.status === tab).length}</span>
      </button>
    {/each}
  </div>

  {#if loading}
    <div class="state-box">
      <div class="spinner"></div>
      <p>Loading songs…</p>
    </div>
  {:else if error}
    <div class="state-box error">
      <p>⚠️ {error}</p>
    </div>
  {:else if filtered.length === 0}
    <div class="state-box">
      <p>No songs in <strong>{activeTab}</strong>.</p>
    </div>
  {:else}
    <ul class="song-list">
      {#each filtered as song (song.id)}
        <li class="song-row">
          <div class="song-info">
            <span class="song-title">{song.title}</span>
            <div class="song-meta">
              {#if song.key}<span class="pill">{song.key}</span>{/if}
              {#if song.bpm}<span class="pill">{song.bpm} BPM</span>{/if}
            </div>
          </div>
          <button class="stem-btn" disabled={stemming[song.id]} on:click={() => handleStemJob(song.id)}>
            {stemming[song.id] ? 'Processing…' : 'Stem'}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .songs-page { display: flex; flex-direction: column; gap: 1.25rem; }

  .page-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .page-title { margin: 0; font-size: 1.25rem; font-weight: 700; color: #fff; }

  .search {
    background: #111927; border: 1px solid #1e2d42; border-radius: 8px;
    color: #fff; padding: .55rem 1rem; font-size: .9rem; width: 220px;
    outline: none; transition: border-color .15s;
  }
  .search::placeholder { color: #8a9bb5; }
  .search:focus { border-color: #e07a1a; }

  .tabs { display: flex; gap: .5rem; flex-wrap: wrap; }
  .tab {
    display: flex; align-items: center; gap: .4rem;
    padding: .4rem .9rem; border: 1px solid #1e2d42; border-radius: 8px;
    background: #111927; color: #8a9bb5; font-size: .82rem; font-weight: 600;
    cursor: pointer; transition: all .15s;
  }
  .tab:hover { border-color: #e07a1a; color: #fff; }
  .tab.active { background: #e07a1a; border-color: #e07a1a; color: #fff; }
  .tab-count {
    background: rgba(255,255,255,.12); border-radius: 999px;
    padding: .05rem .45rem; font-size: .72rem;
  }
  .tab.active .tab-count { background: rgba(0,0,0,.2); }

  .state-box {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: .75rem; padding: 3rem 1rem; color: #8a9bb5; text-align: center;
    background: #111927; border: 1px solid #1e2d42; border-radius: 12px;
  }
  .state-box.error { color: #f87171; }
  .spinner {
    width: 28px; height: 28px; border: 3px solid #1e2d42;
    border-top-color: #e07a1a; border-radius: 50%; animation: spin .7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .song-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: .4rem; }
  .song-row {
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    background: #111927; border: 1px solid #1e2d42; border-radius: 10px;
    padding: .75rem 1rem; transition: border-color .15s;
  }
  .song-row:hover { border-color: #2e4060; }
  .song-info { display: flex; flex-direction: column; gap: .25rem; min-width: 0; }
  .song-title { font-weight: 600; font-size: .95rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .song-meta { display: flex; gap: .35rem; flex-wrap: wrap; }
  .pill { font-size: .7rem; background: #1e2d42; color: #8a9bb5; border-radius: 999px; padding: .1rem .5rem; }
  .stem-btn {
    flex-shrink: 0; background: #e07a1a; border: none; border-radius: 8px;
    color: #fff; font-size: .82rem; font-weight: 700; padding: .4rem .9rem;
    cursor: pointer; transition: opacity .15s; white-space: nowrap;
  }
  .stem-btn:disabled { opacity: .4; cursor: not-allowed; }
  .stem-btn:not(:disabled):hover { opacity: .85; }
</style>