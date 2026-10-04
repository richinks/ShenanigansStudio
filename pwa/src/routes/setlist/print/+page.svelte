<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase.js';
  import { page } from '$app/stores';

  let setlist = null;
  let songs = [];
  let loading = true;
  let errorMessage = '';

  let id;
  $: id = $page.params.id;

  async function loadData() {
    loading = true;
    errorMessage = '';

    // Fetch setlist
    const { data: sl, error: slError } = await supabase
      .from('setlists')
      .select('*')
      .eq('id', id)
      .single();

    if (slError) {
      errorMessage = slError.message;
      loading = false;
      return;
    }

    setlist = sl;

    // Fetch songs for this setlist
    const { data: songRows, error: songError } = await supabase
      .from('setlist_songs')
      .select('*, songs(*)')
      .eq('setlist_id', id)
      .order('position', { ascending: true });

    if (songError) {
      errorMessage = songError.message;
      loading = false;
      return;
    }

    songs = songRows || [];
    loading = false;
  }

  onMount(() => {
    loadData();
  });

  function printPage() {
    window.print();
  }
</script>

<style>
  .container {
    padding: 2rem;
    color: #000;
    background: #fff;
    font-family: system-ui, sans-serif;
  }

  h1 {
    font-size: 2.4rem;
    margin-bottom: 0.5rem;
  }

  .meta {
    font-size: 1rem;
    opacity: 0.7;
    margin-bottom: 2rem;
  }

  .song {
    padding: 0.8rem 0;
    border-bottom: 1px solid #ccc;
  }

  .song-title {
    font-size: 1.3rem;
    font-weight: bold;
  }

  .song-meta {
    font-size: 0.9rem;
    opacity: 0.7;
  }

  .print-btn {
    margin-bottom: 2rem;
    padding: 0.8rem 1.2rem;
    background: #4caf50;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 1.1rem;
    cursor: pointer;
  }

  @media print {
    .print-btn {
      display: none;
    }
  }
</style>

<div class="container">
  {#if loading}
    <div>Loading setlist…</div>
  {:else if errorMessage}
    <div style="color: red;">{errorMessage}</div>
  {:else if !setlist}
    <div>Setlist not found.</div>
  {:else}
    <button class="print-btn" on:click={printPage}>Print Setlist</button>

    <h1>{setlist.title}</h1>
    <div class="meta">
      Created: {new Date(setlist.created_at).toLocaleString()}
    </div>

    {#each songs as row}
      <div class="song">
        <div class="song-title">{row.songs.title}</div>
        <div class="song-meta">
          BPM: {row.songs.recording_bpm} • Key: {row.songs.key} • Position: {row.position}
        </div>
      </div>
    {/each}
  {/if}
</div>
