<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase.js';
  import { page } from '$app/stores';

  let setlist = null;
  let songs = [];
  let loading = true;
  let errorMessage = '';

  // Extract ID from route params
  let id;
  $: id = $page.params.id;

  async function loadSetlist() {
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
    loadSetlist();
  });
</script>

<style>
  .container {
    padding: 2rem;
    color: #fff;
    font-family: system-ui, sans-serif;
  }

  h2 {
    font-size: 2rem;
    margin-bottom: 1rem;
  }

  .meta {
    opacity: 0.7;
    margin-bottom: 2rem;
  }

  .song-card {
    background: #222;
    border: 1px solid #333;
    padding: 1rem;
    border-radius: 10px;
    margin-bottom: 1rem;
  }

  .song-title {
    font-size: 1.3rem;
    font-weight: bold;
  }

  .song-meta {
    margin-top: 0.3rem;
    opacity: 0.7;
    font-size: 0.9rem;
  }

  .error {
    color: #ff6b6b;
    margin-top: 1rem;
  }

  .loading {
    opacity: 0.7;
    font-size: 1.2rem;
  }
</style>

<div class="container">
  {#if loading}
    <div class="loading">Loading setlist…</div>
  {:else if errorMessage}
    <div class="error">{errorMessage}</div>
  {:else if !setlist}
    <div>Setlist not found.</div>
  {:else}
    <h2>{setlist.title}</h2>
    <div class="meta">
      Created: {new Date(setlist.created_at).toLocaleString()}
    </div>

    {#if songs.length === 0}
      <div>No songs in this setlist.</div>
    {:else}
      {#each songs as row}
        <div class="song-card">
          <div class="song-title">{row.songs.title}</div>
          <div class="song-meta">
            BPM: {row.songs.recording_bpm}
            • Key: {row.songs.key}
            • Position: {row.position}
          </div>
        </div>
      {/each}
    {/if}
  {/if}
</div>
