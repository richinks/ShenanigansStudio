<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { supabase } from '#lib/supabase'

  const ADMIN_EMAIL = 'richreidjr@hotmail.com'
  let users = []
  let loading = true
  let error = ''
  let message = ''
  let inviteEmail = ''
  let inviting = false
  let busy = new Set()
  let search = ''
  let currentUserId = ''

  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { goto('/login'); return }
    if ((session.user.email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase()) { goto('/'); return }
    currentUserId = session.user.id
    await loadUsers()
  })

  async function api(path = '', options = {}) {
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch(`/api/admin/users${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session?.access_token || ''}`,
        ...(options.headers || {})
      }
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Request failed')
    return payload
  }

  async function loadUsers() {
    loading = true; error = ''
    try { users = (await api()).users || [] }
    catch (e) { error = e.message }
    loading = false
  }

  async function invite() {
    if (!inviteEmail.trim()) return
    inviting = true; error = ''; message = ''
    try {
      await api('', { method: 'POST', body: JSON.stringify({ email: inviteEmail }) })
      message = `Invitation sent to ${inviteEmail.trim()}`
      inviteEmail = ''
      await loadUsers()
    } catch (e) { error = e.message }
    inviting = false
  }

  function setBusy(id, value) {
    value ? busy.add(id) : busy.delete(id)
    busy = new Set(busy)
  }

  async function setEnabled(user, enable) {
    setBusy(user.id, true); error = ''; message = ''
    try {
      const payload = await api('', { method: 'PATCH', body: JSON.stringify({ id: user.id, action: enable ? 'enable' : 'disable' }) })
      users = users.map(u => u.id === user.id ? payload.user : u)
      message = `${user.email} ${enable ? 'enabled' : 'disabled'}`
    } catch (e) { error = e.message }
    setBusy(user.id, false)
  }

  async function removeUser(user) {
    if (!confirm(`Permanently delete ${user.email}? This cannot be undone.`)) return
    setBusy(user.id, true); error = ''; message = ''
    try {
      await api('', { method: 'DELETE', body: JSON.stringify({ id: user.id }) })
      users = users.filter(u => u.id !== user.id)
      message = `${user.email} deleted`
    } catch (e) { error = e.message }
    setBusy(user.id, false)
  }

  function isDisabled(user) {
    return user.banned_until && new Date(user.banned_until).getTime() > Date.now()
  }

  function formatDate(value) {
    if (!value) return 'Never'
    return new Date(value).toLocaleString()
  }

  $: filtered = users.filter(user => !search.trim() || user.email.toLowerCase().includes(search.trim().toLowerCase()))
</script>

<svelte:head><title>User Management - ShenanigansStudio</title></svelte:head>

<div class="heading">
  <div><p class="eyebrow">Admin</p><h1>User Management</h1><p class="muted">Invite members, review access, disable accounts, or remove users.</p></div>
  <button class="refresh" on:click={loadUsers} disabled={loading}>Refresh</button>
</div>

<section class="invite-card">
  <div><h2>Invite a user</h2><p class="muted">Supabase will email an invitation link to the address below.</p></div>
  <form on:submit|preventDefault={invite}>
    <label for="invite-email">Email address</label>
    <div class="invite-row"><input id="invite-email" type="email" bind:value={inviteEmail} placeholder="member@example.com" required /><button disabled={inviting}>{inviting ? 'Sending...' : 'Send Invite'}</button></div>
  </form>
</section>

{#if error}<p class="alert error">{error}</p>{/if}
{#if message}<p class="alert success">{message}</p>{/if}

<div class="toolbar"><input bind:value={search} placeholder="Search users by email..." /><span class="count">{filtered.length} user{filtered.length === 1 ? '' : 's'}</span></div>

{#if loading}
  <p class="muted loading">Loading users...</p>
{:else}
  <div class="table-wrap">
    <table>
      <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Created</th><th>Last sign-in</th><th>Actions</th></tr></thead>
      <tbody>
        {#each filtered as user (user.id)}
          <tr>
            <td><strong>{user.email}</strong>{#if user.id === currentUserId}<span class="you">You</span>{/if}<div class="id">{user.id}</div></td>
            <td><span class:admin={user.role === 'Admin'} class="role">{user.role}</span></td>
            <td>{#if isDisabled(user)}<span class="badge disabled">Disabled</span>{:else if user.email_confirmed_at}<span class="badge active">Active</span>{:else}<span class="badge pending">Invited</span>{/if}</td>
            <td>{formatDate(user.created_at)}</td>
            <td>{formatDate(user.last_sign_in_at)}</td>
            <td>
              <div class="actions">
                {#if user.id !== currentUserId}
                  {#if isDisabled(user)}<button class="enable" on:click={() => setEnabled(user, true)} disabled={busy.has(user.id)}>Enable</button>{:else}<button class="disable" on:click={() => setEnabled(user, false)} disabled={busy.has(user.id)}>Disable</button>{/if}
                  <button class="delete" on:click={() => removeUser(user)} disabled={busy.has(user.id)}>Delete</button>
                {:else}<span class="muted">Protected</span>{/if}
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .heading{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;margin-bottom:1.25rem}.eyebrow{text-transform:uppercase;letter-spacing:.12em;color:#e8851a;font-size:.72rem;font-weight:800;margin-bottom:.25rem}h1{font-size:1.65rem;margin:0 0 .35rem}h2{font-size:1rem;margin-bottom:.25rem}.muted{color:#6b7280}.refresh{background:#1f2937;color:#d1d5db;border:1px solid #374151}.invite-card{display:grid;grid-template-columns:1fr 1.2fr;gap:1.5rem;background:#0f172a;border:1px solid #1f2937;border-radius:.75rem;padding:1.1rem 1.25rem;margin-bottom:1rem}.invite-card label{display:block;color:#9ca3af;font-size:.78rem;margin-bottom:.35rem}.invite-row{display:flex;gap:.6rem}.invite-row input{min-width:0}.invite-row button{white-space:nowrap}.alert{padding:.7rem .9rem;border-radius:.45rem;margin:.75rem 0;font-size:.85rem}.error{background:#450a0a;color:#fca5a5;border:1px solid #7f1d1d}.success{background:#052e16;color:#86efac;border:1px solid #166534}.toolbar{display:flex;align-items:center;gap:1rem;margin:1rem 0 .25rem}.toolbar input{max-width:22rem}.count{color:#6b7280;font-size:.8rem}.table-wrap{overflow-x:auto}.loading{padding:2rem;text-align:center}td{vertical-align:middle}.id{font-family:monospace;color:#4b5563;font-size:.68rem;margin-top:.2rem}.you{margin-left:.5rem;background:#3b0764;color:#d8b4fe;border-radius:999px;padding:.12rem .4rem;font-size:.65rem}.role{display:inline-block;border-radius:999px;padding:.18rem .5rem;background:#1f2937;color:#d1d5db;font-size:.72rem}.role.admin{background:#3b0764;color:#d8b4fe}.badge{display:inline-block;border-radius:999px;padding:.18rem .5rem;font-size:.72rem;font-weight:700}.badge.active{background:#052e16;color:#4ade80}.badge.pending{background:#422006;color:#facc15}.badge.disabled{background:#450a0a;color:#f87171}.actions{display:flex;gap:.4rem;align-items:center}.actions button{padding:.3rem .6rem;font-size:.75rem}.enable{background:#166534}.disable{background:#78350f}.delete{background:#7f1d1d;color:#fca5a5}@media(max-width:760px){.invite-card{grid-template-columns:1fr}.invite-row{flex-direction:column}.heading{flex-direction:column}.toolbar{align-items:stretch;flex-direction:column}.toolbar input{max-width:none}}
</style>
