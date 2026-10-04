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
    const { data, error: err } = await supabase
      .from('songs')
      .select('*')
      .order('title');
    if (err) { error = err.message; }
    else { songs = data ?? []; }
    loading = false;
  });

  async function handleStemJob(songId) {
    stemming = { ...stemming, [songId]: true };
    try { await submitStemJob(songId); }
    finally { stemming = { ...stemming, [songId]: false }; }
  }
</script>

<div class="songs-page">
  <div class="toolbar">
    <input class="search" bind:value={search} placeholder="Search songs…" />
  </div>

  <div class="tabs">
    {#each ['active', 'wip', 'retired'] as tab}
      <button class="tab" class:active={activeTab === tab} on:click={() => (activeTab = tab)}>
        {tab.toUpperCase()}
      </button>
    {/each}
  </div>

  {#if loading}
    <p class="status">Loading…</p>
  {:else if error}
    <p class="status error">{error}</p>
  {:else if filtered.length === 0}
    <p class="status">No songs in <strong>{activeTab}</strong>.</p>
  {:else}
    <ul class="song-list">
      {#each filtered as song (song.id)}
        <li class="song-row">
          <div class="song-info">
            <span class="song-title">{song.title}</span>
            {#if song.key}<span class="badge">{song.key}</span>{/if}
            {#if song.bpm}<span class="badge">{song.bpm} BPM</span>{/if}
          </div>
          <button class="stem-btn" disabled={stemming[song.id]}
            on:click={() => handleStemJob(song.id)}>
            {stemming[song.id] ? '⏳' : '🎛 Stem'}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .songs-page { display: flex; flex-direction: column; gap: 1rem; }
  .toolbar { display: flex; gap: .5rem; }
  .search {
    flex: 1; background: #1a1a1a; border: 1px solid #333;
    border-radius: 8px; color: #fff; padding: .6rem 1rem; font-size: .95rem;
  }
  .tabs { display: flex; gap: .5rem; }
  .tab {
    padding: .4rem 1rem; border: 1px solid #333; border-radius: 999px;
    background: #1a1a1a; color: #888; font-size: .8rem; font-weight: 700;
    cursor: pointer; transition: all .15s;
  }
  .tab.active { background: #2563eb; border-color: #2563eb; color: #fff; }
  .status { color: #888; text-align: center; padding: 2rem; }
  .status.error { color: #f87171; }
  .song-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: .5rem; }
  .song-row {
    display: flex; align-items: center; justify-content: space-between;
    background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: .75rem 1rem;
  }
  .song-info { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
  .song-title { font-weight: 600; font-size: 1rem; }
  .badge { font-size: .72rem; background: #2a2a2a; color: #aaa; border-radius: 999px; padding: .15rem .55rem; }
  .stem-btn {
    background: #1e3a5f; border: none; border-radius: 8px; color: #93c5fd;
    font-size: .85rem; font-weight: 600; padding: .4rem .9rem; cursor: pointer; white-space: nowrap;
  }
  .stem-btn:disabled { opacity: .4; cursor: not-allowed; }
</style>
