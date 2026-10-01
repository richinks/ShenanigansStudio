<script>
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabase'
  let s = { total:0, active:0, wip:0, setlists:0 }
  onMount(async () => {
    const [a,b,c,d] = await Promise.all([
      supabase.from('songs').select('*',{count:'exact',head:true}),
      supabase.from('songs').select('*',{count:'exact',head:true}).eq('status','Active'),
      supabase.from('songs').select('*',{count:'exact',head:true}).eq('status','WIP'),
      supabase.from('setlists').select('*',{count:'exact',head:true}),
    ])
    s = { total:a.count, active:b.count, wip:c.count, setlists:d.count }
  })
</script>
<h1 style="font-size:1.5rem;font-weight:700;margin-bottom:1.5rem">Dashboard</h1>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:2rem">
  {#each [{l:'Total Songs',v:s.total,c:'#fff'},{l:'Active',v:s.active,c:'#4ade80'},{l:'WIP',v:s.wip,c:'#facc15'},{l:'Setlists',v:s.setlists,c:'#a78bfa'}] as x}
    <div style="background:#111827;border:1px solid #1f2937;border-radius:.75rem;padding:1.25rem">
      <div style="font-size:2rem;font-weight:700;color:{x.c}">{x.v ?? '…'}</div>
      <div style="color:#9ca3af;font-size:.875rem;margin-top:.25rem">{x.l}</div>
    </div>
  {/each}
</div>
<div style="display:flex;gap:.75rem">
  <a href="/songs"    style="background:#1f2937;padding:.75rem 1.25rem;border-radius:.5rem">Browse Songs →</a>
  <a href="/setlists" style="background:#1f2937;padding:.75rem 1.25rem;border-radius:.5rem">Setlists →</a>
</div>
