<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase.js';

  let session = null;

  onMount(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    session = currentSession;

    supabase.auth.onAuthStateChange((_event, newSession) => {
      session = newSession;
    });
  });
</script>

<style>
  .home-container {
    padding: 3rem;
    color: #fff;
    font-family: system-ui, sans-serif;
  }

  h2 {
    font-size: 2.2rem;
    margin-bottom: 1rem;
  }

  .links {
    margin-top: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  a {
    color: #4caf50;
    font-size: 1.3rem;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  .session-box {
    margin-top: 2rem;
    padding: 1rem;
    background: #222;
    border: 1px solid #333;
    border-radius: 8px;
  }
</style>

<div class="home-container">
  <h2>Welcome to Shenanigans Studio</h2>

  <div class="session-box">
    {#if session}
      <div>Logged in as <strong>{session.user.email}</strong></div>
    {:else}
      <div>You are not logged in.</div>
    {/if}
  </div>

  <div class="links">
    <a href="/live">Live Controller</a>
    <a href="/setlists">Setlists</a>
    <a href="/songs">Songs</a>
    <a href="/login">Login</a>
  </div>
</div>
