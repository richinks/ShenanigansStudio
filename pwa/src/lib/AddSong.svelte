<script>
  import { supabase } from '#lib/supabase'

  export let onSaved = null
  export let onCancel = null

  let saving = false
  let errorMessage = ''
  let successMessage = ''

  let form = {
    title: '',
    artist: '',
    recording_bpm: '',
    click_bpm: '',
    bpm: '',
    time_signature: '4/4',
    feel: '',
    key: '',
    duration_sec: '',
    count_in: 4,
    status: 'WIP',
    priority: 'wip',
    source_sheet: 'Shenanigans Studio',
    notes: ''
  }

  function cleanText(value) {
    return typeof value === 'string' ? value.trim() : value
  }

  function optionalNumber(value) {
    if (value === '' || value === null || value === undefined) {
      return null
    }

    const number = Number(value)

    return Number.isFinite(number) ? number : null
  }

  async function saveSong() {
    errorMessage = ''
    successMessage = ''

    const title = cleanText(form.title)
    const artist = cleanText(form.artist)

    if (!title) {
      errorMessage = 'Song title is required.'
      return
    }

    saving = true

    try {
      /*
       * Prevent an obvious duplicate before inserting.
       * We treat title + artist as the logical identity
       * for this UI.
       */
      let duplicateQuery = supabase
        .from('songs')
        .select('id,title,artist')
        .ilike('title', title)

      if (artist) {
        duplicateQuery = duplicateQuery.ilike('artist', artist)
      }

      const {
        data: existing,
        error: duplicateError
      } = await duplicateQuery.limit(10)

      if (duplicateError) {
        throw duplicateError
      }

      const duplicate = (existing ?? []).find((song) => {
        const existingTitle =
          (song.title ?? '').trim().toLowerCase()

        const existingArtist =
          (song.artist ?? '').trim().toLowerCase()

        return (
          existingTitle === title.toLowerCase() &&
          existingArtist === artist.toLowerCase()
        )
      })

      if (duplicate) {
        errorMessage =
          artist
            ? `"${title}" by ${artist} is already in the Song Bible.`
            : `"${title}" is already in the Song Bible.`

        return
      }

      const row = {
        title,
        artist: artist || null,

        recording_bpm:
          optionalNumber(form.recording_bpm),

        click_bpm:
          optionalNumber(form.click_bpm),

        bpm:
          optionalNumber(
            form.bpm || form.click_bpm || form.recording_bpm
          ),

        time_signature:
          cleanText(form.time_signature) || null,

        feel:
          cleanText(form.feel) || null,

        key:
          cleanText(form.key) || null,

        duration_sec:
          optionalNumber(form.duration_sec),

        count_in:
          optionalNumber(form.count_in),

        status:
          cleanText(form.status) || 'WIP',

        /*
         * Live DB constraint:
         * active | wip | retired
         */
        priority: form.priority,

        source_sheet:
          cleanText(form.source_sheet) || 'Shenanigans Studio',

        notes:
          cleanText(form.notes) || null,

        updated_at:
          new Date().toISOString()
      }

      const {
        data,
        error
      } = await supabase
        .from('songs')
        .insert([row])
        .select()
        .single()

      if (error) {
        throw error
      }

      successMessage = `"${data.title}" added to the Song Bible.`

      if (typeof onSaved === 'function') {
        onSaved(data)
      }

      resetForm()
    } catch (error) {
      console.error('Add song failed:', error)

      errorMessage =
        error?.message ??
        'Unable to add the song to the Song Bible.'
    } finally {
      saving = false
    }
  }

  function resetForm() {
    form = {
      title: '',
      artist: '',
      recording_bpm: '',
      click_bpm: '',
      bpm: '',
      time_signature: '4/4',
      feel: '',
      key: '',
      duration_sec: '',
      count_in: 4,
      status: 'WIP',
      priority: 'wip',
      source_sheet: 'Shenanigans Studio',
      notes: ''
    }
  }

  function cancel() {
    errorMessage = ''
    successMessage = ''

    if (typeof onCancel === 'function') {
      onCancel()
    }
  }
</script>

<div class="song-form">
  <div class="heading">
    <div>
      <h2>Add Song</h2>
      <p>Add a new song to the Shenanigans Studio master Song Bible.</p>
    </div>
  </div>

  {#if errorMessage}
    <div class="message error" role="alert">
      {errorMessage}
    </div>
  {/if}

  {#if successMessage}
    <div class="message success" role="status">
      {successMessage}
    </div>
  {/if}

  <form on:submit|preventDefault={saveSong}>
    <section>
      <h3>Song</h3>

      <div class="grid two">
        <label>
          Title
          <input
            bind:value={form.title}
            required
            placeholder="The Boys of Summer"
          />
        </label>

        <label>
          Original Artist
          <input
            bind:value={form.artist}
            placeholder="Don Henley"
          />
        </label>
      </div>
    </section>

    <section>
      <h3>Tempo & Musical Data</h3>

      <div class="grid three">
        <label>
          Recording BPM
          <input
            type="number"
            min="1"
            max="400"
            bind:value={form.recording_bpm}
            placeholder="177"
          />
        </label>

        <label>
          Click BPM
          <input
            type="number"
            min="1"
            max="400"
            bind:value={form.click_bpm}
            placeholder="89"
          />
        </label>

        <label>
          BPM
          <input
            type="number"
            min="1"
            max="400"
            bind:value={form.bpm}
            placeholder="89"
          />
        </label>

        <label>
          Key
          <input
            bind:value={form.key}
            placeholder="F#"
          />
        </label>

        <label>
          Time Signature
          <input
            bind:value={form.time_signature}
            placeholder="4/4"
          />
        </label>

        <label>
          Feel
          <input
            bind:value={form.feel}
            placeholder="Straight"
          />
        </label>
      </div>
    </section>

    <section>
      <h3>Performance</h3>

      <div class="grid three">
        <label>
          Duration (seconds)
          <input
            type="number"
            min="0"
            bind:value={form.duration_sec}
            placeholder="288"
          />
        </label>

        <label>
          Count In
          <input
            type="number"
            min="0"
            max="16"
            bind:value={form.count_in}
          />
        </label>

        <label>
          Status
          <select bind:value={form.status}>
            <option value="WIP">WIP</option>
            <option value="Active">Active</option>
            <option value="Retired">Retired</option>
          </select>
        </label>

        <label>
          Priority
          <select bind:value={form.priority}>
            <option value="wip">WIP</option>
            <option value="active">Active</option>
            <option value="retired">Retired</option>
          </select>
        </label>

        <label class="span-two">
          Source
          <input
            bind:value={form.source_sheet}
            placeholder="Shenanigans Studio"
          />
        </label>
      </div>
    </section>

    <section>
      <h3>Notes</h3>

      <label>
        Notes
        <textarea
          bind:value={form.notes}
          rows="4"
          placeholder="Arrangement notes, Fadr status, REAPER prep, performance notes..."
        ></textarea>
      </label>
    </section>

    <div class="actions">
      {#if onCancel}
        <button
          type="button"
          class="secondary"
          on:click={cancel}
          disabled={saving}
        >
          Cancel
        </button>
      {/if}

      <button
        type="submit"
        class="primary"
        disabled={saving}
      >
        {saving ? 'Adding Song...' : 'Add Song'}
      </button>
    </div>
  </form>
</div>

<style>
  .song-form {
    width: 100%;
    max-width: 820px;
    margin: 0 auto;
    color: #f1f5f9;
  }

  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.25rem;
  }

  h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .heading p {
    margin: 0.35rem 0 0;
    color: #6b7280;
    font-size: 0.875rem;
  }

  section {
    padding: 1rem;
    margin-bottom: 1rem;
    border: 1px solid #293241;
    border-radius: 0.75rem;
    background: #111827;
  }

  h3 {
    margin: 0 0 1rem;
    color: #a78bfa;
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .grid {
    display: grid;
    gap: 0.85rem;
  }

  .grid.two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .grid.three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    color: #9ca3af;
    font-size: 0.8rem;
    font-weight: 500;
  }

  input,
  select,
  textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 0.7rem 0.8rem;
    color: #f9fafb;
    background: #0b1220;
    border: 1px solid #374151;
    border-radius: 0.45rem;
    font: inherit;
  }

  input:focus,
  select:focus,
  textarea:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.18);
  }

  textarea {
    resize: vertical;
  }

  .span-two {
    grid-column: span 2;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  button {
    border: 0;
    border-radius: 0.5rem;
    padding: 0.7rem 1.1rem;
    font-weight: 600;
    cursor: pointer;
  }

  button:disabled {
    cursor: wait;
    opacity: 0.55;
  }

  .primary {
    color: #ffffff;
    background: #7c3aed;
  }

  .primary:hover:not(:disabled) {
    background: #8b5cf6;
  }

  .secondary {
    color: #d1d5db;
    background: transparent;
    border: 1px solid #374151;
  }

  .secondary:hover:not(:disabled) {
    background: #1f2937;
  }

  .message {
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
  }

  .error {
    color: #fecaca;
    background: #450a0a;
    border: 1px solid #7f1d1d;
  }

  .success {
    color: #bbf7d0;
    background: #052e16;
    border: 1px solid #166534;
  }

  @media (max-width: 700px) {
    .grid.two,
    .grid.three {
      grid-template-columns: 1fr;
    }

    .span-two {
      grid-column: auto;
    }
  }
</style>