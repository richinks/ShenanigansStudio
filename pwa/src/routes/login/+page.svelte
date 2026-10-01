<script>
  import { supabase } from '#lib/supabase'
  import { goto } from '$app/navigation'
  let email='', password='', err='', loading=false, mode='login'
  async function submit() {
    loading=true; err=''
    const { error } = mode==='login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    if (error) { err=error.message; loading=false }
    else goto('/')
  }
</script>
<div class="wrap">
  <div class="card">
    <h1>🎸 ShenanigansStudio</h1>
    <p class="sub">{mode==='login' ? 'Sign in to your account' : 'Create a band account'}</p>
    {#if err}<div class="err">{err}</div>{/if}
    <form on:submit|preventDefault={submit}>
      <input type="email"    bind:value={email}    placeholder="Email"    required />
      <input type="password" bind:value={password} placeholder="Password" required />
      <button type="submit" disabled={loading}>
        {loading ? 'Working…' : mode==='login' ? 'Sign in' : 'Create account'}
      </button>
    </form>
    <button class="toggle" on:click={() => mode = mode==='login' ? 'signup' : 'login'}>
      {mode==='login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
    </button>
  </div>
</div>
<style>
  .wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem}
  .card{width:100%;max-width:22rem;background:#0f172a;border:1px solid #1f2937;border-radius:1rem;padding:2rem}
  h1{text-align:center;font-size:1.4rem;font-weight:700;margin-bottom:.25rem}
  .sub{text-align:center;color:#6b7280;font-size:.85rem;margin-bottom:1.5rem}
  .err{color:#f87171;font-size:.85rem;background:#1c0a0a;border:1px solid #7f1d1d;border-radius:.375rem;padding:.5rem .75rem;margin-bottom:1rem}
  form{display:flex;flex-direction:column;gap:.75rem}
  .toggle{width:100%;margin-top:1rem;background:transparent;color:#6b7280;font-size:.8rem;padding:.25rem}
  .toggle:hover{background:transparent;color:#9ca3af}
</style>
