<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase.js';

  let songs = [];
  let loading = true;
  let errorMessage = '';

  async function loadSongs() {
    loading = true;
    errorMessage = '';

    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .order('title', { ascending: true });

    if (error) {
      errorMessage = error.message;
      loading = false;
      return;
    }

    songs = data || [];
    loading = false;
  }

  onMount(() => {
    loadSongs();
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
    margin-bottom: 1.5rem;
  }

  .song-card {
    background: #222;
    border: 1px solid #333;
    padding: 1rem;
    border-radius: 10px;
    margin-bottom: 1rem;
    transition: background 0.2s;
  }

  .song-card:hover {
    background: #2d2d2d;
  }

  .title {
    font-size: 1.3rem;
    font-weight: bold;
  }

  .meta {
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
  <h2>Songs</h2>

  {#if loading}
    <div class="loading">Loading songs…</div>
  {:else if errorMessage}
    <div class="error">{errorMessage}</div>
  {:else if songs.length === 0}
    <div>No songs found.</div>
  {:else}
    {#each songs as song}
      <div class="song-card">
        <div class="title">{song.title}</div>
        <div class="meta">
          Artist: {song.artist}  
          • BPM: {song.recording_bpm}  
          • Key: {song.key}  
          • Duration: {song.duration_sec}s
        </div>
      </div>
    {/each}
  {/if}
</div>
