<script>
  import { onMount, onDestroy } from 'svelte';
  import { reaper, subscribeToReaper } from '$lib/reaper';
  import { x32, subscribeToX32 } from '$lib/x32';

  let reaperState = { playing: false, recording: false, song: '', bpm: 0, pos: 0 };
  let faders = [];
  let apiOnline = false;
  let x32Online = false;
  let unsubReaper;
  let unsubX32;

  onMount(() => {
    unsubReaper = subscribeToReaper(state => { reaperState = state; apiOnline = true; });
    unsubX32    = subscribeToX32(state    => { faders = state.faders ?? []; x32Online = true; });
  });
  onDestroy(() => { unsubReaper?.(); unsubX32?.(); });

  async function transport(action) { await reaper.transport(action); }
  async function setMute(target, on) { await x32.mute(target, on); }
  function dbLabel(v) { if (v === 0) return '-∞'; return (20 * Math.log10(v)).toFixed(1) + ' dB'; }

  $: transportLabel = reaperState.recording ? 'REC' : reaperState.playing ? 'PLAY' : 'STOP';
  $: transportClass = reaperState.recording ? 'recording' : reaperState.playing ? 'playing' : '';
</script>

<div class="live-page">

  <div class="status-bar">
    <div class="status-pill" class:online={apiOnline}>
      <span class="dot"></span> REAPER
    </div>
    <div class="status-pill" class:online={x32Online}>
      <span class="dot"></span> X32
    </div>
  </div>

  <div class="song-panel">
    <div class="now-playing">NOW PLAYING</div>
    <div class="song-name">{reaperState.song || 'No track loaded'}</div>
    <div class="transport-badge {transportClass}">{transportLabel}</div>
    <div class="meta-row">
      {#if reaperState.bpm}<span class="meta-item">♪ {reaperState.bpm} BPM</span>{/if}
      {#if reaperState.pos}<span class="meta-item">⏱ {reaperState.pos.toFixed(1)}s</span>{/if}
    </div>
  </div>

  <div class="transport-controls">
    <button class="btn stop"   on:click={() => transport('stop')}>⏹ Stop</button>
    <button class="btn play"   on:click={() => transport('play')}>▶ Play</button>
    <button class="btn record" on:click={() => transport('record')}>⏺ Rec</button>
  </div>

  {#if faders.length > 0}
    <div class="section-label">MIXER</div>
    <div class="fader-panel">
      {#each faders as f (f.target)}
        <div class="fader-strip" class:muted={f.muted}>
          <span class="fader-label">{f.label}</span>
          <div class="fader-bar-wrap">
            <div class="fader-bar" style="width:{(f.value*100).toFixed(1)}%"></div>
          </div>
          <span class="fader-db">{dbLabel(f.value)}</span>
          <button class="mute-btn" on:click={() => setMute(f.target, !f.muted)}>
            {f.muted ? 'M' : '•'}
          </button>
        </div>
      {/each}
    </div>
  {/if}

</div>

<style>
  .live-page { display: flex; flex-direction: column; gap: 1rem; }

  .status-bar { display: flex; gap: .5rem; }
  .status-pill {
    display: flex; align-items: center; gap: .4rem;
    padding: .3rem .75rem; border-radius: 999px; font-size: .75rem; font-weight: 700; letter-spacing: .04em;
    background: #111927; border: 1px solid #1e2d42; color: #8a9bb5;
    transition: all .3s;
  }
  .status-pill.online { border-color: #22c55e; color: #4ade80; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }

  .song-panel {
    background: #111927; border: 1px solid #1e2d42; border-radius: 14px;
    padding: 1.5rem; text-align: center;
  }
  .now-playing { font-size: .68rem; font-weight: 700; letter-spacing: .12em; color: #e07a1a; margin-bottom: .5rem; }
  .song-name { font-size: 1.8rem; font-weight: 700; color: #fff; letter-spacing: -.5px; margin-bottom: .75rem; }
  .transport-badge {
    display: inline-block; padding: .3rem 1rem; border-radius: 999px;
    font-size: .8rem; font-weight: 700; letter-spacing: .08em;
    background: #1e2d42; color: #8a9bb5; margin-bottom: .75rem;
  }
  .transport-badge.playing   { background: rgba(34,197,94,.15); color: #4ade80; border: 1px solid rgba(34,197,94,.3); }
  .transport-badge.recording { background: rgba(239,68,68,.15); color: #f87171; border: 1px solid rgba(239,68,68,.3); }
  .meta-row { display: flex; justify-content: center; gap: 1.5rem; }
  .meta-item { font-size: .82rem; color: #8a9bb5; }

  .transport-controls { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: .75rem; }
  .btn {
    padding: .9rem; border: 1px solid #1e2d42; border-radius: 10px;
    font-size: 1rem; font-weight: 700; cursor: pointer; transition: all .15s;
    background: #111927; color: #8a9bb5;
  }
  .btn:hover { border-color: #2e4060; color: #fff; }
  .btn.stop:hover   { border-color: #6b7280; color: #fff; }
  .btn.play         { border-color: rgba(34,197,94,.4); color: #4ade80; }
  .btn.play:hover   { background: rgba(34,197,94,.1); }
  .btn.record       { border-color: rgba(239,68,68,.4); color: #f87171; }
  .btn.record:hover { background: rgba(239,68,68,.1); }

  .section-label {
    font-size: .68rem; font-weight: 700; letter-spacing: .12em; color: #8a9bb5;
    padding: 0 .25rem;
  }

  .fader-panel { display: flex; flex-direction: column; gap: .35rem; }
  .fader-strip {
    display: grid; grid-template-columns: 80px 1fr 64px 32px;
    align-items: center; gap: .5rem;
    background: #111927; border: 1px solid #1e2d42; border-radius: 8px;
    padding: .55rem .75rem; transition: opacity .2s;
  }
  .fader-strip.muted { opacity: .35; }
  .fader-label { font-size: .8rem; font-weight: 600; color: #c8d6e8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fader-bar-wrap { background: #1e2d42; border-radius: 4px; height: 6px; overflow: hidden; }
  .fader-bar { height: 100%; background: linear-gradient(90deg,#e07a1a,#f5a623); border-radius: 4px; transition: width .2s; }
  .fader-db { font-size: .72rem; color: #8a9bb5; text-align: right; font-variant-numeric: tabular-nums; }
  .mute-btn {
    background: #1e2d42; border: none; border-radius: 5px; color: #8a9bb5;
    font-size: .75rem; font-weight: 700; cursor: pointer; width: 28px; height: 22px;
    display: flex; align-items: center; justify-content: center; transition: all .15s;
  }
  .fader-strip.muted .mute-btn { background: #e07a1a; color: #fff; }
</style>