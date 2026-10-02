<script>
  import { onMount, onDestroy } from 'svelte'
  import { supabase } from '#lib/supabase'

  let apiBase = '', showSettings = false, apiInput = ''
  let setlists = [], activeSetlist = null, songs = []
  let currentIdx = 0
  let transport = { playing: false, paused: false, position: '0:00', bpm: '—' }
  let connected = false, connecting = false, apiErr = ''
  let pollTimer = null, loading = true`n  let recording = false

  $: currentSong = songs[currentIdx] ?? null
  $: prevSong    = songs[currentIdx - 1] ?? null
  $: nextSong    = songs[currentIdx + 1] ?? null

  onMount(async () => {
    apiBase  = localStorage.getItem('showApiBase') || 'http://localhost:5000'
    apiInput = apiBase
    await loadSetlists()
    startPoll()
    loading = false
  })
  onDestroy(() => clearInterval(pollTimer))

  function startPoll() {
    clearInterval(pollTimer)
    pollTimer = setInterval(pollStatus, 2000)
  }

  async function pollStatus() {
    try {
      const r = await fetch(${apiBase}/status, { signal: AbortSignal.timeout(1500) })
      if (!r.ok) throw new Error(r.statusText)
      const d = await r.json()
      transport = { playing: d.playing, paused: d.paused, position: d.position, bpm: d.bpm ?? '—' }
      connected = true; apiErr = ''
    } catch (e) { connected = false; apiErr = e.message ?? 'Unreachable' }
  }

  async function loadSetlists() {
    const { data } = await supabase
      .from('setlists')
      .select('*, setlist_songs(position, songs(*))')
      .order('name')
    setlists = data ?? []
    if (setlists.length > 0 && !activeSetlist) selectSetlist(setlists[0])
  }

  function selectSetlist(sl) {
    activeSetlist = sl
    songs = (sl.setlist_songs ?? [])
      .sort((a, b) => a.position - b.position)
      .map(ss => ss.songs).filter(Boolean)
    currentIdx = 0
  }

  async function api(path, method = 'POST', body = null) {
    connecting = true
    try {
      const opts = { method, signal: AbortSignal.timeout(3000) }
      if (body) { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body) }
      const r = await fetch(${apiBase}, opts)
      const d = await r.json()
      connected = true; apiErr = ''; return d
    } catch (e) { connected = false; apiErr = e.message; return null }
    finally { connecting = false }
  }

  async function cueSong(idx) {
    currentIdx = idx
    const song = songs[idx]
    if (!song) return
    await api('/song/cue', 'POST', {
      song_id: song.id, title: song.title,
      click_bpm: song.click_bpm, x32_scene: song.x32_scene
    })
  }


  async function saveFx() {
    if (!currentSong) return
    fxSaving = true; fxSaved = false
    const d = await api('/song/fx/save', 'POST', { title: currentSong.title })
    fxSaving = false
    if (d?.ok) { fxSaved = true; setTimeout(() => fxSaved = false, 3000) }
    else alert('FX save failed — is the Show API running?')
  }
  const play      = () => api('/transport/play')
  const pause     = () => api('/transport/pause')
  const stop      = () => api('/transport/stop')
  const prev      = () => currentIdx > 0              && cueSong(currentIdx - 1)
  const next      = () => currentIdx < songs.length-1 && cueSong(currentIdx + 1)
  const recallX32 = () => currentSong?.x32_scene && api(/x32/scene/)
  const record = async () => { recording = !recording; await api(recording ? '/transport/record' : '/transport/stop') }

  function saveApiBase() {
    apiBase = apiInput.trim().replace(/\/$/, '')
    localStorage.setItem('showApiBase', apiBase)
    showSettings = false; pollStatus(); startPoll()
  }

  function fmtDuration(sec) {
    if (!sec) return '—'
    return ${Math.floor(sec/60)}:
  }
</script>

{#if recording}<div class="rec-indicator">⏺ RECORDING</div>{/if}`n<div class="conn-bar" class:ok={connected} class:bad={!connected}>
  <span class="dot"></span>
  {connected ? Show API connected —  : Show API offline — }
  <button class="gear" on:click={() => { showSettings = !showSettings; apiInput = apiBase }}>⚙</button>
</div>

{#if showSettings}
  <div class="settings-panel">
    <label>Show PC API URL (local network)
      <input bind:value={apiInput} placeholder="http://192.168.1.x:5000" />
    </label>
    <div class="row gap">
      <button on:click={saveApiBase}>Save & Connect</button>
      <button class="ghost" on:click={() => showSettings = false}>Cancel</button>
    </div>
  </div>
{/if}

<div class="layout">
  <aside class="sidebar">
    <div class="sidebar-header">
      <select on:change={e => selectSetlist(setlists.find(s => s.id === e.target.value))}>
        {#each setlists as sl}<option value={sl.id}>{sl.name}</option>{/each}
      </select>
      <span class="count">{songs.length}</span>
    </div>
    <ul class="song-list">
      {#each songs as song, i}
        <li class:active={i === currentIdx} on:click={() => cueSong(i)}>
          <span class="num">{i + 1}</span>
          <span class="info">
            <span class="t">{song.title}</span>
            <span class="meta">{song.key ?? '?'} · {song.click_bpm ?? '?'} BPM</span>
          </span>
          {#if song.x32_scene}<span class="scene">S{song.x32_scene}</span>{/if}
        </li>
      {/each}
    </ul>
  </aside>

  <main class="stage">
    {#if currentSong}
      <div class="song-card">
        <div class="song-number">#{currentIdx + 1} of {songs.length}</div>
        <h1 class="song-title">{currentSong.title}</h1>
        <p class="song-artist">{currentSong.artist ?? ''}</p>
        <div class="song-meta-grid">
          <div class="meta-cell"><span class="label">Key</span><span class="value">{currentSong.key ?? '—'}</span></div>
          <div class="meta-cell"><span class="label">Click BPM</span><span class="value">{currentSong.click_bpm ?? '—'}</span></div>
          <div class="meta-cell"><span class="label">Feel</span><span class="value">{currentSong.feel ?? '—'}</span></div>
          <div class="meta-cell"><span class="label">Duration</span><span class="value">{fmtDuration(currentSong.duration_sec)}</span></div>
          <div class="meta-cell"><span class="label">X32 Scene</span><span class="value">{currentSong.x32_scene ?? '—'}</span></div>
          <div class="meta-cell"><span class="label">Count-in</span><span class="value">{currentSong.count_in ?? 4} beats</span></div>
        </div>
        {#if currentSong.notes}<div class="notes">{currentSong.notes}</div>{/if}
        <div class="fx-row">
          <button class="save-fx-btn" on:click={saveFx} disabled={fxSaving || !currentSong}>
            {fxSaving ? 'Saving…' : fxSaved ? '✅ FX Saved!' : '💾 Save FX Preset'}
          </button>
          <span class="fx-hint">Saves all track FX states for this song — auto-loaded on next cue</span>
        </div>
      </div>
    {:else}
      <div class="song-card empty"><p class="muted">No setlist loaded</p></div>
    {/if}

    <div class="transport">
      <div class="pos">{transport.position} · {transport.bpm} BPM</div>
      <div class="controls">
        <button class="nav" on:click={prev} disabled={currentIdx === 0 || !songs.length}>⏮</button>
        <button class="ctrl stop" on:click={stop}>⏹</button>
        <button class="ctrl play" on:click={play} disabled={transport.playing}>▶</button>
        <button class="ctrl"      on:click={pause} disabled={!transport.playing}>⏸</button>
        <button class="ctrl rec" on:click={record} title={recording ? "Stop recording" : "Record"}>
        {recording ? '⏹' : '⏺'}
      </button>
      <button class="nav" on:click={next} disabled={currentIdx >= songs.length-1 || !songs.length}>⏭</button>
      </div>
      <div class="x32-row">
        <button class="x32-btn" on:click={recallX32} disabled={!currentSong?.x32_scene}>
          🎚 Recall X32 Scene {currentSong?.x32_scene ?? '—'}
        </button>
        {#if connecting}<span class="muted small">sending…</span>{/if}
      </div>
    </div>

    <div class="neighbours">
      {#if prevSong}
        <div class="neighbour prev" on:click={() => cueSong(currentIdx - 1)}>
          <span class="dir">← PREV</span>
          <span class="nt">{prevSong.title}</span>
          <span class="nm">{prevSong.key ?? '?'} · {prevSong.click_bpm ?? '?'} BPM</span>
        </div>
      {:else}<div class="neighbour ghost"></div>{/if}
      {#if nextSong}
        <div class="neighbour next" on:click={() => cueSong(currentIdx + 1)}>
          <span class="dir">NEXT →</span>
          <span class="nt">{nextSong.title}</span>
          <span class="nm">{nextSong.key ?? '?'} · {nextSong.click_bpm ?? '?'} BPM</span>
        </div>
      {:else}<div class="neighbour ghost"></div>{/if}
    </div>
  </main>
</div>

<style>
  .conn-bar{display:flex;align-items:center;gap:.5rem;padding:.4rem 1rem;font-size:.8rem;background:#1f2937;border-bottom:1px solid #374151}
  .conn-bar.ok .dot{background:#4ade80}.conn-bar.bad .dot{background:#f87171}
  .dot{width:8px;height:8px;border-radius:50%;background:#6b7280;flex-shrink:0}
  .gear{margin-left:auto;background:transparent;border:none;color:#6b7280;cursor:pointer;font-size:1.1rem}
  .gear:hover{color:#fff}
  .settings-panel{background:#111827;border-bottom:1px solid #374151;padding:.75rem 1rem;display:flex;align-items:flex-end;gap:.75rem;flex-wrap:wrap}
  .settings-panel label{flex:1;min-width:200px;font-size:.85rem;color:#9ca3af}
  .layout{display:grid;grid-template-columns:280px 1fr;height:calc(100vh - 90px);overflow:hidden}
  .sidebar{background:#0d1117;border-right:1px solid #374151;display:flex;flex-direction:column;overflow:hidden}
  .sidebar-header{display:flex;align-items:center;gap:.5rem;padding:.75rem;border-bottom:1px solid #374151}
  .sidebar-header select{flex:1;font-size:.85rem}
  .count{background:#1f2937;color:#6b7280;font-size:.75rem;padding:.1rem .4rem;border-radius:999px}
  .song-list{list-style:none;margin:0;padding:0;overflow-y:auto;flex:1}
  .song-list li{display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;border-bottom:1px solid #1f2937;cursor:pointer;transition:background .1s}
  .song-list li:hover{background:#1f2937}
  .song-list li.active{background:#1e1b4b;border-left:3px solid #7c3aed}
  .num{color:#6b7280;font-size:.75rem;min-width:1.4rem;text-align:right}
  .info{flex:1;min-width:0}
  .t{display:block;font-size:.875rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .meta{display:block;font-size:.7rem;color:#6b7280;margin-top:.1rem}
  .scene{font-size:.7rem;color:#a78bfa;background:#1e1b4b;padding:.1rem .35rem;border-radius:.25rem;flex-shrink:0}
  .stage{display:flex;flex-direction:column;overflow-y:auto;padding:1.25rem}
  .song-card{background:#111827;border:1px solid #374151;border-radius:.75rem;padding:1.5rem;margin-bottom:1rem;flex-shrink:0}
  .song-card.empty{display:flex;align-items:center;justify-content:center;min-height:180px}
  .song-number{font-size:.75rem;color:#6b7280;margin-bottom:.25rem}
  .song-title{font-size:2.5rem;font-weight:800;line-height:1.1;color:#f1f5f9;margin:0 0 .25rem}
  .song-artist{font-size:1rem;color:#9ca3af;margin:0 0 1.25rem}
  .song-meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1rem}
  .meta-cell{background:#0d1117;border:1px solid #1f2937;border-radius:.5rem;padding:.6rem .75rem;display:flex;flex-direction:column;gap:.2rem}
  .label{font-size:.7rem;color:#6b7280;text-transform:uppercase;letter-spacing:.05em}
  .value{font-size:1.25rem;font-weight:700;color:#e2e8f0}
  .notes{font-size:.8rem;color:#6b7280;border-top:1px solid #1f2937;padding-top:.75rem;line-height:1.5}
  .transport{background:#111827;border:1px solid #374151;border-radius:.75rem;padding:1.25rem;display:flex;flex-direction:column;align-items:center;gap:.75rem;margin-bottom:1rem;flex-shrink:0}
  .pos{font-size:.875rem;color:#a78bfa;font-weight:600;letter-spacing:.05em}
  .controls{display:flex;align-items:center;gap:.75rem}
  .ctrl{width:3.5rem;height:3.5rem;border-radius:.5rem;font-size:1.25rem;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .ctrl.play{background:#166534;color:#4ade80;border-color:#15803d}.ctrl.play:hover:not(:disabled){background:#15803d}
  .ctrl.stop{background:#7f1d1d;color:#fca5a5;border-color:#991b1b}.ctrl.stop:hover{background:#991b1b}
  .nav{width:2.75rem;height:2.75rem;font-size:1rem;border-radius:.5rem;background:#1f2937;border-color:#374151}
  .nav:hover:not(:disabled){background:#374151}
  .x32-row{display:flex;align-items:center;gap:.75rem}
  .x32-btn{background:#312e81;color:#a5b4fc;border:1px solid #4338ca;border-radius:.5rem;padding:.6rem 1.25rem;font-size:.9rem;cursor:pointer;transition:background .15s}
  .x32-btn:hover:not(:disabled){background:#4338ca}.x32-btn:disabled{opacity:.4;cursor:default}
  .neighbours{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;flex-shrink:0}
  .neighbour{background:#0d1117;border:1px solid #1f2937;border-radius:.5rem;padding:.75rem 1rem;cursor:pointer;transition:background .15s}
  .neighbour:hover{background:#1f2937}.neighbour.ghost{border-color:transparent;cursor:default}
  .neighbour.next{text-align:right}
  .dir{display:block;font-size:.65rem;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem}
  .nt{display:block;font-size:.9rem;font-weight:600;color:#e2e8f0}
  .nm{display:block;font-size:.7rem;color:#6b7280;margin-top:.15rem}
  .row{display:flex}.gap{gap:.75rem}.muted{color:#6b7280}.small{font-size:.75rem}
  @media(max-width:640px){
    .layout{grid-template-columns:1fr}.sidebar{display:none}
    .song-title{font-size:1.75rem}.song-meta-grid{grid-template-columns:repeat(2,1fr)}
  }

  .ctrl.rec{background:#7f1d1d;color:#fca5a5;border-color:#991b1b}
  .ctrl.rec:hover{background:#991b1b}
  .rec-indicator{
    position:fixed;top:0;left:50%;transform:translateX(-50%);
    background:#dc2626;color:white;font-size:.75rem;font-weight:700;
    letter-spacing:.1em;padding:.25rem 1rem;border-radius:0 0 .5rem .5rem;
    animation:blink 1s ease-in-out infinite;z-index:200;
  }
  @keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}

  .fx-row{display:flex;align-items:center;gap:.75rem;margin-top:.75rem;padding-top:.75rem;border-top:1px solid #1f2937;flex-wrap:wrap}
  .save-fx-btn{background:#1e3a5f;color:#93c5fd;border:1px solid #1d4ed8;border-radius:.5rem;padding:.5rem 1rem;font-size:.85rem;cursor:pointer;transition:background .15s;white-space:nowrap}
  .save-fx-btn:hover:not(:disabled){background:#1d4ed8}
  .save-fx-btn:disabled{opacity:.5;cursor:default}
  .fx-hint{font-size:.7rem;color:#4b5563;flex:1}
</style>


