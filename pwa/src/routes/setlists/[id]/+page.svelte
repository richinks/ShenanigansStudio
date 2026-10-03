<script>
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { supabase } from '#lib/supabase'

  let setlist = null, songs = [], allSongs = [], loading = true, err = ''
  let showAddModal = false, addSearch = '', addLoading = false
  let saving = false

  $: setlistId = page.params.id

  onMount(() => load())

  async function load() {
    loading = true
    const [{ data: sl, error: e1 }, { data: ss, error: e2 }] = await Promise.all([
      supabase.from('setlists').select('*').eq('id', setlistId).single(),
      supabase.from('setlist_songs')
        .select('id, position, song_id, songs(*)')
        .eq('setlist_id', setlistId)
        .order('position')
    ])
    if (e1) { err = e1.message; loading = false; return }
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

  $: filtered = allSongs.filter(s =>
    !addSearch ||
    s.title?.toLowerCase().includes(addSearch.toLowerCase()) ||
    s.artist?.toLowerCase().includes(addSearch.toLowerCase())
  )

  let adding = new Set()

  async function addSong(song) {
    adding.add(song.id); adding = new Set(adding)
    const pos = songs.length
    const { data, error } = await supabase
      .from('setlist_songs')
      .insert({ setlist_id: setlistId, song_id: song.id, position: pos })
      .select('id')
      .single()
    if (!error) {
      songs = [...songs, { rowId: data.id, position: pos, ...song }]
      allSongs = allSongs.filter(s => s.id !== song.id)
    }
    adding.delete(song.id); adding = new Set(adding)
  }

  async function remove(rowId, songId) {
    const { error } = await supabase.from('setlist_songs').delete().eq('id', rowId)
    if (error) return
    songs = songs.filter(s => s.rowId !== rowId)
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
    const updates = songs.map(s =>
      supabase.from('setlist_songs').update({ position: s.position }).eq('id', s.rowId)
    )
    await Promise.all(updates)
  }

  async function deleteSetlist() {
    if (!confirm(`Delete "${setlist.name}"? This removes the setlist but NOT the songs from the database.`)) return
    await supabase.from('setlists').delete().eq('id', setlistId)
    goto('/setlists')
  }

  function totalTime() {
    const songSecs = songs.reduce((acc, s) => acc + (s.duration_sec ?? 0), 0)
    if (!songSecs) return 'â€”'
    const gaps = Math.max(0, songs.length - 1) * 120
    const total = songSecs + gaps
    const fmt = (n) => Math.floor(n/60) + 'm ' + String(n%60).padStart(2,'0') + 's'
    return fmt(total) + '  (songs ' + fmt(songSecs) + ' + ' + (songs.length - 1) + 'Ã—2m gaps)'
  }

  const sc = { Active: '#4ade80', WIP: '#facc15', Retired: '#6b7280' }
</script>

{#if loading}
  <p class="muted">Loadingâ€¦</p>
{:else if err}
  <p style="color:#f87171">âš ï¸ {err}</p>
{:else}
  <div class="header">
    <div>
      <a href="/setlists" class="back">â† Setlists</a>
      <h1>{setlist.name}</h1>
      <div class="meta">
        {#if setlist.gig_date}<span>ðŸ“… {setlist.gig_date}</span>{/if}
        {#if setlist.venue}<span>ðŸ“ {setlist.venue}</span>{/if}
        <span>ðŸŽµ {songs.length} songs</span>
        <span>âµ {totalTime()}</span>
      </div>
    </div>
    <div class="hdr-actions">
      <button on:click={openAdd}>ï¼‹ Add Songs</button>
      <button class="print-btn" on:click={() => window.print()} title="Print setlist">ðŸ–¨ Print</button>
      <button class="del" on:click={deleteSetlist}>Delete Setlist</button>
    </div>
  </div>

  {#if setlist.notes}
    <p class="notes">{setlist.notes}</p>
  {/if}

  {#if songs.length === 0}
    <p class="muted empty">No songs yet â€” click "Add Songs" to build this setlist.</p>
  {:else}
    <div class="list">
      {#each songs as s, i (s.rowId)}
        <div class="row">
          <span class="num">{i + 1}</span>
          <div class="info">
            <span class="title">{s.title}</span>
            <span class="artist muted">{s.artist ?? 'â€”'}</span>
          </div>
          <span class="key">{s.key ?? 'â€”'}</span>
          <span class="bpm">{s.drummer_click_bpm ?? 'â€”'} <span class="muted">BPM</span></span>
          <span class="len">{s.duration_sec ? String(Math.floor(s.duration_sec/60))+':'+String(s.duration_sec%60).padStart(2,'0') : 'â€”'}</span>
          <span class="status" style="color:{sc[s.status] ?? '#9ca3af'}">{s.status ?? 'â€”'}</span>
          <div class="moves">
            <button class="icon" on:click={() => move(i, -1)} disabled={i === 0} title="Move up">â†‘</button>
            <button class="icon" on:click={() => move(i, 1)} disabled={i === songs.length - 1} title="Move down">â†“</button>
          </div>
          <button class="icon remove" on:click={() => remove(s.rowId, s.id)} title="Remove from setlist">âœ•</button>
        </div>
      {/each}
    </div>
  {/if}
{/if}

{#if showAddModal}
  <div class="overlay" on:click|self={() => showAddModal = false}>
    <div class="modal">
      <div class="modal-hdr">
        <h2>Add Songs</h2>
        <button class="ghost sm" on:click={() => showAddModal = false}>Close</button>
      </div>
      <input bind:value={addSearch} placeholder="Search title or artistâ€¦" class="modal-search" />
      <div class="modal-list">
        {#if filtered.length === 0}
          <p class="muted" style="padding:.75rem">All songs already in this setlist.</p>
        {:else}
          {#each filtered as s (s.id)}
            <div class="modal-row">
              <div class="info">
                <span class="title">{s.title}</span>
                <span class="muted artist">{s.artist ?? 'â€”'}</span>
              </div>
              <span class="key muted">{s.key ?? 'â€”'}</span>
              <span class="status sm" style="color:{sc[s.status] ?? '#9ca3af'}">{s.status}</span>
              <button class="add-btn" on:click={() => addSong(s)} disabled={adding.has(s.id)}>
                {adding.has(s.id) ? 'â€¦' : 'ï¼‹'}
              </button>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .back{color:#6b7280;font-size:.85rem;text-decoration:none;display:inline-block;margin-bottom:.25rem}
  .back:hover{color:#fff}
  .header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:1.25rem;gap:1rem;flex-wrap:wrap}
  h1{font-size:1.5rem;font-weight:700;margin:0 0 .35rem}
  .meta{display:flex;gap:.75rem;font-size:.8rem;color:#6b7280;flex-wrap:wrap}
  .hdr-actions{display:flex;gap:.6rem;align-items:center;flex-shrink:0}
  .notes{color:#9ca3af;font-size:.875rem;margin-bottom:1rem;background:#0f172a;padding:.75rem 1rem;border-radius:.5rem;border-left:3px solid #bf5500}
  .muted{color:#6b7280}
  .empty{margin-top:2rem;text-align:center}
  .print-btn{background:#1f2937;color:#9ca3af;border:1px solid #374151;}
  .print-btn:hover{color:#fff}
  .del{background:#7f1d1d;color:#fca5a5}
  .del:hover{background:#991b1b}
  .ghost{background:transparent;color:#6b7280;border:1px solid #374151}
  .ghost:hover{color:#fff;background:#374151}
  .sm{font-size:.8rem;padding:.3rem .7rem}

  /* Song list */
  .list{display:flex;flex-direction:column;gap:.4rem}
  .row{
    display:flex;align-items:center;gap:.75rem;
    background:#0f172a;border:1px solid #1f2937;
    border-radius:.5rem;padding:.6rem .75rem;
  }
  .row:hover{border-color:#374151}
  .num{width:1.5rem;text-align:right;color:#6b7280;font-size:.8rem;flex-shrink:0}
  .info{flex:1;min-width:0}
  .title{font-weight:600;color:#f1f5f9;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .artist{font-size:.8rem;display:block}
  .key{width:4rem;font-size:.85rem;color:#d1d5db;flex-shrink:0}
  .bpm{width:5.5rem;font-size:.85rem;color:#d1d5db;flex-shrink:0}
  .len{width:3.5rem;font-size:.85rem;color:#d1d5db;flex-shrink:0}
  .status{width:4.5rem;font-size:.8rem;font-weight:600;flex-shrink:0}
  .moves{display:flex;gap:.25rem;flex-shrink:0}
  .icon{background:transparent;color:#6b7280;border:1px solid #1f2937;padding:.25rem .45rem;font-size:.85rem;border-radius:.3rem;cursor:pointer;line-height:1}
  .icon:hover:not(:disabled){background:#1f2937;color:#fff}
  .icon:disabled{opacity:.25;cursor:not-allowed}
  .remove:hover:not(:disabled){background:#7f1d1d;border-color:#7f1d1d;color:#fca5a5}

  /* Modal */
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:100}
  .modal{background:#111827;border:1px solid #374151;border-radius:.75rem;width:min(560px,95vw);max-height:80vh;display:flex;flex-direction:column}
  .modal-hdr{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid #1f2937}
  .modal-hdr h2{margin:0;font-size:1.1rem;font-weight:700}
  .modal-search{margin:.75rem 1.25rem;width:calc(100% - 2.5rem);box-sizing:border-box}
  .modal-list{overflow-y:auto;flex:1;padding:0 .5rem .75rem}
  .modal-row{display:flex;align-items:center;gap:.6rem;padding:.5rem .75rem;border-radius:.4rem;cursor:default}
  .modal-row:hover{background:#0f172a}
  .modal-row .info{flex:1;min-width:0}
  .modal-row .title{font-size:.875rem;font-weight:600;color:#f1f5f9;white-space:nowraw;overflow:hidden;text-overflow:ellipsis;display:block}
  .modal-row .artist{font-size:.75rem}
  .modal-row .key{width:3.5rem;font-size:.8rem;flex-shrink:0}
  .modal-row .status.sm{width:4rem;flex-shrink:0}
  .add-btn{background:#5c1a00;color:#e8851a;border:none;padding:.3rem .65rem;border-radius:.35rem;cursor:pointer;font-size:1rem;font-weight:700;flex-shrink:0}
  .add-btn:hover:not(:disabled){background:#bf5500;color:#fff}
  .add-btn:disabled{opacity:.4}

  @media print {
    :global(nav), :global(header), .hdr-actions, .moves, .icon, .del, .print-btn { display: none !important }
    :global(body) { background: #fff !important; color: #000 !important }
    .header { margin-bottom: .5rem }
    h1 { font-size: 1.2rem; color: #000 }
    .meta { color: #444; font-size: .8rem }
    .notes { background: #f5f5f5; border-left: 3px solid #bf5500; color: #333 }
    .row { background: #fff !important; border: 1px solid #ccc !important; border-radius: 0 !important; padding: .35rem .5rem !important; break-inside: avoid }
    .num, .title, .key, .bpm, .len, .status { color: #000 !important }
    .muted { color: #555 !important }
    .list { gap: .15rem }
  }

</style>

