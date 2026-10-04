<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase.js';

  let session = null;
  let statusMessage = 'Waiting for input…';

  // Example: send a command to your REAPER server or X32 later
  async function sendCommand(cmd) {
    statusMessage = `Sending: ${cmd}`;

    // Placeholder for your real command logic
    // Example:
    // await fetch('/api/live', { method: 'POST', body: JSON.stringify({ cmd }) });

    setTimeout(() => {
      statusMessage = `Command "${cmd}" sent successfully.`;
    }, 300);
  }

  onMount(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    session = currentSession;

    supabase.auth.onAuthStateChange((_event, newSession) => {
      session = newSession;
    });
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

  .status-box {
    background: #222;
    border: 1px solid #333;
    padding: 1rem;
    border-radius: 10px;
    margin-bottom: 2rem;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  button {
    padding: 1rem;
    background: #4caf50;
    border: none;
    border-radius: 8px;
    font-size: 1.2rem;
    cursor: pointer;
    color: #fff;
  }

  button:hover {
    background: #5ecf63;
  }

  .session {
    margin-top: 2rem;
    opacity: 0.7;
  }
</style>

<div class="container">
  <h2>Live Controller</h2>

  <div class="status-box">
    <strong>Status:</strong> {statusMessage}
  </div>

  <div class="controls">
    <button on:click={() => sendCommand('start')}>Start Show</button>
    <button on:click={() => sendCommand('stop')}>Stop Show</button>
    <button on:click={() => sendCommand('next')}>Next Song</button>
    <button on:click={() => sendCommand('prev')}>Previous Song</button>
  </div>

  <div class="session">
    {#if session}
      Logged in as <strong>{session.user.email}</strong>
    {:else}
      Not logged in
    {/if}
  </div>
</div>
