<script>
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabase'
  let songs=[], search='', statusFilter='all', loading=true
  onMount(async () => {
    const { data } = await supabase.from('songs').select('*').order('title')
    songs = data ?? []; loading = false
  })
  $: filtered = songs.filter(s =>
    (statusFilter==='all' || s.status===statusFilter) &&
    (!search || s.title?.toLowerCase().includes(search.toLowerCase()) ||
                s.artist?.toLowerCase().includes(search.toLowerCase()))
  )
  const c = { Active:'#4ade80', WIP:'#facc15', Retired:'#6b7280' }
</script>
<div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap">
  <h1 style="font-size:1.5rem;font-weight:700;margin:0;flex:1">Song Bible</h1>
  <input bind:value={search} placeholder="Search title / artist…" style="width:14rem" />
  <select bind:value={statusFilter} style="width:10rem">
    <option value="all">All statuses</option>
    <option value="Active">Active</option>
    <option value="WIP">WIP</option>
    <option value="Retired">Retired</option>
  </select>
</div>
{#if loading}<p style="color:#9ca3af">Loading…</p>
{:else}
  <p style="color:#6b7280;font-size:.875rem;margin-bottom:.5rem">{filtered.length} songs</p>
  <table>
    <thead><tr><th>Title</th><th>Artist</th><th>Key</th><th>BPM</th><th>Feel</th><th>Status</th><th>Source</th></tr></thead>
    <tbody>
      {#each filtered as s}
        <tr>
          <td style="font-weight:500">{s.title}</td>
          <td style="color:#9ca3af">{s.artist??'—'}</td>
          <td style="color:#d1d5db">{s.key??'—'}</td>
          <td style="color:#d1d5db">{s.click_bpm??'—'}</td>
          <td style="color:#9ca3af;font-size:.875rem">{s.feel??'—'}</td>
          <td style="color:{c[s.status]??'#9ca3af'};font-size:.875rem;font-weight:500">{s.status??'—'}</td>
          <td style="color:#6b7280;font-size:.875rem">{s.source_sheet??'—'}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
