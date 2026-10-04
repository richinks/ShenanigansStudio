<script>
  import { onDestroy } from 'svelte';
  import { reaper, subscribeToReaper } from '$lib/reaper';
  import { x32, subscribeToX32 } from '$lib/x32';

  // ── REAPER state ──────────────────────────────────────────────────────────
  let reaperOnline  = $state(false);
  let rState        = $state(null);   // raw payload from Python /state

  const unsubReaper = subscribeToReaper((evt) => {
    if (evt.type === 'connected') { reaperOnline = evt.pythonOnline ?? false; }
    if (evt.type === 'state')     { rState = evt.payload; reaperOnline = true; }
    if (evt.type === 'error')     { reaperOnline = false; }
  });

  // ── X32 state ─────────────────────────────────────────────────────────────
  let x32Online = $state(false);
  let faders    = $state({});   // address → float 0-1
  let mutes     = $state({});   // address → 0|1

  const unsubX32 = subscribeToX32((evt) => {
    if (evt.connected !== undefined) { x32Online = true; return; }
    if (!evt.address) return;
    x32Online = true;
    if (evt.address.endsWith('/mix/fader')) faders[evt.address] = evt.args?.[0] ?? 0;
    if (evt.address.endsWith('/mix/on'))    mutes[evt.address]  = evt.args?.[0] ?? 1;
  });

  onDestroy(() => { unsubReaper(); unsubX32(); });

  // ── Transport actions ─────────────────────────────────────────────────────
  let busy = $state(false);
  async function cmd(fn) {
    if (busy) return;
    busy = true;
    try { await fn(); } catch (e) { console.error('[live]', e); } finally { busy = false; }
  }

  // ── Derived display ───────────────────────────────────────────────────────
  const transportLabel = $derived(
    !reaperOnline      ? 'OFFLINE' :
    rState?.recording  ? '⏺ REC'   :
    rState?.playing    ? '▶ PLAY'  :
    rState?.paused     ? '⏸ PAUSE' : '⏹ STOP'
  );

  function formatPos(sec) {
    if (sec == null) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function toDb(v) {
    if (v == null) return '---';
    if (v <= 0)   return '-∞';
    return (20 * Math.log10(v)).toFixed(1);
  }

  // Key faders shown on the live page — edit targets to match your X32 routing
  const KEY_FADERS = [
    { label: 'Main LR', fader: '/main/st/mix/fader', mute: null },
    { label: 'Vox DCA', fader: '/dca/1/fader',        mute: '/dca/1/on' },
    { label: 'Gtr DCA', fader: '/dca/2/fader',        mute: '/dca/2/on' },
    { label: 'Bass DCA',fader: '/dca/3/fader',        mute: '/dca/3/on' },
    { label: 'Drums DCA',fader:'/dca/4/fader',        mute: '/dca/4/on' },
  ];
</script>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="live-page">

  <!-- Status bar -->
  <div class="status-bar">
    <span class="dot" class:online={reaperOnline}></span>
    <span>REAPER</span>
    <span class="divider">|</span>
    <span class="dot" class:online={x32Online}></span>
    <span>X32</span>
  </div>

  <!-- Current song + transport state -->
  <div class="song-panel">
    <div class="song-name">{rState?.song ?? '—'}</div>
    <div class="transport-badge" class:playing={rState?.playing} class:recording={rState?.recording}>
      {transportLabel}
    </div>
    <div class="meta-row">
      <span>⏱ {formatPos(rState?.position)}</span>
      {#if rState?.bpm}
        <span>♩ {rState.bpm} BPM</span>
      {/if}
      {#if rState?.marker}
        <span>▸ {rState.marker}</span>
      {/if}
    </div>
  </div>

  <!-- Transport controls -->
  <div class="transport-controls">
    <button
      class="btn stop"
      disabled={busy || !reaperOnline}
      onclick={() => cmd(() => reaper.stop())}
    >⏹ Stop</button>

    <button
      class="btn play"
      disabled={busy || !reaperOnline}
      onclick={() => cmd(() => reaper.play())}
    >▶ Play</button>

    <button
      class="btn record"
      disabled={busy || !reaperOnline}
      onclick={() => cmd(() => reaper.record())}
    >⏺ Rec</button>
  </div>

  <!-- X32 fader readouts -->
  <div class="fader-panel">
    {#each KEY_FADERS as { label, fader: fAddr, mute: mAddr }}
      {@const val    = faders[fAddr]}
      {@const muted  = mAddr ? (mutes[mAddr] === 0) : false}
      {@const pct    = ((val ?? 0) * 100).toFixed(0)}
      <div class="fader-strip" class:muted>
        <div class="fader-label">{label}</div>
        <div class="fader-bar-wrap">
          <div class="fader-bar" style="width:{pct}%"></div>
        </div>
        <div class="fader-db">{toDb(val)} dB</div>
        {#if mAddr}
          <button
            class="mute-btn"
            class:active={!muted}
            onclick={() => x32.setMute(
              mAddr.replace('/mix/on','').replace('/on','').replace('/',''),
              muted   // toggle: if currently muted, turn on
            )}
          >{muted ? '🔇' : '🔊'}</button>
        {/if}
      </div>
    {/each}
  </div>

</div>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<style>
  :global(body) { background: #0d0d0d; color: #e8e8e8; font-family: system-ui, sans-serif; }

  .live-page {
    max-width: 700px;
    margin: 0 auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* Status bar */
  .status-bar {
    display: flex;
    align-items: center;
    gap: .5rem;
    font-size: .8rem;
    color: #888;
  }
  .dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #555;
    display: inline-block;
  }
  .dot.online { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
  .divider { color: #333; }

  /* Song panel */
  .song-panel {
    background: #1a1a1a;
    border-radius: 12px;
    padding: 1.5rem;
    text-align: center;
    border: 1px solid #2a2a2a;
  }
  .song-name {
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -.5px;
    margin-bottom: .5rem;
  }
  .transport-badge {
    display: inline-block;
    padding: .3rem .9rem;
    border-radius: 999px;
    font-size: .85rem;
    font-weight: 600;
    background: #2a2a2a;
    color: #888;
    margin-bottom: .75rem;
  }
  .transport-badge.playing   { background: #14532d; color: #4ade80; }
  .transport-badge.recording { background: #450a0a; color: #f87171; }
  .meta-row {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    font-size: .85rem;
    color: #aaa;
  }

  /* Transport controls */
  .transport-controls {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: .75rem;
  }
  .btn {
    padding: 1rem;
    border: none;
    border-radius: 10px;
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity .15s;
  }
  .btn:disabled { opacity: .35; cursor: not-allowed; }
  .btn.stop   { background: #292524; color: #fafaf9; }
  .btn.play   { background: #14532d; color: #bbf7d0; }
  .btn.record { background: #450a0a; color: #fecaca; }
  .btn:not(:disabled):hover { filter: brightness(1.15); }

  /* Fader panel */
  .fader-panel {
    display: flex;
    flex-direction: column;
    gap: .5rem;
  }
  .fader-strip {
    display: grid;
    grid-template-columns: 90px 1fr 70px 40px;
    align-items: center;
    gap: .5rem;
    background: #1a1a1a;
    border-radius: 8px;
    padding: .6rem .75rem;
    border: 1px solid #2a2a2a;
    transition: opacity .2s;
  }
  .fader-strip.muted { opacity: .4; }
  .fader-label { font-size: .85rem; font-weight: 600; color: #ccc; }
  .fader-bar-wrap {
    background: #2a2a2a;
    border-radius: 4px;
    height: 8px;
    overflow: hidden;
  }
  .fader-bar {
    height: 100%;
    background: linear-gradient(90deg, #22c55e, #86efac);
    border-radius: 4px;
    transition: width .2s;
  }
  .fader-db { font-size: .75rem; color: #888; text-align: right; font-variant-numeric: tabular-nums; }
  .mute-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    padding: 0;
    line-height: 1;
  }
</style>
