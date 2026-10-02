<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { supabase } from '#lib/supabase'
  let session = null, loading = true
  onMount(async () => {
    const { data } = await supabase.auth.getSession()
    session = data.session; loading = false
    if (!session && page.url.pathname !== '/login') goto('/login')
    supabase.auth.onAuthStateChange((_, s) => {
      session = s
      if (!s) goto('/login')
    })
  })
  async function signOut() { await supabase.auth.signOut() }
</script>
{#if loading}
  <div class="splash">Loading…</div>
{:else}
  {#if session}
    <nav>
      <span class="brand">🎸 ShenanigansStudio</span>
      <a href="/">Dashboard</a>
      <a href="/songs">Songs</a>
      <a href="/setlists">Setlists</a>
      <button class="signout" on:click={signOut}>Sign out</button>
    </nav>
  {/if}
  <main><slot /></main>
{/if}
<style>
  :global(*){box-sizing:border-box;margin:0;padding:0}
  :global(body){font-family:system-ui,sans-serif;background:#030712;color:#fff;min-height:100vh}
  :global(a){color:inherit;text-decoration:none}
  :global(input,select){background:#1f2937;border:1px solid #374151;color:#fff;padding:.5rem .75rem;border-radius:.375rem;width:100%;font-size:.9rem}
  :global(button){background:#bf5500;color:#fff;border:none;padding:.5rem 1.25rem;border-radius:.375rem;cursor:pointer;font-size:.9rem}
  :global(button:hover){background:#9c3d00}
  :global(button:disabled){opacity:.5;cursor:not-allowed}
  :global(table){width:100%;border-collapse:collapse;margin-top:.75rem}
  :global(th,td){padding:.5rem .75rem;text-align:left;border-bottom:1px solid #111827;font-size:.875rem}
  :global(th){color:#6b7280;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em}
  :global(tr:hover td){background:#0f172a}
  .splash{display:flex;align-items:center;justify-content:center;height:100vh;color:#6b7280;font-size:1.1rem}
  nav{display:flex;align-items:center;gap:1.25rem;padding:.75rem 1.5rem;background:#0f172a;border-bottom:1px solid #1f2937;font-size:.875rem}
  .brand{font-weight:700;color:#e8851a;margin-right:auto}
  nav a{color:#9ca3af}
  nav a:hover{color:#fff}
  .signout{background:transparent;color:#6b7280;padding:.25rem .5rem}
  .signout:hover{color:#f87171;background:transparent}
  main{padding:1.5rem;max-width:1200px;margin:0 auto}
</style>
