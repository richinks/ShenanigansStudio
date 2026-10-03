<script>
  import { onMount } from 'svelte'
  import { supabase } from '#lib/supabase'

  const ADMIN_EMAIL = 'richreidjr@hotmail.com'

  let songs = [], search = '', statusFilter = 'all', loading = true, err = ''
  let selected = new Set()
  let isAdmin = false
  let showSetlistModal = false
  let setlists = [], targetSetlist = '', addingToSetlist = false, addMsg = ''
  let deletingCount = 0, deleteMsg = ''
  let editSong = null, editForm = {}, editSaving = false

  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    isAdmin = session?.user?.email === ADMIN_EMAIL
    const { data, error } = await supabase.from('songs').select('*').order('title')
    if (error) err = error.message
    songs = data ?? []
    loading = false
  })

  $: filtered = songs.filter(s =>
    (statusFilter === 'all' || s.status === statusFilter) &&
    (!search || s.title?.toLowerCase().includes(search.toLowerCase()) ||
                s.artist?.toLowerCase().includes(search.toLowerCase()))
  )

  $: allSelected = filtered.length > 0 && filtered.every(s => selected.has(s.id))

  function toggleAll() {
    if (allSelected) filtered.forEach(s => selected.delete(s.id))
    else filtered.forEach(s => selected.add(s.id))
    selected = new Set(selected)
  }

  function toggleOne(id) {
    selected.has(id) ? selected.delete(id) : selected.add(id)
    selected = new Set(selected)
  }

  function openEdit(song, e) {
    e.stopPropagation()
    editSong = song
    editForm = {
      title:        song.title        ?? '',
      artist:       song.artist       ?? '',
      key:          song.key          ?? '',
      click_bpm:    song.click_bpm    ?? '',
      feel:         song.feel         ?? '',
      status:       song.status       ?? 'WIP',
      duration_sec: song.duration_sec ?? '',
      notes:        song.notes        ?? '',
    }
  }

  async function saveEdit() {
    editSaving = true
    const upd = {
      title:        editForm.title        || null,
      artist:       editForm.artist       || null,
      key:          editForm.key          || null,
      click_bpm:    editForm.click_bpm    ? Number(editForm.click_bpm)    : null,
      feel:         editForm.feel         || null,
      status:       editForm.status       || null,
      duration_sec: editForm.duration_sec ? Number(editForm.duration_sec) : null,
      notes:        editForm.notes        || null,
      updated_at:   new Date().toISOString(),
    }
    const { error } = await supabase.from('songs').update(upd).eq('id', editSong.id)
    if (!error) {
      songs = songs.map(x => x.id === editSong.id ? { ...x, ...upd } : x)
      editSong = null
    } else alert('Save failed: ' + error.message)
    editSaving = false
  }

  async function openSetlistModal() {
    const { data } = await supabase.from('setlists').select('*').order('name')
    setlists = data ?? []
    targetSetlist = setlists[0]?.id ?? ''
    addMsg = ''
    showSetlistModal = true
  }


  async function createNewSetlist() {
    if (!newSetlistName.trim()) return
    creatingSetlist = true; createSetlistErr = ''
    const { data, error } = await supabase
      .from('setlists')
      .insert({ name: newSetlistName.trim() }).select().single()
    if (error) { createSetlistErr = error.message; creatingSetlist = false; return }
    setlists = [data, ...setlists]
    targetSetlist = data.id
    newSetlistName = ''; newSetlistMode = false
    creatingSetlist = false
  }
  async function addToSetlist() {
    if (!targetSetlist) return
    addingToSetlist = true
    const existing = await supabase
      .from('setlist_songs')
      .select('song_id')
      .eq('setlist_id', targetSetlist)
    const existingIds = new Set((existing.data ?? []).map(r => r.song_id))
    const rows = [...selected]
      .filter(id => !existingIds.has(id))
      .map((id, i) => ({ setlist_id: targetSetlist, song_id: id, position: (existing.data?.length ?? 0) + i }))
    const skipped = [...selected].length - rows.length
    if (rows.length > 0) {
      const { error } = await supabase.from('setlist_songs').insert(rows)
      if (error) { addMsg = 'âŒ ' + error.message; addingToSetlist = false; return }
    }
    addMsg = `âœ… Added ${rows.length} song${rows.length !== 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} already in setlist)` : ''}`
    addingToSetlist = false
    selected = new Set()
    setTimeout(() => { showSetlistModal = false; addMsg = '' }, 1500)
  }

  async function deleteSongs() {
    if (!confirm(`Permanently delete ${selected.size} song${selected.size !== 1 ? 's' : ''} from the master database? This cannot be undone.`)) return
    deletingCount = selected.size
    const ids = [...selected]
    const { error } = await supabase.from('songs').delete().in('id', ids)
    if (error) { deleteMsg = 'âŒ ' + error.message; deletingCount = 0; return }
    songs = songs.filter(s => !ids.includes(s.id))
    selected = new Set()
    deleteMsg = `âœ… Deleted ${ids.length} song${ids.length !== 1 ? 's' : ''}`
    deletingCount = 0
    setTimeout(() => deleteMsg = '', 3000)
  }

  const sc = { Active: '#4ade80', WIP: '#facc15', Retired: '#6b7280' }
</script>

<div class="header">
  <h1>Song Bible <span class="count">{songs.length}</span></h1>
  <input bind:value={search} placeholder="Search title or artistâ€¦" class="search" />
  <select bind:value={statusFilter}>
    <option value="all">All statuses</option>
    <option value="Active">Active</option>
    <option value="WIP">WIP</option>
    <option value="Retired">Retired</option>
  </select>
</div>

{#if deleteMsg}<p class="toast">{deleteMsg}</p>{/if}

{#if loading}
  <p class="muted">Loadingâ€¦</p>
{:else if err}
  <p style="color:#f87171">âš ï¸ {err}</p>
{:else}
  <p class="muted sub">{filtered.length} song{filtered.length !== 1 ? 's' : ''} shown</p>
  <table>
    <thead>
      <tr>
        <th><input type="checkbox" checked={allSelected} on:change={toggleAll} /></th>
        <th>Title</th><th>Artist</th><th>Key</th><th>BPM</th><th>Feel</th><th>Status</th>
        {#if isAdmin}<th></th>{/if}
      </tr>
    </thead>
    <tbody>
      {#each filtered as s (s.id)}
        <tr class:sel={selected.has(s.id)} on:click={() => toggleOne(s.id)}>
          <td on:click|stopPropagation><input type="checkbox" checked={selected.has(s.id)} on:change={() => toggleOne(s.id)} /></td>
          <td class="title">{s.title}</td>
          <td class="muted">{s.artist ?? 'â€”'}</td>
          <td>{s.key ?? 'â€”'}</td>
          <td>{s.click_bpm ?? 'â€”'}</td>
          <td class="muted small">{s.feel ?? 'â€”'}</td>
          <td class="small" style="color:{sc[s.status] ?? '#9ca3af'};font-weight:600">{s.status ?? 'â€”'}</td>
          {#if isAdmin}
            <td on:click|stopPropagation><button class="edit-btn" on:click={e => openEdit(s, e)}>âœï¸</button></td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

{#if selected.size > 0}
  <div class="action-bar">
    <span class="sel-count">{selected.size} selected</span>
    <button on:click={openSetlistModal}>ï¼‹ Add to Setlist</button>
    {#if isAdmin}
      <button class="del" on:click={deleteSongs} disabled={deletingCount > 0}>
        {deletingCount > 0 ? 'Deletingâ€¦' : 'ðŸ—‘ Delete'}
      </button>
    {/if}
    <button class="ghost" on:click={() => selected = new Set()}>Clear</button>
  </div>
{/if}

{#if showSetlistModal}
  <div class="overlay" on:click|self={() => showSetlistModal = false}>
    <div class="modal">
      <h2>Add {selected.size} song{selected.size !== 1 ? 's' : ''} to Setlist</h2>
      {#if setlists.length === 0}
        <p class="muted">No setlists yet. Create one on the Setlists page first.</p>
      {:else}
        <label>Choose setlist
          <select bind:value={targetSetlist} style="margin-top:.4rem">
            {#each setlists as sl}
              <option value={sl.id}>{sl.name}{sl.gig_date ? ' â€” ' + sl.gig_date : ''}</option>
            {/each}
          </select>
        </label>
        {#if addMsg}<p class="msg">{addMsg}</p>{/if}
        <div class="modal-actions">
          <button on:click={addToSetlist} disabled={addingToSetlist}>
            {addingToSetlist ? 'Addingâ€¦' : 'Add Songs'}
          </button>
          <button class="ghost" on:click={() => showSetlistModal = false}>Cancel</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if editSong}
  <div class="overlay" on:click|self={() => editSong = null}>
    <div class="modal wide">
      <h2>Edit â€” {editSong.title}</h2>
      <div class="form-grid">
        <label>Title<input bind:value={editForm.title} /></label>
        <label>Artist<input bind:value={editForm.artist} /></label>
        <label>Key<input bind:value={editForm.key} /></label>
        <label>Click BPM<input type="number" bind:value={editForm.click_bpm} /></label>
        <label>Feel<input bind:value={editForm.feel} /></label>
        <label>Duration (sec)<input type="number" bind:value={editForm.duration_sec} /></label>
        <label>Status
          <select bind:value={editForm.status}>
            <option value="Active">Active</option>
            <option value="WIP">WIP</option>
            <option value="Retired">Retired</option>
          </select>
        </label>
        <label class="span2">Notes<textarea bind:value={editForm.notes} rows="3"></textarea></label>
      </div>
      <div class="modal-actions">
        <button on:click={saveEdit} disabled={editSaving}>{editSaving ? 'Savingâ€¦' : 'Save'}</button>
        <button class="ghost" on:click={() => editSong = null}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .header{display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem;flex-wrap:wrap}
  h1{font-size:1.5rem;font-weight:700;margin:0;flex:1;display:flex;align-items:center;gap:.5rem}
  .count{font-size:.9rem;background:#1f2937;color:#6b7280;padding:.15rem .5rem;border-radius:999px;font-weight:400}
  .search{max-width:16rem}
  select{width:10rem}
  .muted{color:#6b7280}
  .sub{font-size:.8rem;margin-bottom:.5rem}
  .small{font-size:.8rem}
  .title{font-weight:500;color:#f1f5f9}
  tr{cursor:pointer}
  tr.sel td{background:#1e1b4b}
  .toast{color:#4ade80;font-size:.875rem;margin-bottom:.5rem}
  .msg{font-size:.875rem;margin:.5rem 0}
  .edit-btn{background:transparent;border:none;cursor:pointer;font-size:.85rem;padding:.15rem .35rem;border-radius:.25rem;opacity:.6}
  .edit-btn:hover{opacity:1;background:#1f2937}
  .action-bar{
    position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);
    display:flex;align-items:center;gap:.75rem;
    background:#1f2937;border:1px solid #374151;border-radius:.75rem;
    padding:.75rem 1.25rem;box-shadow:0 8px 32px rgba(0,0,0,.6);z-index:50;
  }
  .sel-count{color:#a78bfa;font-weight:600;font-size:.875rem;margin-right:.25rem}
  .del{background:#7f1d1d;color:#fca5a5}
  .del:hover{background:#991b1b}
  .ghost{background:transparent;color:#6b7280;border:1px solid #374151}
  .ghost:hover{color:#fff;background:#374151}
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:100}
  .modal{background:#111827;border:1px solid #374151;border-radius:.75rem;padding:1.5rem;min-width:320px;max-width:480px;width:90%}
  .modal.wide{max-width:640px}
  .modal h2{font-size:1.1rem;font-weight:700;margin-bottom:1rem}
  label{display:block;font-size:.85rem;color:#9ca3af;margin-bottom:.75rem}
  .modal-actions{display:flex;gap:.75rem;margin-top:1rem}
  .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}
  .form-grid label{margin-bottom:0}
  .span2{grid-column:1/-1}
  textarea{width:100%;min-height:80px;resize:vertical;margin-top:.25rem}
  .sl-pick-row{display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem}
  .new-sl-btn{padding:.35rem .75rem;font-size:.8rem;flex-shrink:0}
  .new-sl-form{display:flex;flex-direction:column;gap:.5rem}
  .err-msg{color:#f87171;font-size:.8rem;margin:.25rem 0}
</style>


