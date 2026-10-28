<script>
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { supabase } from '#lib/supabase'

  let setlist = null, songs = [], allSongs = [], loading = true, err = ''
  let showAddModal = false, addSearch = ''
  let adding = new Set()

  $: setlistId = page.params.id

  onMount(() => load())

  async function load() {
    loading = true
    err = ''
    const [{ data: sl, error: e1 }, { data: ss, error: e2 }] = await Promise.all([
      supabase.from('setlists').select('*').eq('id', setlistId).single(),
      supabase.from('setlist_songs').select('id, position, song_id, songs(*)').eq('setlist_id', setlistId).order('position')
    ])
    if (e1 || e2) { err = (e1 || e2).message; loading = false; return }
    setlist = sl
    songs = (ss ?? []).map(r => ({ rowId: r.id, position: r.position, ...r.songs }))
    loading = false
  }

  async function openAdd() {
    addSearch = ''
    const { data } = await supabase.from('songs').select('*').order('title')
    const inList = new Set(songs.map(s => s.id))
    allSongs = (data ?? []).filter(s => !inList.has(s.id))
    showAddModal = true
  }

  $: filtered = allSongs.filter(s => !addSearch || s.title?.toLowerCase().includes(addSearch.toLowerCase()) || s.artist?.toLowerCase().includes(addSearch.toLowerCase()))

  async function addSong(song) {
    adding.add(song.id); adding = new Set(adding)
    const pos = songs.length
    const { data, error } = await supabase.from('setlist_songs').insert({ setlist_id: setlistId, song_id: song.id, position: pos }).select('id').single()
    if (!error) {
      songs = [...songs, { rowId: data.id, position: pos, ...song }]
      allSongs = allSongs.filter(s => s.id !== song.id)
    }
    adding.delete(song.id); adding = new Set(adding)
  }

  async function remove(rowId) {
    const { error } = await supabase.from('setlist_songs').delete().eq('id', rowId)
    if (error) return
    songs = songs.filter(s => s.rowId !== rowId).map((s, i) => ({ ...s, position: i }))
    await reindex()
  }

  async function move(index, dir) {
    const newIndex = index + dir
    if (newIndex < 0 || newIndex >= songs.length) return
    const arr = [...songs]
    ;[arr[index], arr[newIndex]] = [arr[newIndex], arr[index]]
    songs = arr.map((s, i) => ({ ...s, position: i }))
    await reindex()
  }

  async function reindex() {
    await Promise.all(songs.map(s => supabase.from('setlist_songs').update({ position: s.position }).eq('id', s.rowId)))
  }

  async function deleteSetlist() {
    if (!confirm(`Delete "${setlist.name}"? This removes the setlist but NOT the songs from the database.`)) return
    await supabase.from('setlists').delete().eq('id', setlistId)
    goto('/setlists')
  }

  function totalTime() {
    const songSecs = songs.reduce((acc, s) => acc + (s.duration_sec ?? s.duration_seconds ?? 0), 0)
    if (!songSecs) return '—'
    const gaps = Math.max(0, songs.length - 1) * 120
    const fmt = n => Math.floor(n/60) + 'm ' + String(n%60).padStart(2,'0') + 's'
    return fmt(songSecs + gaps) + '  (songs ' + fmt(songSecs) + ' + ' + (songs.length - 1) + '×2m gaps)'
  }

  function duration(song) {
    const sec = song.duration_sec ?? song.duration_seconds
    return sec ? `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}` : '—'
  }

  function bpm(song) { return song.click_bpm ?? song.drummer_click_bpm ?? song.bpm ?? song.recording_bpm ?? '—' }
  const sc = { Active: '#4ade80', WIP: '#facc15', Retired: '#6b7280' }
</script>

{#if loading}
  <p class="muted">Loading...</p>
{:else if err}
  <p class="error">{err}</p>
{:else}
  <div class="header">
    <div>
      <a href="/setlists" class="back">← Setlists</a>
      <h1>{setlist.name}</h1>
      <div class="meta">
        {#if setlist.gig_date}<span>{setlist.gig_date}</span>{/if}
        {#if setlist.venue}<span>{setlist.venue}</span>{/if}
        <span>{songs.length} songs</span><span>{totalTime()}</span>
      </div>
    </div>
    <div class="hdr-actions">
      <button on:click={openAdd}>+ Add Songs</button>
      <button class="print-btn" on:click={() => window.print()}>Print</button>
      <button class="del" on:click={deleteSetlist}>Delete Setlist</button>
    </div>
  </div>

  {#if setlist.notes}<p class="notes">{setlist.notes}</p>{/if}
  {#if songs.length === 0}
    <p class="muted empty">No songs yet. Select "Add Songs" to build this setlist.</p>
  {:else}
    <div class="list">
      {#each songs as s, i (s.rowId)}
        <div class="row">
          <span class="num">{i + 1}</span>
          <div class="info"><span class="title">{s.title}</span><span class="artist muted">{s.artist ?? '—'}</span></div>
          <span class="key">{s.key ?? '—'}</span>
          <span class="bpm">{bpm(s)} <span class="muted">BPM</span></span>
          <span class="len">{duration(s)}</span>
          <span class="status" style="color:{sc[s.status] ?? '#9ca3af'}">{s.status ?? '—'}</span>
          <div class="chart-cell">
            {#if s.drum_chart_url}
              <a class="chart-btn" href={s.drum_chart_url} target="_blank" rel="noopener noreferrer" on:click|stopPropagation>View Chart</a>
            {:else}
              <span class="no-chart">No Chart</span>
            {/if}
          </div>
          <div class="moves"><button class="icon" on:click={() => move(i,-1)} disabled={i===0}>↑</button><button class="icon" on:click={() => move(i,1)} disabled={i===songs.length-1}>↓</button></div>
          <button class="icon remove" on:click={() => remove(s.rowId)}>×</button>
        </div>
      {/each}
    </div>
  {/if}
{/if}

{#if showAddModal}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" on:click|self={() => showAddModal=false}>
    <div class="modal">
      <div class="modal-hdr"><h2>Add Songs</h2><button class="ghost sm" on:click={() => showAddModal=false}>Close</button></div>
      <input bind:value={addSearch} placeholder="Search title or artist..." class="modal-search" />
      <div class="modal-list">
        {#if filtered.length===0}<p class="muted empty-modal">All songs already in this setlist.</p>{/if}
        {#each filtered as s (s.id)}
          <div class="modal-row"><div class="info"><span class="title">{s.title}</span><span class="artist muted">{s.artist ?? '—'}</span></div><span class="key muted">{s.key ?? '—'}</span><span class="status sm" style="color:{sc[s.status] ?? '#9ca3af'}">{s.status}</span><button class="add-btn" on:click={() => addSong(s)} disabled={adding.has(s.id)}>{adding.has(s.id) ? '...' : '+'}</button></div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
.back{color:#6b7280;font-size:.85rem;text-decoration:none;display:inline-block;margin-bottom:.25rem}.back:hover{color:#fff}.header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:1.25rem;gap:1rem;flex-wrap:wrap}h1{font-size:1.5rem;font-weight:700;margin:0 0 .35rem}.meta{display:flex;gap:.75rem;font-size:.8rem;color:#6b7280;flex-wrap:wrap}.hdr-actions{display:flex;gap:.6rem;align-items:center;flex-shrink:0}.notes{color:#9ca3af;font-size:.875rem;margin-bottom:1rem;background:#0f172a;padding:.75rem 1rem;border-radius:.5rem;border-left:3px solid #bf5500}.muted{color:#6b7280}.error{color:#f87171}.empty{text-align:center;margin-top:2rem}.print-btn{background:#1f2937;color:#9ca3af;border:1px solid #374151}.del{background:#7f1d1d;color:#fca5a5}.ghost{background:transparent;color:#6b7280;border:1px solid #374151}.sm{font-size:.8rem;padding:.3rem .7rem}.list{display:flex;flex-direction:column;gap:.4rem}.row{display:flex;align-items:center;gap:.75rem;background:#0f172a;border:1px solid #1f2937;border-radius:.5rem;padding:.6rem .75rem}.row:hover{border-color:#374151}.num{width:1.5rem;text-align:right;color:#6b7280;font-size:.8rem;flex-shrink:0}.info{flex:1;min-width:0}.title{font-weight:600;color:#f1f5f9;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.artist{font-size:.8rem;display:block}.key{width:4rem;font-size:.85rem;color:#d1d5db;flex-shrink:0}.bpm{width:5.5rem;font-size:.85rem;color:#d1d5db;flex-shrink:0}.len{width:3.5rem;font-size:.85rem;color:#d1d5db;flex-shrink:0}.status{width:4.5rem;font-size:.8rem;font-weight:600;flex-shrink:0}.chart-cell{width:6.2rem;flex-shrink:0}.chart-btn{display:inline-block;color:#d8b4fe;background:#3b0764;border:1px solid #7e22ce;border-radius:.35rem;padding:.3rem .55rem;text-decoration:none;font-size:.72rem;font-weight:700;white-space:nowrap}.chart-btn:hover{background:#581c87;color:#fff}.no-chart{font-size:.72rem;color:#6b7280}.moves{display:flex;gap:.25rem;flex-shrink:0}.icon{background:transparent;color:#6b7280;border:1px solid #1f2937;padding:.25rem .45rem;font-size:.85rem;border-radius:.3rem;cursor:pointer}.icon:hover:not(:disabled){background:#1f2937;color:#fff}.icon:disabled{opacity:.25}.remove:hover{background:#7f1d1d;color:#fca5a5}.overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:100}.modal{background:#111827;border:1px solid #374151;border-radius:.75rem;width:min(560px,95vw);max-height:80vh;display:flex;flex-direction:column}.modal-hdr{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid #1f2937}.modal-hdr h2{margin:0;font-size:1.1rem}.modal-search{margin:.75rem 1.25rem;width:calc(100% - 2.5rem);box-sizing:border-box}.modal-list{overflow-y:auto;flex:1;padding:0 .5rem .75rem}.modal-row{display:flex;align-items:center;gap:.6rem;padding:.5rem .75rem;border-radius:.4rem}.modal-row:hover{background:#0f172a}.modal-row .key{width:3.5rem}.modal-row .status{width:4rem}.add-btn{background:#5c1a00;color:#e8851a;border:none;padding:.3rem .65rem;border-radius:.35rem;cursor:pointer;font-weight:700}.empty-modal{padding:.75rem}@media(max-width:800px){.key,.len,.status{display:none}.row{gap:.45rem}.chart-cell{width:5.5rem}.bpm{width:4.5rem}}@media print{.hdr-actions,.moves,.remove,.chart-cell{display:none!important}:global(body){background:#fff!important;color:#000!important}.row{background:#fff!important;border:1px solid #ccc!important;border-radius:0!important;padding:.35rem .5rem!important}.title,.key,.bpm,.len,.status{color:#000!important}.muted{color:#555!important}}
</style>
