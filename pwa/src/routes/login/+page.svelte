<script>
  import { supabase } from '$lib/supabase'
  import { goto } from '$app/navigation'
  let email='', password='', error='', loading=false, mode='login'
  async function submit() {
    loading=true; error=''
    const { error:e } = mode==='login'
      ? await supabase.auth.signInWithPassword({email,password})
      : await supabase.auth.signUp({email,password})
    if (e) { error=e.message; loading=false } else goto('/')
  }
</script>
<div style="display:flex;align-items:center;justify-content:center;min-height:100vh">
  <div style="width:100%;max-width:22rem;background:#111827;border:1px solid #1f2937;border-radius:1rem;padding:2rem">
    <h1 style="text-align:center;font-size:1.5rem;font-weight:700;margin-bottom:.25rem">🎸 ShenanigansStudio</h1>
    <p style="text-align:center;color:#9ca3af;font-size:.875rem;margin-bottom:1.5rem">
      {mode==='login'?'Sign in to your account':'Create a band account'}
    </p>
    {#if error}<p style="color:#f87171;font-size:.875rem;background:#1c0a0a;border:1px solid #7f1d1d;border-radius:.375rem;padding:.5rem .75rem;margin-bottom:1rem">{error}</p>{/if}
    <form on:submit|preventDefault={submit} style="display:flex;flex-direction:column;gap:.75rem">
      <input type="email"    bind:value={email}    placeholder="Email"    required />
      <input type="password" bind:value={password} placeholder="Password" required />
      <button type="submit" disabled={loading} style="margin-top:.5rem">
        {loading?'Working…':mode==='login'?'Sign in':'Create account'}
      </button>
    </form>
    <button on:click={()=>mode=mode==='login'?'signup':'login'}
      style="width:100%;margin-top:1rem;background:transparent;color:#6b7280;font-size:.875rem">
      {mode==='login'?"Don't have an account? Sign up":'Already have an account? Sign in'}
    </button>
  </div>
</div>
