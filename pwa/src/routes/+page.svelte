<script>
  import { onMount } from 'svelte'
  import { supabase } from '#lib/supabase'
  let counts = {}
  onMount(async () => {
    const [a,b,c,d] = await Promise.all([
      supabase.from('songs').select('*',{count:'exact',head:true}),
      supabase.from('songs').select('*',{count:'exact',head:true}).eq('status','Active'),
      supabase.from('songs').select('*',{count:'exact',head:true}).eq('status','WIP'),
      supabase.from('setlists').select('*',{count:'exact',head:true}),
    ])
    counts = { total:a.count, active:b.count, wip:c.count, setlists:d.count }
  })
  const cards = [
    { label:'Total Songs',  key:'total',    color:'#fff',     href:'/songs' },
    { label:'Active',       key:'active',   color:'#4ade80',  href:'/songs' },
    { label:'WIP',          key:'wip',      color:'#facc15',  href:'/songs' },
    { label:'Setlists',     key:'setlists', color:'#a78bfa',  href:'/setlists' },
  ]
</script>
<h1>Dashboard</h1>
<div class="grid">
  {#each cards as c}
    <a class="card" href={c.href}>
      <div class="val" style="color:{c.color}">{counts[c.key] ?? '…'}</div>
      <div class="lbl">{c.label}</div>
    </a>
  {/each}
</div>
<div class="links">
  <a href="/songs"    class="btn">Browse Songs →</a>
  <a href="/setlists" class="btn">Setlists →</a>
</div>
<style>
  h1{font-size:1.5rem;font-weight:700;margin-bottom:1.5rem}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:2rem}
  .card{background:#0f172a;border:1px solid #1f2937;border-radius:.75rem;padding:1.25rem;display:block}
  .card:hover{border-color:#374151}
  .val{font-size:2.25rem;font-weight:700}
  .lbl{color:#6b7280;font-size:.8rem;margin-top:.25rem}
  .links{display:flex;gap:.75rem}
  .btn{background:#1f2937;padding:.75rem 1.25rem;border-radius:.5rem;font-size:.875rem;color:#d1d5db}
  .btn:hover{background:#374151}
  @media(max-width:600px){.grid{grid-template-columns:repeat(2,1fr)}}
</style>
