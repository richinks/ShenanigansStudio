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

  function dbLabel(v) {
    if (v === 0) return '-∞';
    return (20 * Math.log10(v)).toFixed(1) + ' dB';
  }

  $: transportLabel = reaperState.recording ? 'REC' : reaperState.playing ? 'PLAY' : 'STOP';
  $: transportClass = reaperState.recording ? 'recording' : reaperState.playing ? 'playing' : '';
</script>

<div class="live-page">
  <div class="status-bar">
    <span class="dot" class:online={apiOnline}></span><span>REAPER</span>
    <span class="divider">|</span>
    <span class="dot" class:online={x32Online}></span><span>X32</span>
  </div>

  <div class="song-panel">
    <div class="song-name">{reaperState.song || '—'}</div>
    <div class="transport-badge {transportClass}">{transportLabel}</div>
    <div class="meta-row">
      {#if reaperState.bpm}<span>♩ {reaperState.bpm} BPM</span>{/if}
      {#if reaperState.pos}<span>⏱ {reaperState.pos.toFixed(1)}s</span>{/if}
    </div>
  </div>

  <div class="transport-controls">
    <button class="btn stop"   on:click={() => transport('stop')}>⏹ Stop</button>
    <button class="btn play"   on:click={() => transport('play')}>▶ Play</button>
    <button class="btn record" on:click={() => transport('record')}>⏺ Rec</button>
  </div>

  <div class="fader-panel">
    {#each faders as f (f.target)}
      <div class="fader-strip" class:muted={f.muted}>
        <span class="fader-label">{f.label}</span>
        <div class="fader-bar-wrap">
          <div class="fader-bar" style="width:{(f.value*100).toFixed(1)}%"></div>
        </div>
        <span class="fader-db">{dbLabel(f.value)}</span>
        <button class="mute-btn" on:click={() => setMute(f.target, !f.muted)}>
          {f.muted ? '🔇' : '🔊'}
        </button>
      </div>
    {/each}
  </div>
</div>

<style>
  .live-page { display: flex; flex-direction: column; gap: 1rem; }
  .status-bar { display: flex; align-items: center; gap: .5rem; font-size: .8rem; color: #888; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #555; display: inline-block; }
  .dot.online { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
  .divider { color: #333; }
  .song-panel { background: #1a1a1a; border-radius: 12px; padding: 1.5rem; text-align: center; border: 1px solid #2a2a2a; }
  .song-name { font-size: 2rem; font-weight: 700; letter-spacing: -.5px; margin-bottom: .5rem; }
  .transport-badge { display: inline-block; padding: .3rem .9rem; border-radius: 999px; font-size: .85rem; font-weight: 600; background: #2a2a2a; color: #888; margin-bottom: .75rem; }
  .transport-badge.playing   { background: #14532d; color: #4ade80; }
  .transport-badge.recording { background: #450a0a; color: #f87171; }
  .meta-row { display: flex; justify-content: center; gap: 1.5rem; font-size: .85rem; color: #aaa; }
  .transport-controls { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: .75rem; }
  .btn { padding: 1rem; border: none; border-radius: 10px; font-size: 1.1rem; font-weight: 700; cursor: pointer; transition: opacity .15s; }
  .btn:disabled { opacity: .35; cursor: not-allowed; }
  .btn.stop   { background: #292524; color: #fafaf9; }
  .btn.play   { background: #14532d; color: #bbf7d0; }
  .btn.record { background: #450a0a; color: #fecaca; }
  .btn:not(:disabled):hover { filter: brightness(1.15); }
  .fader-panel { display: flex; flex-direction: column; gap: .5rem; }
  .fader-strip { display: grid; grid-template-columns: 90px 1fr 70px 40px; align-items: center; gap: .5rem; background: #1a1a1a; border-radius: 8px; padding: .6rem .75rem; border: 1px solid #2a2a2a; transition: opacity .2s; }
  .fader-strip.muted { opacity: .4; }
  .fader-label { font-size: .85rem; font-weight: 600; color: #ccc; }
  .fader-bar-wrap { background: #2a2a2a; border-radius: 4px; height: 8px; overflow: hidden; }
  .fader-bar { height: 100%; background: linear-gradient(90deg,#22c55e,#86efac); border-radius: 4px; transition: width .2s; }
  .fader-db { font-size: .75rem; color: #888; text-align: right; font-variant-numeric: tabular-nums; }
  .mute-btn { background: none; border: none; cursor: pointer; font-size: 1rem; padding: 0; line-height: 1; }
</style>
