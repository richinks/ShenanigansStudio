<script>
  import { onMount } from 'svelte'
  import { supabase } from '#lib/supabase'
  let songs=[], search='', statusFilter='all', loading=true, err=''
  onMount(async () => {
    const { data, error } = await supabase.from('songs').select('*').order('title')
    console.log('songs data:', data)
    console.log('songs error:', error)
    if (error) err = error.message
    songs = data ?? []; loading = false
  })
  $: filtered = songs.filter(s =>
    (statusFilter==='all' || s.status===statusFilter) &&
    (!search || s.title?.toLowerCase().includes(search.toLowerCase()) ||
                s.artist?.toLowerCase().includes(search.toLowerCase()))
  )
  const sc = { Active:'#4ade80', WIP:'#facc15', Retired:'#6b7280' }
</script>
<div class="header">
  <h1>Song Bible</h1>
  <input bind:value={search} placeholder="Search title or artist…" class="search" />
  <select bind:value={statusFilter}>
    <option value="all">All</option>
    <option value="Active">Active</option>
    <option value="WIP">WIP</option>
    <option value="Retired">Retired</option>
  </select>
</div>
{#if loading}
  <p class="muted">Loading…</p>
{:else if err}
  <p style="color:#f87171">⚠️ Error: {err}</p>
{:else if filtered.length === 0}
  <p class="muted">No songs found. (Total in DB: {songs.length})</p>
{:else}
  <p class="muted">{filtered.length} songs</p>
  <table>
    <thead><tr><th>Title</th><th>Artist</th><th>Key</th><th>BPM</th><th>Length</th><th>Feel</th><th>Status</th><th>Source</th></tr></thead>
    <tbody>
      {#each filtered as s}
        <tr>
          <td class="title">{s.title}</td>
          <td class="muted">{s.artist??'—'}</td>
          <td>{s.key??'—'}</td>
          <td>{s.click_bpm??'—'}</td>
          <td class="muted small">{s.feel??'—'}</td>
          <td class="small" style="color:{sc[s.status]??'#9ca3af'};font-weight:500">{s.status??'—'}</td>
          <td class="muted small">{s.source_sheet??'—'}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
<style>
  .header{display:flex;align-items:center;gap:.75rem;margin-bottom:1.5rem;flex-wrap:wrap}
  h1{font-size:1.5rem;font-weight:700;margin:0;flex:1}
  .search{max-width:16rem}
  select{width:9rem}
  .muted{color:#6b7280}
  .small{font-size:.8rem}
  .title{font-weight:500;color:#f1f5f9}
</style>
