<script>
  import { onMount } from 'svelte'
  import { supabase } from '#lib/supabase'
  import AddSong from '#lib/AddSong.svelte'

  const ADMIN_EMAIL = 'richreidjr@hotmail.com'

  let songs = []
  let search = ''
  let statusFilter = 'all'
  let loading = true
  let err = ''

  let selected = new Set()
  let isAdmin = false

  let showAddSong = false
  let showSetlistModal = false

  let setlists = []
  let targetSetlist = ''
  let addingToSetlist = false
  let addMsg = ''

  let deletingCount = 0
  let deleteMsg = ''

  let editSong = null
  let editForm = {}
  let editSaving = false

  let newSetlistName = ''
  let newSetlistMode = false
  let creatingSetlist = false
  let createSetlistErr = ''

  onMount(async () => {
    const {
      data: { session }
    } = await supabase.auth.getSession()

    isAdmin = session?.user?.email === ADMIN_EMAIL

    await loadSongs()
  })

  async function loadSongs() {
    loading = true
    err = ''

    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .order('title')

    if (error) {
      err = error.message
      songs = []
    } else {
      songs = data ?? []
    }

    loading = false
  }

  $: filtered = songs.filter((song) => {
    const matchesStatus =
      statusFilter === 'all' ||
      song.status === statusFilter

    const query = search.trim().toLowerCase()

    const matchesSearch =
      !query ||
      song.title?.toLowerCase().includes(query) ||
      song.artist?.toLowerCase().includes(query)

    return matchesStatus && matchesSearch
  })

  $: allSelected =
    filtered.length > 0 &&
    filtered.every((song) => selected.has(song.id))

  function toggleAll() {
    if (allSelected) {
      filtered.forEach((song) => selected.delete(song.id))
    } else {
      filtered.forEach((song) => selected.add(song.id))
    }

    selected = new Set(selected)
  }

  function toggleOne(id) {
    if (selected.has(id)) {
      selected.delete(id)
    } else {
      selected.add(id)
    }

    selected = new Set(selected)
  }

  function handleSongAdded(song) {
    songs = [...songs, song].sort((a, b) =>
      (a.title ?? '').localeCompare(b.title ?? '')
    )

    showAddSong = false
  }

  function openEdit(song, event) {
    event.stopPropagation()

    editSong = song

    editForm = {
      title: song.title ?? '',
      artist: song.artist ?? '',
      recording_bpm: song.recording_bpm ?? '',
      click_bpm: song.click_bpm ?? '',
      bpm: song.bpm ?? '',
      key: song.key ?? '',
      time_signature: song.time_signature ?? '',
      feel: song.feel ?? '',
      duration_sec: song.duration_sec ?? '',
      count_in: song.count_in ?? '',
      status: song.status ?? 'WIP',
      priority: song.priority ?? 'wip',
      notes: song.notes ?? ''
    }
  }

  function optionalNumber(value) {
    if (
      value === '' ||
      value === null ||
      value === undefined
    ) {
      return null
    }

    const number = Number(value)

    return Number.isFinite(number)
      ? number
      : null
  }

  async function saveEdit() {
    editSaving = true

    const upd = {
      title: editForm.title?.trim() || null,
      artist: editForm.artist?.trim() || null,

      recording_bpm:
        optionalNumber(editForm.recording_bpm),

      click_bpm:
        optionalNumber(editForm.click_bpm),

      bpm:
        optionalNumber(editForm.bpm),

      key:
        editForm.key?.trim() || null,

      time_signature:
        editForm.time_signature?.trim() || null,

      feel:
        editForm.feel?.trim() || null,

      duration_sec:
        optionalNumber(editForm.duration_sec),

      count_in:
        optionalNumber(editForm.count_in),

      status:
        editForm.status || 'WIP',

      priority:
        editForm.priority || 'wip',

      notes:
        editForm.notes?.trim() || null,

      updated_at:
        new Date().toISOString()
    }

    const { error } = await supabase
      .from('songs')
      .update(upd)
      .eq('id', editSong.id)

    if (error) {
      alert('Save failed: ' + error.message)
      editSaving = false
      return
    }

    songs = songs
      .map((song) =>
        song.id === editSong.id
          ? { ...song, ...upd }
          : song
      )
      .sort((a, b) =>
        (a.title ?? '').localeCompare(b.title ?? '')
      )

    editSong = null
    editSaving = false
  }

  async function openSetlistModal() {
    const { data, error } = await supabase
      .from('setlists')
      .select('*')
      .order('name')

    if (error) {
      addMsg =
        'Unable to load setlists: ' +
        error.message
      return
    }

    setlists = data ?? []
    targetSetlist = setlists[0]?.id ?? ''

    newSetlistName = ''
    newSetlistMode = false
    createSetlistErr = ''
    addMsg = ''

    showSetlistModal = true
  }

  async function createNewSetlist() {
    if (!newSetlistName.trim()) {
      return
    }

    creatingSetlist = true
    createSetlistErr = ''

    const { data, error } = await supabase
      .from('setlists')
      .insert({
        name: newSetlistName.trim()
      })
      .select()
      .single()

    if (error) {
      createSetlistErr = error.message
      creatingSetlist = false
      return
    }

    setlists = [data, ...setlists]
    targetSetlist = data.id

    newSetlistName = ''
    newSetlistMode = false
    creatingSetlist = false
  }

  async function addToSetlist() {
    if (!targetSetlist) {
      return
    }

    addingToSetlist = true
    addMsg = ''

    const existing = await supabase
      .from('setlist_songs')
      .select('song_id')
      .eq('setlist_id', targetSetlist)

    if (existing.error) {
      addMsg =
        'Unable to check setlist: ' +
        existing.error.message

      addingToSetlist = false
      return
    }

    const existingIds = new Set(
      (existing.data ?? []).map(
        (row) => row.song_id
      )
    )

    const selectedIds = [...selected]

    const rows = selectedIds
      .filter((id) => !existingIds.has(id))
      .map((id, index) => ({
        setlist_id: targetSetlist,
        song_id: id,
        position:
          (existing.data?.length ?? 0) + index
      }))

    const skipped =
      selectedIds.length - rows.length

    if (rows.length > 0) {
      const { error } = await supabase
        .from('setlist_songs')
        .insert(rows)

      if (error) {
        addMsg =
          'Add failed: ' + error.message

        addingToSetlist = false
        return
      }
    }

    addMsg =
      `Added ${rows.length} song` +
      `${rows.length !== 1 ? 's' : ''}` +
      `${skipped > 0
        ? ` (${skipped} already in setlist)`
        : ''}`

    addingToSetlist = false
    selected = new Set()

    setTimeout(() => {
      showSetlistModal = false
      addMsg = ''
    }, 1500)
  }

  async function deleteSongs() {
    const count = selected.size

    if (
      !confirm(
        `Permanently delete ${count} song` +
        `${count !== 1 ? 's' : ''} ` +
        `from the master database? ` +
        `This cannot be undone.`
      )
    ) {
      return
    }

    deletingCount = count

    const ids = [...selected]

    const { error } = await supabase
      .from('songs')
      .delete()
      .in('id', ids)

    if (error) {
      deleteMsg =
        'Delete failed: ' + error.message

      deletingCount = 0
      return
    }

    songs = songs.filter(
      (song) => !ids.includes(song.id)
    )

    selected = new Set()

    deleteMsg =
      `Deleted ${ids.length} song` +
      `${ids.length !== 1 ? 's' : ''}`

    deletingCount = 0

    setTimeout(() => {
      deleteMsg = ''
    }, 3000)
  }

  function statusColor(status) {
    if (status === 'Active') return '#4ade80'
    if (status === 'WIP') return '#facc15'
    if (status === 'Retired') return '#6b7280'

    return '#9ca3af'
  }
</script>

<div class="header">
  <h1>
    Song Bible
    <span class="count">{songs.length}</span>
  </h1>

  {#if isAdmin}
    <button
      class="add-song-btn"
      on:click={() => showAddSong = true}
    >
      + Add Song
    </button>
  {/if}

  <input
    bind:value={search}
    placeholder="Search title or artist..."
    class="search"
  />

  <select bind:value={statusFilter}>
    <option value="all">
      All statuses
    </option>

    <option value="Active">
      Active
    </option>

    <option value="WIP">
      WIP
    </option>

    <option value="Retired">
      Retired
    </option>
  </select>
</div>

{#if showAddSong}
  <div
    class="overlay"
    role="presentation"
    on:click|self={() =>
      showAddSong = false}
  >
    <div class="add-song-modal">
      <AddSong
        onSaved={handleSongAdded}
        onCancel={() =>
          showAddSong = false}
      />
    </div>
  </div>
{/if}

{#if deleteMsg}
  <p class="toast">
    {deleteMsg}
  </p>
{/if}

{#if loading}

  <p class="muted">
    Loading...
  </p>

{:else if err}

  <p class="error-text">
    {err}
  </p>

{:else}

  <p class="muted sub">
    {filtered.length}
    song{filtered.length !== 1 ? 's' : ''}
    shown
  </p>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>
            <input
              type="checkbox"
              checked={allSelected}
              on:change={toggleAll}
            />
          </th>

          <th>Title</th>
          <th>Artist</th>
          <th>Key</th>
          <th>BPM</th>
          <th>Feel</th>
          <th>Status</th>

          {#if isAdmin}
            <th></th>
          {/if}
        </tr>
      </thead>

      <tbody>
        {#each filtered as song (song.id)}
          <tr
            class:sel={selected.has(song.id)}
            on:click={() =>
              toggleOne(song.id)}
          >
            <td on:click|stopPropagation>
              <input
                type="checkbox"
                checked={selected.has(song.id)}
                on:change={() =>
                  toggleOne(song.id)}
              />
            </td>

            <td class="title">
              {song.title}
            </td>

            <td class="muted">
              {song.artist ?? '—'}
            </td>

            <td>
              {song.key ?? '—'}
            </td>

            <td>
              {song.click_bpm ??
               song.bpm ??
               song.recording_bpm ??
               '—'}
            </td>

            <td class="muted small">
              {song.feel ?? '—'}
            </td>

            <td
              class="small status"
              style={`color:${statusColor(song.status)}`}
            >
              {song.status ?? '—'}
            </td>

            {#if isAdmin}
              <td on:click|stopPropagation>
                <button
                  class="edit-btn"
                  title="Edit song"
                  on:click={(event) =>
                    openEdit(song, event)}
                >
                  Edit
                </button>
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

{/if}

{#if selected.size > 0}
  <div class="action-bar">
    <span class="sel-count">
      {selected.size} selected
    </span>

    <button on:click={openSetlistModal}>
      + Add to Setlist
    </button>

    {#if isAdmin}
      <button
        class="del"
        on:click={deleteSongs}
        disabled={deletingCount > 0}
      >
        {deletingCount > 0
          ? 'Deleting...'
          : 'Delete'}
      </button>
    {/if}

    <button
      class="ghost"
      on:click={() =>
        selected = new Set()}
    >
      Clear
    </button>
  </div>
{/if}

{#if showSetlistModal}
  <div
    class="overlay"
    role="presentation"
    on:click|self={() =>
      showSetlistModal = false}
  >
    <div class="modal">
      <h2>
        Add {selected.size}
        song{selected.size !== 1 ? 's' : ''}
        to Setlist
      </h2>

      {#if newSetlistMode}

        <label>
          New Setlist Name

          <input
            bind:value={newSetlistName}
            placeholder="Setlist name"
          />
        </label>

        {#if createSetlistErr}
          <p class="error-text">
            {createSetlistErr}
          </p>
        {/if}

        <div class="modal-actions">
          <button
            on:click={createNewSetlist}
            disabled={creatingSetlist}
          >
            {creatingSetlist
              ? 'Creating...'
              : 'Create Setlist'}
          </button>

          <button
            class="ghost"
            on:click={() =>
              newSetlistMode = false}
          >
            Cancel
          </button>
        </div>

      {:else}

        {#if setlists.length > 0}
          <label>
            Choose Setlist

            <select
              bind:value={targetSetlist}
              class="modal-select"
            >
              {#each setlists as setlist}
                <option value={setlist.id}>
                  {setlist.name}
                  {setlist.gig_date
                    ? ` — ${setlist.gig_date}`
                    : ''}
                </option>
              {/each}
            </select>
          </label>
        {:else}
          <p class="muted">
            No setlists exist yet.
          </p>
        {/if}

        <button
          class="new-setlist-btn"
          on:click={() =>
            newSetlistMode = true}
        >
          + New Setlist
        </button>

        {#if addMsg}
          <p class="msg">
            {addMsg}
          </p>
        {/if}

        <div class="modal-actions">
          {#if setlists.length > 0}
            <button
              on:click={addToSetlist}
              disabled={addingToSetlist}
            >
              {addingToSetlist
                ? 'Adding...'
                : 'Add Songs'}
            </button>
          {/if}

          <button
            class="ghost"
            on:click={() =>
              showSetlistModal = false}
          >
            Cancel
          </button>
        </div>

      {/if}
    </div>
  </div>
{/if}

{#if editSong}
  <div
    class="overlay"
    role="presentation"
    on:click|self={() =>
      editSong = null}
  >
    <div class="modal wide">
      <h2>
        Edit — {editSong.title}
      </h2>

      <div class="form-grid">
        <label>
          Title
          <input
            bind:value={editForm.title}
          />
        </label>

        <label>
          Artist
          <input
            bind:value={editForm.artist}
          />
        </label>

        <label>
          Recording BPM
          <input
            type="number"
            bind:value={editForm.recording_bpm}
          />
        </label>

        <label>
          Click BPM
          <input
            type="number"
            bind:value={editForm.click_bpm}
          />
        </label>

        <label>
          BPM
          <input
            type="number"
            bind:value={editForm.bpm}
          />
        </label>

        <label>
          Key
          <input
            bind:value={editForm.key}
          />
        </label>

        <label>
          Time Signature
          <input
            bind:value={editForm.time_signature}
          />
        </label>

        <label>
          Feel
          <input
            bind:value={editForm.feel}
          />
        </label>

        <label>
          Duration (sec)
          <input
            type="number"
            bind:value={editForm.duration_sec}
          />
        </label>

        <label>
          Count In
          <input
            type="number"
            bind:value={editForm.count_in}
          />
        </label>

        <label>
          Status

          <select bind:value={editForm.status}>
            <option value="Active">
              Active
            </option>
            <option value="WIP">
              WIP
            </option>
            <option value="Retired">
              Retired
            </option>
          </select>
        </label>

        <label>
          Priority

          <select bind:value={editForm.priority}>
            <option value="active">
              Active
            </option>
            <option value="wip">
              WIP
            </option>
            <option value="retired">
              Retired
            </option>
          </select>
        </label>

        <label class="span2">
          Notes

          <textarea
            bind:value={editForm.notes}
            rows="4"
          ></textarea>
        </label>
      </div>

      <div class="modal-actions">
        <button
          on:click={saveEdit}
          disabled={editSaving}
        >
          {editSaving
            ? 'Saving...'
            : 'Save'}
        </button>

        <button
          class="ghost"
          on:click={() =>
            editSong = null}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .header {
    display: flex;
    align-items: center;
    gap: .75rem;
    margin-bottom: .5rem;
    flex-wrap: wrap;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    flex: 1;
    display: flex;
    align-items: center;
    gap: .5rem;
  }

  .count {
    font-size: .9rem;
    background: #1f2937;
    color: #9ca3af;
    padding: .15rem .5rem;
    border-radius: 999px;
    font-weight: 400;
  }

  .search {
    max-width: 16rem;
  }

  select {
    width: 10rem;
  }

  .muted {
    color: #6b7280;
  }

  .sub {
    font-size: .8rem;
    margin-bottom: .5rem;
  }

  .small {
    font-size: .8rem;
  }

  .title {
    font-weight: 500;
    color: #f1f5f9;
  }

  .status {
    font-weight: 600;
  }

  .table-wrap {
    width: 100%;
    overflow-x: auto;
  }

  table {
    width: 100%;
  }

  tr {
    cursor: pointer;
  }

  tr.sel td {
    background: #1e1b4b;
  }

  .toast {
    color: #4ade80;
    font-size: .875rem;
    margin-bottom: .5rem;
  }

  .msg {
    color: #4ade80;
    font-size: .875rem;
    margin: .75rem 0;
  }

  .error-text {
    color: #f87171;
  }

  .add-song-btn {
    background: #7c3aed;
    color: #fff;
    border: none;
    border-radius: .5rem;
    padding: .55rem .9rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .add-song-btn:hover {
    background: #8b5cf6;
  }

  .edit-btn {
    background: transparent;
    color: #a78bfa;
    border: 1px solid #374151;
    cursor: pointer;
    font-size: .75rem;
    padding: .25rem .5rem;
    border-radius: .3rem;
  }

  .edit-btn:hover {
    background: #1f2937;
  }

  .action-bar {
    position: fixed;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: .75rem;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: .75rem;
    padding: .75rem 1.25rem;
    box-shadow: 0 8px 32px rgba(0,0,0,.6);
    z-index: 50;
  }

  .sel-count {
    color: #a78bfa;
    font-weight: 600;
    font-size: .875rem;
  }

  .del {
    background: #7f1d1d;
    color: #fca5a5;
  }

  .del:hover {
    background: #991b1b;
  }

  .ghost {
    background: transparent;
    color: #9ca3af;
    border: 1px solid #374151;
  }

  .ghost:hover {
    color: #fff;
    background: #374151;
  }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.72);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 100;
  }

  .modal {
    background: #111827;
    border: 1px solid #374151;
    border-radius: .75rem;
    padding: 1.5rem;
    min-width: 320px;
    max-width: 480px;
    width: 90%;
  }

  .modal.wide {
    max-width: 700px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal h2 {
    font-size: 1.1rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }

  .add-song-modal {
    width: min(900px, 94vw);
    max-height: 90vh;
    overflow-y: auto;
    background: #0b1220;
    border: 1px solid #374151;
    border-radius: .85rem;
    padding: 1.5rem;
    box-shadow: 0 20px 60px rgba(0,0,0,.65);
  }

  label {
    display: block;
    font-size: .85rem;
    color: #9ca3af;
    margin-bottom: .75rem;
  }

  label input,
  label select,
  label textarea {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin-top: .3rem;
  }

  .modal-select {
    margin-top: .4rem;
    width: 100%;
  }

  .modal-actions {
    display: flex;
    gap: .75rem;
    margin-top: 1rem;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: .75rem;
  }

  .form-grid label {
    margin-bottom: 0;
  }

  .span2 {
    grid-column: 1 / -1;
  }

  textarea {
    min-height: 80px;
    resize: vertical;
  }

  .new-setlist-btn {
    margin-top: .5rem;
  }

  @media (max-width: 700px) {
    .form-grid {
      grid-template-columns: 1fr;
    }

    .span2 {
      grid-column: auto;
    }

    .action-bar {
      width: calc(100% - 2rem);
      box-sizing: border-box;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
</style>