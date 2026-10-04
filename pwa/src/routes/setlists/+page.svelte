<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase.js';

  let setlists = [];
  let loading = true;
  let errorMessage = '';

  async function loadSetlists() {
    loading = true;
    errorMessage = '';

    const { data, error } = await supabase
      .from('setlists')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      errorMessage = error.message;
      loading = false;
      return;
    }

    setlists = data || [];
    loading = false;
  }

  onMount(() => {
    loadSetlists();
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

  .setlist-card {
    background: #222;
    border: 1px solid #333;
    padding: 1.2rem;
    border-radius: 10px;
    margin-bottom: 1rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .setlist-card:hover {
    background: #2d2d2d;
  }

  .title {
    font-size: 1.4rem;
    font-weight: bold;
  }

  .meta {
    margin-top: 0.4rem;
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
  <h2>Setlists</h2>

  {#if loading}
    <div class="loading">Loading setlists…</div>
  {:else if errorMessage}
    <div class="error">{errorMessage}</div>
  {:else if setlists.length === 0}
    <div>No setlists found.</div>
  {:else}
    {#each setlists as sl}
      <a href={`/setlists/${sl.id}`} class="setlist-card">
        <div class="title">{sl.title}</div>
        <div class="meta">
          Created: {new Date(sl.created_at).toLocaleString()}
        </div>
      </a>
    {/each}
  {/if}
</div>
