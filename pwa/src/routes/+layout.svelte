<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase.js';

  let session = null;

  // Optional: load session on mount
  onMount(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    session = currentSession;

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, newSession) => {
      session = newSession;
    });
  });
</script>

<style>
  .app-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: #111;
    color: #fff;
    font-family: system-ui, sans-serif;
  }

  header {
    padding: 1rem 2rem;
    background: #222;
    border-bottom: 1px solid #333;
  }

  main {
    flex: 1;
    padding: 2rem;
  }

  footer {
    padding: 1rem 2rem;
    background: #222;
    border-top: 1px solid #333;
    text-align: center;
    font-size: 0.9rem;
    opacity: 0.7;
  }
</style>

<div class="app-container">
  <header>
    <h1>Shenanigans Studio</h1>
    {#if session}
      <div>Logged in as {session.user.email}</div>
    {:else}
      <div>Not logged in</div>
    {/if}
  </header>

  <main>
    <slot />
  </main>

  <footer>
    Shenanigans Studio — Live Tools & Setlist Engine
  </footer>
</div>
