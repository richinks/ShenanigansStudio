<script>
  import { onMount } from 'svelte'
  import { supabase } from '#lib/supabase'
  import { page } from '$app/stores'

  let setlists = [], selectedId = '', songs = [], setlist = null, loading = true, error = ''

  onMount(async () => {
    const { data, error: e } = await supabase
      .from('setlists')
      .select('*, setlist_songs(position, songs(*))')
      .order('name')
    if (e) { error = e.message; loading = false; return }
    setlists = data || []
    const qid = $page.url.searchParams.get('id')
    if (qid) select(qid)
    else if (setlists.length > 0) select(setlists[0].id)
    loading = false
  })

  function select(id) {
    selectedId = id
    setlist = setlists.find(function(s){ return s.id === id }) || null
    songs = (setlist && setlist.setlist_songs ? setlist.setlist_songs : [])
      .sort(function(a,b){ return a.position - b.position })
      .map(function(ss){ return ss.songs }).filter(Boolean)
  }

  function fmtDuration(sec) {
    if (!sec) return ''
    return Math.floor(sec/60) + ':' + String(sec%60).padStart(2,'0')
  }

  function totalRuntime() {
    var t = songs.reduce(function(s, song){ return s + (song.duration_sec || 0) }, 0)
    return fmtDuration(t)
  }

  function doPrint(){ window.print() }
</script>

<svelte:head><title>{setlist ? setlist.name : 'Setlist'} - Dirty Diaperz</title></svelte:head>

<div class="screen-controls no-print">
  <div class="ctrl-row">
    <select bind:value={selectedId} on:change={function(e){ select(e.target.value) }}>
      {#each setlists as sl}<option value={sl.id}>{sl.name}</option>{/each}
    </select>
    <button on:click={doPrint} class="print-btn">Print / Save PDF</button>
    <a href="/live" class="back">Back to Live Mode</a>
  </div>
  <p class="hint">Print dialog - choose Save as PDF for a portable gig sheet</p>
</div>

{#if loading}
  <p class="loading">Loading...</p>
{:else if error}
  <p class="err">{error}</p>
{:else if setlist}
  <div class="sheet">
    <header class="sheet-header">
      <div class="band">Dirty Diaperz</div>
      <h1 class="setlist-name">{setlist.name}</h1>
      <div class="meta-row">
        {#if setlist.gig_date}<span>{new Date(setlist.gig_date).toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span>{/if}
        <span>{songs.length} songs</span>
        {#if totalRuntime()}<span>~{totalRuntime()} total</span>{/if}
      </div>
      {#if setlist.notes}<p class="setlist-notes">{setlist.notes}</p>{/if}
    </header>

    <table class="song-table">
      <thead>
        <tr>
          <th class="col-num">#</th>
          <th class="col-title">Song</th>
          <th class="col-artist">Artist</th>
          <th class="col-key">Key</th>
          <th class="col-bpm">BPM</th>
          <th class="col-feel">Feel</th>
          <th class="col-dur">Time</th>
          <th class="col-notes">Notes</th>
        </tr>
      </thead>
      <tbody>
        {#each songs as song, i}
          <tr>
            <td class="col-num">{i + 1}</td>
            <td class="col-title"><strong>{song.title}</strong></td>
            <td class="col-artist">{song.artist || ''}</td>
            <td class="col-key">{song.key || ''}</td>
            <td class="col-bpm">{song.click_bpm || ''}</td>
            <td class="col-feel">{song.feel || ''}</td>
            <td class="col-dur">{fmtDuration(song.duration_sec)}</td>
            <td class="col-notes">{song.notes || ''}</td>
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="6">Total runtime</td>
          <td>{totalRuntime()}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    <footer class="sheet-footer">
      <span>ShenanigansStudio</span>
      <span>Printed {new Date().toLocaleDateString()}</span>
      <span>Confidential - band use only</span>
    </footer>
  </div>
{/if}

<style>
  :global(body){margin:0;font-family:system-ui,sans-serif;background:#f9fafb;color:#111}
  .screen-controls{background:#1f2937;color:#fff;padding:1rem;display:flex;flex-direction:column;gap:.5rem}
  .ctrl-row{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}
  .ctrl-row select{font-size:.9rem;padding:.4rem .6rem;border-radius:.4rem}
  .print-btn{background:#7c3aed;color:#fff;border:none;border-radius:.4rem;padding:.5rem 1.25rem;font-size:.9rem;cursor:pointer}
  .print-btn:hover{background:#6d28d9}
  .back{color:#a78bfa;font-size:.85rem;text-decoration:none}
  .hint{margin:0;font-size:.75rem;color:#9ca3af}
  .loading,.err{padding:2rem;text-align:center;color:#6b7280}
  .sheet{max-width:1000px;margin:1.5rem auto;background:#fff;padding:2rem;border-radius:.5rem;box-shadow:0 1px 4px rgba(0,0,0,.1)}
  .sheet-header{border-bottom:3px solid #111;padding-bottom:1rem;margin-bottom:1.5rem}
  .band{font-size:.9rem;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:#6b7280}
  .setlist-name{font-size:2rem;font-weight:900;margin:.25rem 0}
  .meta-row{display:flex;gap:1.5rem;font-size:.85rem;color:#4b5563;margin:.5rem 0;flex-wrap:wrap}
  .setlist-notes{font-size:.85rem;color:#6b7280;margin:.5rem 0 0}
  .song-table{width:100%;border-collapse:collapse;font-size:.85rem}
  .song-table th{background:#111;color:#fff;padding:.5rem .6rem;text-align:left;font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em}
  .song-table td{padding:.45rem .6rem;border-bottom:1px solid #e5e7eb;vertical-align:top}
  .song-table tr:nth-child(even) td{background:#f9fafb}
  .col-num{width:2rem;text-align:center;color:#6b7280}
  .col-title{min-width:160px}
  .col-artist{min-width:130px}
  .col-key{width:60px}
  .col-bpm{width:50px}
  .col-feel{min-width:120px;font-size:.78rem;color:#6b7280}
  .col-dur{width:50px}
  .col-notes{font-size:.75rem;color:#6b7280;max-width:200px}
  .total-row td{border-top:2px solid #111;font-weight:700;padding-top:.5rem}
  .sheet-footer{margin-top:1.5rem;padding-top:.75rem;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:.75rem;color:#9ca3af}
  @media print {
    @page { margin:1.5cm; size:A4 landscape }
    :global(body){ background:#fff }
    .no-print{ display:none !important }
    .sheet{ box-shadow:none; margin:0; padding:0; border-radius:0 }
    .song-table th{ background:#000 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact }
    .song-table tr:nth-child(even) td{ background:#f5f5f5 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact }
  }
</style>
