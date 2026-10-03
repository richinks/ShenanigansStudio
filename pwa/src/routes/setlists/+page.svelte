<script>
  import { onMount } from 'svelte'
  import { supabase } from '#lib/supabase'
  let lists=[], name='', gig_date='', venue='', saving=false, createErr=''
  onMount(async () => {
    const { data } = await supabase.from('setlists').select('*').order('gig_date',{ascending:false})
    lists = data ?? []
  })
  async function create() {
    if (!name.trim()) return
    saving=true; createErr=''
    try {
      const { data, error } = await supabase.from('setlists')
        .insert({ name, gig_date: gig_date||null, venue: venue||null }).select().single()
      if (error) { createErr = error.message; return }
      lists = [data, ...lists]
      name=''; gig_date=''; venue=''
    } finally { saving=false }
  }
</script>
<h1>Setlists</h1>
<div class="new-form">
  <p class="label">New Setlist</p>{#if createErr}<p class="create-err">{createErr}</p>{/if}
  <form on:submit|preventDefault={create}>
    <div class="row">
      <div class="field grow">
        <label>Name *</label>
        <input bind:value={name} placeholder="e.g. Fall Gig 2026" required />
      </div>
      <div class="field">
        <label>Date</label>
        <input type="date" bind:value={gig_date} />
      </div>
      <div class="field grow">
        <label>Venue</label>
        <input bind:value={venue} placeholder="e.g. The Bottleneck" />
      </div>
      <button type="submit" disabled={saving}>{saving?'Savingâ€¦':'+ Create'}</button>
    </div>
  </form>
</div>
{#each lists as sl}
  <a class="row-item" href="/setlists/{sl.id}">
    <div class="grow">
      <div class="sl-name">{sl.name}</div>
      {#if sl.venue}<div class="sl-venue">@ {sl.venue}</div>{/if}
    </div>
    {#if sl.gig_date}<div class="sl-date">{sl.gig_date}</div>{/if}
    <span class="arrow">â†’</span>
  </a>
{:else}
  <p class="muted">No setlists yet â€” create one above.</p>
{/each}
<style>
  h1{font-size:1.5rem;font-weight:700;margin-bottom:1.5rem}
  .new-form{background:#0f172a;border:1px solid #1f2937;border-radius:.75rem;padding:1.25rem;margin-bottom:1.5rem}
  .label{color:#6b7280;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem}
  .row{display:flex;flex-wrap:wrap;gap:.75rem;align-items:flex-end}
  .field{display:flex;flex-direction:column;gap:.25rem}
  .field.grow{flex:1;min-width:10rem}
  label{font-size:.75rem;color:#6b7280}
  .row-item{display:flex;align-items:center;gap:1rem;background:#0f172a;border:1px solid #1f2937;border-radius:.75rem;padding:1rem 1.25rem;margin-bottom:.75rem;color:inherit}
  .row-item:hover{border-color:#374151}
  .grow{flex:1}
  .sl-name{font-weight:600}
  .sl-venue{color:#9ca3af;font-size:.85rem;margin-top:.15rem}
  .sl-date{color:#e8851a;font-size:.875rem}
  .arrow{color:#374151}
  .muted{color:#6b7280}
  .create-err{color:#f87171;font-size:.8rem;margin:.25rem 0 .5rem}
</style>


