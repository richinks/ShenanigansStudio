<script>
  import { supabase } from '#lib/supabase'

  export let onSaved = null
  export let onCancel = null

  let searchTitle = ''
  let searchArtist = ''
  let searching = false
  let searchError = ''
  let results = []
  let selectedId = ''
  let enriching = false
  let saving = false
  let errorMessage = ''

  let form = newForm()

  function newForm() {
    return {
      title: '', artist: '', recording_bpm: '', click_bpm: '', bpm: '',
      time_signature: '4/4', feel: '', key: '', duration_sec: '', count_in: 4,
      status: 'WIP', priority: 'wip', source_sheet: 'Shenanigans Studio metadata search',
      drum_chart_url: '', notes: ''
    }
  }

  const cleanText = (value) => typeof value === 'string' ? value.trim() : value
  function optionalNumber(value) {
    if (value === '' || value === null || value === undefined) return null
    const number = Number(value)
    return Number.isFinite(number) ? number : null
  }
  function formatDuration(seconds) {
    const value = Number(seconds)
    if (!Number.isFinite(value) || value <= 0) return 'Unknown duration'
    return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
  }

  async function searchSongs() {
    searchError = ''; errorMessage = ''; results = []; selectedId = ''
    if (!searchTitle.trim() && !searchArtist.trim()) {
      searchError = 'Enter a song title, artist, or both.'; return
    }
    searching = true
    try {
      const params = new URLSearchParams()
      if (searchTitle.trim()) params.set('title', searchTitle.trim())
      if (searchArtist.trim()) params.set('artist', searchArtist.trim())
      const response = await fetch(`/api/song-search?${params}`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Search failed.')
      results = payload.results ?? []
      if (!results.length) searchError = 'No matching recordings found.'
    } catch (error) { searchError = error?.message ?? 'Search failed.' }
    finally { searching = false }
  }

  async function selectRecording(result) {
    selectedId = result.id; errorMessage = ''
    form = {
      ...newForm(), title: result.title || '', artist: result.artist || '',
      duration_sec: result.durationSec || '',
      notes: [result.release ? `Release: ${result.release}` : '', result.releaseDate ? `Release date: ${result.releaseDate}` : '', result.sourceUrl ? `Recording source: ${result.sourceUrl}` : ''].filter(Boolean).join('\n')
    }
    enriching = true
    try {
      const response = await fetch('/api/song-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, artist: form.artist })
      })
      const payload = await response.json()
      if (response.ok) {
        const data = payload.enrichment ?? {}; const foundBpm = data.bpm || ''
        form = { ...form, recording_bpm: foundBpm, click_bpm: foundBpm, bpm: foundBpm,
          key: data.key || form.key, time_signature: data.timeSignature || form.time_signature,
          feel: data.genre || data.mood || form.feel, duration_sec: data.durationSec || form.duration_sec,
          notes: [form.notes, data.genre ? `Genre: ${data.genre}` : '', data.mood ? `Mood: ${data.mood}` : ''].filter(Boolean).join('\n') }
      }
    } finally { enriching = false }
  }

  function useHalfTime() {
    const bpm = optionalNumber(form.recording_bpm)
    if (bpm) form = { ...form, click_bpm: Math.round(bpm / 2) }
  }

  async function saveSong() {
    errorMessage = ''
    const title = cleanText(form.title); const artist = cleanText(form.artist)
    if (!title) { errorMessage = 'Song title is required.'; return }
    saving = true
    try {
      let duplicateQuery = supabase.from('songs').select('id,title,artist').ilike('title', title)
      if (artist) duplicateQuery = duplicateQuery.ilike('artist', artist)
      const { data: existing, error: duplicateError } = await duplicateQuery.limit(10)
      if (duplicateError) throw duplicateError
      const duplicate = (existing ?? []).find((song) => (song.title ?? '').trim().toLowerCase() === title.toLowerCase() && (song.artist ?? '').trim().toLowerCase() === artist.toLowerCase())
      if (duplicate) { errorMessage = artist ? `"${title}" by ${artist} is already in the Song Bible.` : `"${title}" is already in the Song Bible.`; return }
      const row = {
        title, artist: artist || null, recording_bpm: optionalNumber(form.recording_bpm),
        click_bpm: optionalNumber(form.click_bpm), bpm: optionalNumber(form.bpm || form.click_bpm || form.recording_bpm),
        time_signature: cleanText(form.time_signature) || null, feel: cleanText(form.feel) || null,
        key: cleanText(form.key) || null, duration_sec: optionalNumber(form.duration_sec), count_in: optionalNumber(form.count_in),
        status: cleanText(form.status) || 'WIP', priority: form.priority || 'wip',
        source_sheet: cleanText(form.source_sheet) || 'Shenanigans Studio metadata search',
        drum_chart_url: cleanText(form.drum_chart_url) || null, notes: cleanText(form.notes) || null,
        updated_at: new Date().toISOString()
      }
      const { data, error } = await supabase.from('songs').insert([row]).select().single()
      if (error) throw error
      if (typeof onSaved === 'function') onSaved(data)
    } catch (error) { errorMessage = error?.message ?? 'Unable to add the song.' }
    finally { saving = false }
  }
</script>

<div class="song-form">
  <div class="heading"><div><h2>Find and Add Song</h2><p>Search, select the recording, review the metadata and chart link, then save.</p></div><button type="button" class="close" on:click={onCancel}>×</button></div>
  <section><h3>1. Find the recording</h3><form class="search-grid" on:submit|preventDefault={searchSongs}><label>Song title<input bind:value={searchTitle} placeholder="The Boys of Summer" /></label><label>Artist<input bind:value={searchArtist} placeholder="Don Henley" /></label><button type="submit" disabled={searching}>{searching ? 'Searching...' : 'Search'}</button></form>{#if searchError}<p class="message error">{searchError}</p>{/if}</section>
  {#if results.length}<section><h3>2. Select the correct recording</h3><div class="results">{#each results as result (result.id)}<button type="button" class:selected={selectedId === result.id} class="result" on:click={() => selectRecording(result)}><strong>{result.title}</strong><span>{result.artist || 'Unknown artist'}</span><small>{result.release || 'Unknown release'}{result.releaseDate ? ` · ${result.releaseDate}` : ''}{result.durationSec ? ` · ${formatDuration(result.durationSec)}` : ''}</small></button>{/each}</div></section>{/if}
  {#if form.title}<section><h3>3. Review and save</h3>{#if enriching}<p class="lookup">Looking up additional metadata...</p>{/if}{#if errorMessage}<p class="message error">{errorMessage}</p>{/if}
    <div class="grid two"><label>Title<input bind:value={form.title} /></label><label>Artist<input bind:value={form.artist} /></label></div>
    <div class="grid three"><label>Recording BPM<input type="number" min="1" max="400" bind:value={form.recording_bpm} /></label><label>Click BPM<div class="inline"><input type="number" min="1" max="400" bind:value={form.click_bpm} /><button type="button" class="small" on:click={useHalfTime} disabled={!form.recording_bpm}>Half</button></div></label><label>BPM<input type="number" min="1" max="400" bind:value={form.bpm} /></label><label>Key<input bind:value={form.key} /></label><label>Time Signature<input bind:value={form.time_signature} /></label><label>Feel<input bind:value={form.feel} /></label><label>Duration (seconds)<input type="number" min="0" bind:value={form.duration_sec} /></label><label>Count In<input type="number" min="0" max="16" bind:value={form.count_in} /></label><label>Status<select bind:value={form.status}><option value="WIP">WIP</option><option value="Active">Active</option><option value="Retired">Retired</option></select></label><label>Priority<select bind:value={form.priority}><option value="wip">WIP</option><option value="active">Active</option><option value="retired">Retired</option></select></label></div>
    <label class="chart">Drum Chart URL<input type="url" bind:value={form.drum_chart_url} placeholder="https://..." />{#if form.drum_chart_url}<a href={form.drum_chart_url} target="_blank" rel="noopener noreferrer">Open chart</a>{/if}</label>
    <label>Notes<textarea rows="4" bind:value={form.notes}></textarea></label>
    <div class="actions"><button type="button" class="secondary" on:click={onCancel}>Cancel</button><button type="button" class="primary" on:click={saveSong} disabled={saving || enriching}>{saving ? 'Adding...' : 'Add to Song Bible'}</button></div>
  </section>{/if}
</div>

<style>
.song-form{width:100%;max-width:900px;margin:0 auto;color:#f1f5f9}.heading{display:flex;justify-content:space-between;gap:1rem;margin-bottom:1rem}h2{margin:0;font-size:1.5rem}.heading p{margin:.35rem 0 0;color:#9ca3af;font-size:.875rem}.close{background:transparent;color:#9ca3af;border:1px solid #374151;width:2.25rem;height:2.25rem;padding:0;font-size:1.35rem}section{padding:1rem;margin-bottom:1rem;border:1px solid #293241;border-radius:.75rem;background:#111827}h3{margin:0 0 1rem;color:#a78bfa;font-size:.85rem;text-transform:uppercase;letter-spacing:.08em}.search-grid{display:grid;grid-template-columns:1fr 1fr auto;gap:.75rem;align-items:end}.grid{display:grid;gap:.75rem;margin-bottom:.75rem}.grid.two{grid-template-columns:repeat(2,1fr)}.grid.three{grid-template-columns:repeat(3,1fr)}label{display:flex;flex-direction:column;gap:.35rem;color:#9ca3af;font-size:.8rem}input,select,textarea{width:100%;box-sizing:border-box;padding:.7rem .8rem;color:#f9fafb;background:#0b1220;border:1px solid #374151;border-radius:.45rem;font:inherit}.results{display:grid;gap:.5rem;max-height:290px;overflow:auto}.result{text-align:left;display:flex;flex-direction:column;gap:.2rem;background:#0b1220;color:#f1f5f9;border:1px solid #374151;padding:.7rem;border-radius:.5rem}.result:hover,.result.selected{border-color:#8b5cf6;background:#1e1b4b}.result span,.result small{color:#9ca3af}.inline{display:flex;gap:.4rem}.small{padding:.6rem}.chart{margin:.75rem 0}.chart a{color:#a78bfa;width:max-content}.actions{display:flex;justify-content:flex-end;gap:.75rem;margin-top:1rem}button{border-radius:.5rem;padding:.7rem 1rem;font-weight:600;cursor:pointer}.primary{background:#7c3aed;color:#fff;border:1px solid #7c3aed}.secondary{background:transparent;color:#d1d5db;border:1px solid #374151}.message{padding:.7rem;border-radius:.45rem}.error{color:#fecaca;background:#450a0a;border:1px solid #7f1d1d}.lookup{color:#a78bfa}@media(max-width:700px){.search-grid,.grid.two,.grid.three{grid-template-columns:1fr}.actions{flex-direction:column-reverse}}
</style>
