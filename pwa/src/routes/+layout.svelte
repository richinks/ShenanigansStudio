<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { supabase } from '$lib/supabase'
  let session = null, loading = true
  onMount(async () => {
    const { data } = await supabase.auth.getSession()
    session = data.session; loading = false
    if (!session && $page.url.pathname !== '/login') goto('/login')
    supabase.auth.onAuthStateChange((_, s) => { session = s; if (!s) goto('/login') })
  })
  async function signOut() { await supabase.auth.signOut() }
</script>
{#if loading}
  <div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#9ca3af">Loading…</div>
{:else}
  {#if session}
    <nav style="display:flex;gap:1rem;align-items:center;padding:.75rem 1.5rem;background:#111827;border-bottom:1px solid #1f2937;font-size:.875rem">
      <span style="font-weight:700;color:#a78bfa;margin-right:auto">🎸 ShenanigansStudio</span>
      <a href="/">Dashboard</a>
      <a href="/songs">Songs</a>
      <a href="/setlists">Setlists</a>
      <button on:click={signOut} style="background:transparent;color:#6b7280;padding:0">Sign out</button>
    </nav>
  {/if}
  <main style="padding:1.5rem;min-height:100vh;background:#030712;color:#fff"><slot /></main>
{/if}
<style>
  :global(body){margin:0;font-family:system-ui,sans-serif;background:#030712;color:#fff}
  :global(a){color:inherit;text-decoration:none}
  :global(input,select){background:#1f2937;border:1px solid #374151;color:#fff;padding:.5rem .75rem;border-radius:.375rem;box-sizing:border-box;width:100%}
  :global(button){background:#7c3aed;color:#fff;border:none;padding:.5rem 1.25rem;border-radius:.375rem;cursor:pointer}
  :global(button:hover){background:#6d28d9}
  :global(button:disabled){opacity:.5;cursor:not-allowed}
  :global(table){width:100%;border-collapse:collapse;margin-top:1rem}
  :global(th,td){padding:.5rem .75rem;text-align:left;border-bottom:1px solid #1f2937}
  :global(th){color:#9ca3af;font-size:.75rem;text-transform:uppercase}
  :global(tr:hover td){background:#111827}
</style>
