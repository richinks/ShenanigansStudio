<script>
  import { onMount, onDestroy } from 'svelte'
  import { supabase } from '#lib/supabase'

  let apiBase = ''
  let apiInput = ''
  let showSettings = false
  let setlists = []
  let activeSetlist = null
  let songs = []
  let currentIdx = 0
  let connected = false
  let connecting = false
  let apiErr = ''
  let loading = true
  let recording = false
  let pollTimer = null
  let meterSource = null
  let fxSaving = false
  let fxSaved = false
  let transport = { playing: false, paused: false, position: '0:00', bpm: '—' }
  let meters = { ch: Array(16).fill(0), bus: Array(8).fill(0), lr: [0, 0] }

  $: currentSong = songs[currentIdx] ?? null
  $: prevSong = songs[currentIdx - 1] ?? null
  $: nextSong = songs[currentIdx + 1] ?? null

  onMount(async () => {
    apiBase = localStorage.getItem('showApiBase') || 'http://localhost:5000'
    apiInput = apiBase
    await loadSetlists()
    startMeters()
    startPoll()
    loading = false
  })

  onDestroy(() => {
    clearInterval(pollTimer)
    stopMeters()
  })

  async function loadSetlists() {
    const { data, error } = await supabase
      .from('setlists')
      .select('*, setlist_songs(position, songs(*))')
      .order('name')

    if (error) {
      apiErr = error.message
      return
    }

    setlists = data ?? []
    if (setlists.length && !activeSetlist) selectSetlist(setlists[0])
  }

  function selectSetlist(setlist) {
    if (!setlist) return
    activeSetlist = setlist
    songs = (setlist.setlist_songs ?? [])
      .sort((a, b) => a.position - b.position)
      .map((entry) => entry.songs)
      .filter(Boolean)
    currentIdx = 0
  }

  function startPoll() {
    clearInterval(pollTimer)
    pollStatus()
    pollTimer = setInterval(pollStatus, 2000)
  }

  async function pollStatus() {
    try {
      const response = await fetch(`${apiBase}/status`, {
        signal: AbortSignal.timeout(1500)
      })
      if (!response.ok) throw new Error(response.statusText)
      const data = await response.json()
      transport = {
        playing: Boolean(data.playing),
        paused: Boolean(data.paused),
        position: data.position ?? '0:00',
        bpm: data.bpm ?? '—'
      }
      connected = true
      apiErr = ''
    } catch (error) {
      connected = false
      apiErr = error?.message ?? 'Unreachable'
    }
  }

  async function callApi(path, method = 'POST', body = null) {
    connecting = true
    try {
      const options = { method, signal: AbortSignal.timeout(3000) }
      if (body) {
        options.headers = { 'Content-Type': 'application/json' }
        options.body = JSON.stringify(body)
      }
      const response = await fetch(`${apiBase}${path}`, options)
      if (!response.ok) throw new Error(response.statusText)
      const data = await response.json().catch(() => ({}))
      connected = true
      apiErr = ''
      return data
    } catch (error) {
      connected = false
      apiErr = error?.message ?? 'Request failed'
      return null
    } finally {
      connecting = false
    }
  }

  function startMeters() {
    stopMeters()
    try {
      meterSource = new EventSource(`${apiBase}/meters/stream`)
      meterSource.onmessage = (event) => {
        try { meters = JSON.parse(event.data) } catch {}
      }
      meterSource.onerror = () => {
        stopMeters()
        setTimeout(startMeters, 3000)
      }
    } catch {
      meterSource = null
    }
  }

  function stopMeters() {
    if (meterSource) meterSource.close()
    meterSource = null
  }

  function saveApiBase() {
    apiBase = apiInput.trim().replace(/\/$/, '')
    localStorage.setItem('showApiBase', apiBase)
    showSettings = false
    startMeters()
    startPoll()
  }

  function songBpm(song) {
    return song?.click_bpm ?? song?.bpm ?? song?.recording_bpm ?? '—'
  }

  function fmtDuration(seconds) {
    const value = Number(seconds)
    if (!Number.isFinite(value) || value <= 0) return '—'
    return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
  }

  async function cueSong(index) {
    currentIdx = index
    const song = songs[index]
    if (!song) return
    await callApi('/song/cue', 'POST', {
      song_id: song.id,
      title: song.title,
      click_bpm: songBpm(song),
      x32_scene: song.x32_scene
    })
  }

  function handleSongKey(event, index) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      cueSong(index)
    }
  }

  async function saveFx() {
    if (!currentSong) return
    fxSaving = true
    fxSaved = false
    const data = await callApi('/song/fx/save', 'POST', { title: currentSong.title })
    fxSaving = false
    if (data?.ok) {
      fxSaved = true
      setTimeout(() => { fxSaved = false }, 3000)
    } else {
      alert('FX save failed. Is the Show API running?')
    }
  }

  const play = () => callApi('/transport/play')
  const pause = () => callApi('/transport/pause')
  const stop = () => callApi('/transport/stop')
  const prev = () => currentIdx > 0 && cueSong(currentIdx - 1)
  const next = () => currentIdx < songs.length - 1 && cueSong(currentIdx + 1)
  const recallX32 = () => currentSong?.x32_scene && callApi(`/x32/scene/${currentSong.x32_scene}`)

  async function record() {
    recording = !recording
    await callApi(recording ? '/transport/record' : '/transport/stop')
  }
</script>

<svelte:head><title>Live Mode - ShenanigansStudio</title></svelte:head>

{#if recording}<div class="rec-indicator">RECORDING</div>{/if}

<div class:ok={connected} class:bad={!connected} class="conn-bar">
  <span class="dot"></span>
  <span>{connected ? `Show API connected: ${apiBase}` : `Show API offline: ${apiErr}`}</span>
  <button class="gear" on:click={() => { showSettings = !showSettings; apiInput = apiBase }}>Settings</button>
</div>

{#if showSettings}
  <div class="settings-panel">
    <label>Show PC API URL
      <input bind:value={apiInput} placeholder="http://192.168.1.x:5000" />
    </label>
    <button on:click={saveApiBase}>Save and Connect</button>
    <button class="ghost" on:click={() => showSettings = false}>Cancel</button>
  </div>
{/if}

{#if loading}
  <p class="muted">Loading...</p>
{:else}
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <select on:change={(event) => selectSetlist(setlists.find((item) => item.id === event.currentTarget.value))}>
          {#each setlists as setlist}
            <option value={setlist.id}>{setlist.name}</option>
          {/each}
        </select>
        <span class="count">{songs.length}</span>
      </div>

      <ul class="song-list">
        {#each songs as song, index}
          <li
            class:active={index === currentIdx}
            on:click={() => cueSong(index)}
            on:keydown={(event) => handleSongKey(event, index)}
            role="button"
            tabindex="0"
          >
            <span class="num">{index + 1}</span>
            <span class="info">
              <span class="title">{song.title}</span>
              <span class="meta">{song.key ?? '?'} · {songBpm(song)} BPM</span>
            </span>
            <span class="song-actions">
              {#if song.drum_chart_url}
                <a
                  class="mini-chart"
                  href={song.drum_chart_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open drum chart for ${song.title}`}
                  aria-label={`Open drum chart for ${song.title} in a new tab`}
                  on:click|stopPropagation
                >Chart</a>
              {/if}
              {#if song.x32_scene}<span class="scene">S{song.x32_scene}</span>{/if}
            </span>
          </li>
        {/each}
      </ul>
    </aside>

    <main class="stage">
      {#if currentSong}
        <section class="song-card">
          <div class="song-heading">
            <div>
              <div class="song-number">#{currentIdx + 1} of {songs.length}</div>
              <h1>{currentSong.title}</h1>
              <p class="artist">{currentSong.artist ?? ''}</p>
            </div>
            {#if currentSong.drum_chart_url}
              <a
                class="chart-button"
                href={currentSong.drum_chart_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open drum chart for ${currentSong.title} in a new tab`}
              >View Drum Chart ↗</a>
            {:else}
              <span class="chart-missing">No drum chart</span>
            {/if}
          </div>

          <div class="song-meta-grid">
            <div class="meta-cell"><span>Key</span><strong>{currentSong.key ?? '—'}</strong></div>
            <div class="meta-cell"><span>Click BPM</span><strong>{songBpm(currentSong)}</strong></div>
            <div class="meta-cell"><span>Feel</span><strong>{currentSong.feel ?? '—'}</strong></div>
            <div class="meta-cell"><span>Duration</span><strong>{fmtDuration(currentSong.duration_sec)}</strong></div>
            <div class="meta-cell"><span>X32 Scene</span><strong>{currentSong.x32_scene ?? '—'}</strong></div>
            <div class="meta-cell"><span>Count-in</span><strong>{currentSong.count_in ?? 4} beats</strong></div>
          </div>
          {#if currentSong.notes}<div class="notes">{currentSong.notes}</div>{/if}
          <div class="fx-row">
            <button on:click={saveFx} disabled={fxSaving}>{fxSaving ? 'Saving...' : fxSaved ? 'FX Saved' : 'Save FX Preset'}</button>
            <span>Saves track FX states for this song and loads them on the next cue.</span>
          </div>
        </section>
      {:else}
        <section class="song-card empty">No setlist loaded</section>
      {/if}

      <section class="transport">
        <div class="position">{transport.position} · {transport.bpm} BPM</div>
        <div class="controls">
          <button on:click={prev} disabled={currentIdx === 0}>Prev</button>
          <button class="stop" on:click={stop}>Stop</button>
          <button class="play" on:click={play} disabled={transport.playing}>Play</button>
          <button on:click={pause} disabled={!transport.playing}>Pause</button>
          <button class="record" on:click={record}>{recording ? 'Stop Rec' : 'Record'}</button>
          <button on:click={next} disabled={currentIdx >= songs.length - 1}>Next</button>
        </div>
        <button class="x32" on:click={recallX32} disabled={!currentSong?.x32_scene}>
          Recall X32 Scene {currentSong?.x32_scene ?? '—'}
        </button>
        {#if connecting}<span class="muted sending">Sending...</span>{/if}
      </section>

      <section class="neighbours">
        <button on:click={() => cueSong(currentIdx - 1)} disabled={!prevSong}>Previous: {prevSong?.title ?? '—'}</button>
        <button on:click={() => cueSong(currentIdx + 1)} disabled={!nextSong}>Next: {nextSong?.title ?? '—'}</button>
      </section>

      <section class="meter-strip">
        <div><h3>Channels 1-16</h3><div class="meters">{#each meters.ch as value, index}<div class="meter"><div style={`height:${Math.min(value * 120, 100)}%`}></div><span>{index + 1}</span></div>{/each}</div></div>
        <div><h3>Buses 1-8</h3><div class="meters">{#each meters.bus as value, index}<div class="meter bus"><div style={`height:${Math.min(value * 120, 100)}%`}></div><span>B{index + 1}</span></div>{/each}</div></div>
        <div><h3>Main L/R</h3><div class="meters">{#each ['L', 'R'] as side, index}<div class="meter main"><div style={`height:${Math.min((meters.lr[index] || 0) * 120, 100)}%`}></div><span>{side}</span></div>{/each}</div></div>
      </section>
    </main>
  </div>
{/if}

<style>
  .conn-bar{display:flex;align-items:center;gap:.6rem;padding:.5rem 1rem;background:#1f2937;border-bottom:1px solid #374151;font-size:.8rem}.dot{width:9px;height:9px;border-radius:50%;background:#6b7280}.ok .dot{background:#4ade80}.bad .dot{background:#f87171}.gear{margin-left:auto}.settings-panel{display:flex;gap:.75rem;align-items:end;padding:.75rem 1rem;background:#111827}.settings-panel label{flex:1}.layout{display:grid;grid-template-columns:310px 1fr;height:calc(100vh - 90px);overflow:hidden}.sidebar{background:#0d1117;border-right:1px solid #374151;display:flex;flex-direction:column;overflow:hidden}.sidebar-header{display:flex;gap:.5rem;padding:.75rem;border-bottom:1px solid #374151}.sidebar-header select{flex:1}.count{padding:.15rem .45rem;background:#1f2937;border-radius:999px;color:#9ca3af}.song-list{list-style:none;padding:0;margin:0;overflow-y:auto}.song-list li{display:flex;gap:.6rem;align-items:center;padding:.55rem .75rem;border-bottom:1px solid #1f2937;cursor:pointer}.song-list li:hover,.song-list li:focus-visible{background:#1f2937;outline:none}.song-list li.active{background:#1e1b4b;border-left:3px solid #7c3aed}.num{color:#6b7280;width:1.5rem;text-align:right}.info{flex:1;min-width:0}.title{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meta{display:block;color:#6b7280;font-size:.72rem}.song-actions{display:flex;align-items:center;gap:.35rem}.scene{color:#a78bfa;font-size:.72rem}.mini-chart{background:#3b0764;border:1px solid #7e22ce;color:#e9d5ff;border-radius:.3rem;padding:.22rem .4rem;font-size:.64rem;font-weight:800}.mini-chart:hover{background:#581c87;color:#fff}.stage{overflow-y:auto;padding:1.25rem}.song-card,.transport,.meter-strip{background:#111827;border:1px solid #374151;border-radius:.75rem;padding:1.25rem;margin-bottom:1rem}.song-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.song-card h1{font-size:2.4rem;margin:.25rem 0}.artist,.muted{color:#9ca3af}.song-number{color:#6b7280;font-size:.78rem}.chart-button{flex:0 0 auto;background:#5b21b6;border:1px solid #8b5cf6;color:#fff;border-radius:.55rem;padding:.7rem 1rem;font-size:.85rem;font-weight:800;box-shadow:0 0 0 3px rgba(139,92,246,.1)}.chart-button:hover{background:#6d28d9}.chart-button:focus-visible{outline:2px solid #c4b5fd;outline-offset:3px}.chart-missing{flex:0 0 auto;color:#6b7280;border:1px solid #374151;border-radius:.45rem;padding:.55rem .75rem;font-size:.75rem}.song-meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin:1rem 0}.meta-cell{background:#0d1117;border:1px solid #1f2937;border-radius:.5rem;padding:.7rem;display:flex;flex-direction:column}.meta-cell span{font-size:.7rem;text-transform:uppercase;color:#6b7280}.meta-cell strong{font-size:1.2rem}.notes{border-top:1px solid #1f2937;padding-top:.75rem;color:#9ca3af}.fx-row{display:flex;align-items:center;gap:.75rem;margin-top:.75rem}.fx-row span{font-size:.72rem;color:#6b7280}.transport{text-align:center}.position{color:#a78bfa;font-weight:700;margin-bottom:.75rem}.controls{display:flex;justify-content:center;gap:.6rem;flex-wrap:wrap}.play{background:#166534;color:#4ade80}.stop,.record{background:#7f1d1d;color:#fca5a5}.x32{margin-top:.75rem;background:#312e81;color:#a5b4fc}.sending{display:block;margin-top:.5rem}.neighbours{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1rem}.neighbours button{padding:.75rem}.meter-strip{display:flex;gap:1.25rem;overflow-x:auto}.meter-strip h3{font-size:.7rem;color:#6b7280;text-align:center}.meters{display:flex;align-items:end;gap:3px;height:85px}.meter{width:14px;height:72px;background:#0d1117;display:flex;flex-direction:column;justify-content:end;position:relative}.meter>div{background:#22c55e;min-height:1px}.meter.bus>div{background:#818cf8}.meter.main{width:22px}.meter.main>div{background:#a78bfa}.meter span{position:absolute;top:74px;width:100%;font-size:.55rem;color:#6b7280;text-align:center}.rec-indicator{position:fixed;top:0;left:50%;transform:translateX(-50%);background:#dc2626;color:#fff;padding:.25rem 1rem;z-index:200;font-weight:700}.empty{text-align:center}.ghost{background:transparent;border:1px solid #374151}@media(max-width:800px){.layout{grid-template-columns:1fr;height:auto}.sidebar{max-height:40vh;border-right:0;border-bottom:1px solid #374151}.stage{overflow:visible}.song-heading{flex-direction:column}.chart-button,.chart-missing{align-self:stretch;text-align:center}.song-meta-grid{grid-template-columns:repeat(2,1fr)}.song-card h1{font-size:1.75rem}}@media print{.conn-bar,.settings-panel,.sidebar,.transport,.neighbours,.meter-strip,.fx-row{display:none!important}.layout{display:block;height:auto}.stage{padding:0}.song-card{border:0}.chart-button,.chart-missing{display:none}}
</style>
