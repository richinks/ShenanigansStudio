<script>
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabase'
  let setlists=[], name='', gig_date='', venue='', saving=false
  onMount(async () => {
    const { data } = await supabase.from('setlists').select('*').order('gig_date',{ascending:false})
    setlists = data ?? []
  })
  async function create() {
    if (!name.trim()) return
    saving=true
    const { data } = await supabase.from('setlists')
      .insert({name,gig_date:gig_date||null,venue:venue||null}).select().single()
    if (data) setlists=[data,...setlists]
    name=''; gig_date=''; venue=''; saving=false
  }
</script>
<h1 style="font-size:1.5rem;font-weight:700;margin-bottom:1.5rem">Setlists</h1>
<div style="background:#111827;border:1px solid #1f2937;border-radius:.75rem;padding:1.25rem;margin-bottom:2rem">
  <p style="color:#9ca3af;font-size:.75rem;text-transform:uppercase;margin:0 0 .75rem">New Setlist</p>
  <form on:submit|preventDefault={create} style="display:flex;flex-wrap:wrap;gap:.75rem;align-items:flex-end">
    <div style="flex:1;min-width:10rem">
      <label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:.25rem">Name *</label>
      <input bind:value={name} placeholder="e.g. Fall Gig 2026" required />
    </div>
    <div>
      <label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:.25rem">Date</label>
      <input type="date" bind:value={gig_date} style="width:10rem" />
    </div>
    <div style="flex:1;min-width:10rem">
      <label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:.25rem">Venue</label>
      <input bind:value={venue} placeholder="e.g. The Bottleneck" />
    </div>
    <button type="submit" disabled={saving} style="align-self:flex-end">
      {saving?'Saving…':'+ Create'}
    </button>
  </form>
</div>
{#each setlists as sl}
  <a href="/setlists/{sl.id}" style="display:flex;align-items:center;gap:1rem;background:#111827;border:1px solid #1f2937;border-radius:.75rem;padding:1rem 1.25rem;margin-bottom:.75rem">
    <div style="flex:1">
      <div style="font-weight:600">{sl.name}</div>
      {#if sl.venue}<div style="color:#9ca3af;font-size:.875rem">@ {sl.venue}</div>{/if}
    </div>
    {#if sl.gig_date}<div style="color:#a78bfa;font-size:.875rem">{sl.gig_date}</div>{/if}
    <span style="color:#374151">→</span>
  </a>
{:else}
  <p style="color:#6b7280">No setlists yet — create one above.</p>
{/each}
