<script>
  import { onMount } from 'svelte'
  import { supabase } from '#lib/supabase'

  let counts = {}
  let loading = true
  let presenceChannel

  const cards = [
    { label: 'Songs', key: 'total', color: '#f8fafc', accent: '#64748b', href: '/songs', icon: '♪' },
    { label: 'Active', key: 'active', color: '#4ade80', accent: '#166534', href: '/songs', icon: '●' },
    { label: 'WIP', key: 'wip', color: '#facc15', accent: '#854d0e', href: '/songs', icon: '◐' },
    { label: 'Setlists', key: 'setlists', color: '#fb923c', accent: '#9a3412', href: '/setlists', icon: '≡' },
    { label: 'Drum Charts', key: 'charts', color: '#c084fc', accent: '#7e22ce', href: '/songs', icon: '♫' },
    { label: 'Online Now', key: 'online', color: '#22d3ee', accent: '#0e7490', href: '/', icon: '●' }
  ]

  onMount(async () => {
    const [total, active, wip, setlists, charts, sessionResult] = await Promise.all([
      supabase.from('songs').select('*', { count: 'exact', head: true }),
      supabase.from('songs').select('*', { count: 'exact', head: true }).eq('status', 'Active'),
      supabase.from('songs').select('*', { count: 'exact', head: true }).eq('status', 'WIP'),
      supabase.from('setlists').select('*', { count: 'exact', head: true }),
      supabase.from('songs').select('*', { count: 'exact', head: true }).not('drum_chart_url', 'is', null),
      supabase.auth.getSession()
    ])

    counts = {
      total: total.count ?? 0,
      active: active.count ?? 0,
      wip: wip.count ?? 0,
      setlists: setlists.count ?? 0,
      charts: charts.count ?? 0,
      online: 0
    }

    loading = false

    const user = sessionResult.data.session?.user
    if (!user) return

    presenceChannel = supabase.channel('shenanigans-online', {
      config: {
        presence: { key: user.id }
      }
    })

    function updateOnlineCount() {
      const state = presenceChannel.presenceState()
      counts = { ...counts, online: Object.keys(state).length }
    }

    presenceChannel
      .on('presence', { event: 'sync' }, updateOnlineCount)
      .on('presence', { event: 'join' }, updateOnlineCount)
      .on('presence', { event: 'leave' }, updateOnlineCount)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: user.id,
            online_at: new Date().toISOString()
          })
        }
      })

    return () => {
      if (presenceChannel) supabase.removeChannel(presenceChannel)
    }
  })
</script>

<svelte:head>
  <title>Dashboard - ShenanigansStudio</title>
</svelte:head>

<section class="hero">
  <div>
    <p class="eyebrow">Dirty Diaperz</p>
    <h1>Dashboard</h1>
    <p class="subtitle">Song library, charts, setlists, and live band activity at a glance.</p>
  </div>
  <div class="live-pill"><span class="pulse"></span> Studio online</div>
</section>

<div class="grid">
  {#each cards as card}
    <a class="card" href={card.href} style={`--accent:${card.accent}`}>
      <div class="topline">
        <span class="icon" style={`color:${card.color}`}>{card.icon}</span>
        {#if card.key === 'online'}<span class="status-dot"></span>{/if}
      </div>
      <div class="val" style={`color:${card.color}`}>{loading ? '…' : counts[card.key] ?? 0}</div>
      <div class="lbl">{card.label}</div>
      {#if card.key === 'charts' && counts.total}
        <div class="detail">{Math.round((counts.charts / counts.total) * 100)}% of library</div>
      {:else if card.key === 'online'}
        <div class="detail">connected now</div>
      {/if}
    </a>
  {/each}
</div>

<section class="quick">
  <div class="section-title">Quick access</div>
  <div class="actions">
    <a href="/songs" class="action"><span>♪</span><div><strong>Song Bible</strong><small>Browse songs and drum charts</small></div><b>›</b></a>
    <a href="/setlists" class="action"><span>≡</span><div><strong>Setlists</strong><small>Build and manage show order</small></div><b>›</b></a>
    <a href="/live" class="action"><span>▶</span><div><strong>Live Mode</strong><small>Run the current set on stage</small></div><b>›</b></a>
  </div>
</section>

<style>
  .hero{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.15rem}.eyebrow{font-size:.68rem;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:#e8851a;margin:0 0 .2rem}h1{font-size:1.65rem;line-height:1.1;margin:0}.subtitle{color:#64748b;font-size:.8rem;margin-top:.35rem}.live-pill{display:flex;align-items:center;gap:.4rem;background:#071a19;border:1px solid #124e4a;color:#67e8f9;border-radius:999px;padding:.35rem .65rem;font-size:.7rem;font-weight:700}.pulse,.status-dot{width:.45rem;height:.45rem;border-radius:50%;background:#22d3ee;box-shadow:0 0 0 3px rgba(34,211,238,.12)}.grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:.65rem;margin-bottom:1.35rem}.card{position:relative;min-height:112px;background:linear-gradient(145deg,#0f172a,#0a1020);border:1px solid #1e293b;border-radius:.65rem;padding:.75rem .8rem;display:flex;flex-direction:column;box-shadow:inset 0 1px 0 rgba(255,255,255,.025);overflow:hidden}.card::after{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--accent);opacity:.75}.card:hover{border-color:#475569;transform:translateY(-1px)}.topline{height:1.1rem;display:flex;justify-content:space-between;align-items:center}.icon{font-size:.85rem;font-weight:900;opacity:.9}.val{font-size:1.8rem;line-height:1;font-weight:800;margin-top:.55rem;letter-spacing:-.04em}.lbl{font-size:.72rem;color:#94a3b8;font-weight:700;margin-top:.35rem}.detail{font-size:.62rem;color:#475569;margin-top:.2rem}.section-title{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:#64748b;font-weight:800;margin-bottom:.55rem}.actions{display:grid;grid-template-columns:repeat(3,1fr);gap:.65rem}.action{display:flex;align-items:center;gap:.7rem;background:#0b1220;border:1px solid #1e293b;border-radius:.6rem;padding:.7rem .8rem;color:#cbd5e1}.action:hover{background:#111c30;border-color:#334155}.action>span{display:grid;place-items:center;width:1.65rem;height:1.65rem;border-radius:.42rem;background:#1e293b;color:#fb923c;font-weight:800;flex:0 0 auto}.action div{min-width:0;flex:1}.action strong{font-size:.76rem;display:block}.action small{font-size:.64rem;color:#64748b;display:block;margin-top:.1rem}.action b{font-size:1.15rem;color:#475569}@media(max-width:950px){.grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:600px){.hero{flex-direction:column}.grid{grid-template-columns:repeat(2,1fr)}.actions{grid-template-columns:1fr}.card{min-height:105px}.val{font-size:1.6rem}}
</style>
