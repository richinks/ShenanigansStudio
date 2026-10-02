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

  // ── Edit modal ──────────────────────────────────────────────
  let editSong = null, editForm = {}, editSaving = false

  function openEdit(song, e) {
    e.stopPropagation()
    editSong = song
    editForm = {
      title:       song.title       ?? '',
      artist:      song.artist      ?? '',
      key:         song.key         ?? '',
      click_bpm:   song.click_bpm   ?? '',
      feel:        song.feel        ?? '',
      status:      song.status      ?? 'WIP',
      duration_sec:song.duration_sec?? '',
      notes:       song.notes       ?? '',
    }
  }

  async function saveEdit() {
    editSaving = true
    const upd = {
      title:       editForm.title        || null,
      artist:      editForm.artist       || null,
      key:         editForm.key          || null,
      click_bpm:   editForm.click_bpm    ? Number(editForm.click_bpm)    : null,
      feel:        editForm.feel         || null,
      status:      editForm.status       || null,
      duration_sec:editForm.duration_sec ? Number(editForm.duration_sec) : null,
      notes:       editForm.notes        || null,
    }
    const { error } = await supabase.from('songs').update(upd).eq('id', editSong.id)
    if (!error) {
      songs = songs.map(x => x.id === editSong.id ? { ...x, ...upd } : x)
      editSong = null
    } else alert('Save failed: ' + error.message)
    editSaving = false
  }

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

{#if editSong}
  <div class="overlay" on:click|self={() => editSong = null}>
    <div class="edit-modal">
      <div class="em-hdr">
        <h2>Edit — {editSong.title}</h2>
        <button class="ghost sm" on:click={() => editSong = null}>✕</button>
      </div>
      <div class="em-body">
        <label>Title<input bind:value={editForm.title} /></label>
        <label>Artist<input bind:value={editForm.artist} /></label>
        <div class="em-row2">
          <label>Key<input bind:value={editForm.key} placeholder="C, Am, F#m…" /></label>
          <label>BPM<input type="number" min="40" max="300" bind:value={editForm.click_bpm} /></label>
        </div>
        <div class="em-row2">
          <label>Status
            <select bind:value={editForm.status}>
              <option>Active</option>
              <option>WIP</option>
              <option>Retired</option>
            </select>
          </label>
          <label>Duration (sec)<input type="number" min="0" bind:value={editForm.duration_sec} /></label>
        </div>
        <label>Feel<input bind:value={editForm.feel} placeholder="Funk, Rock, Ballad…" /></label>
        <label>Notes<textarea bind:value={editForm.notes} rows="3" placeholder="Stage notes, cue reminders…"></textarea></label>
      </div>
      <div class="em-footer">
        <button class="ghost sm" on:click={() => editSong = null}>Cancel</button>
        <button on:click={saveEdit} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save Changes'}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .header{display:flex;align-items:center;gap:.75rem;margin-bottom:1.5rem;flex-wrap:wrap}
  h1{font-size:1.5rem;font-weight:700;margin:0;flex:1}
  .search{max-width:16rem}
  select{width:9rem}
  .muted{color:#6b7280}
  .small{font-size:.8rem}
  .title{font-weight:500;color:#f1f5f9}

  .edit-btn{background:transparent;border:1px solid #374151;color:#9ca3af;padding:.2rem .5rem;border-radius:.3rem;cursor:pointer;font-size:.95rem;line-height:1}
  .edit-btn:hover{background:#1f2937;color:#e8851a;border-color:#e8851a}
  .edit-modal{background:#111827;border:1px solid #374151;border-radius:.75rem;width:min(500px,95vw);max-height:90vh;display:flex;flex-direction:column}
  .em-hdr{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid #1f2937}
  .em-hdr h2{margin:0;font-size:1.1rem;font-weight:700;color:#f1f5f9}
  .em-body{padding:1rem 1.25rem;display:flex;flex-direction:column;gap:.75rem;overflow-y:auto}
  .em-body label{display:flex;flex-direction:column;gap:.3rem;font-size:.75rem;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
  .em-body input,.em-body select,.em-body textarea{background:#0f172a;border:1px solid #374151;border-radius:.4rem;color:#f1f5f9;padding:.5rem .75rem;font-size:.9rem;width:100%;box-sizing:border-box;font-family:inherit}
  .em-body input:focus,.em-body select:focus,.em-body textarea:focus{outline:none;border-color:#bf5500;box-shadow:0 0 0 2px rgba(191,85,0,.25)}
  .em-body textarea{resize:vertical}
  .em-row2{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}
  .em-footer{display:flex;justify-content:flex-end;gap:.6rem;padding:1rem 1.25rem;border-top:1px solid #1f2937;flex-shrink:0}

</style>
