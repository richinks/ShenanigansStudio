import { json } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ejdpcizxmbvxbzipwsfb.supabase.co'
const ADMIN_EMAIL = 'richreidjr@hotmail.com'

function clients() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured on the server'
    )
  }

  const admin = createClient(
    SUPABASE_URL,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  return { admin }
}

async function requireAdmin(request) {
  const authorization =
    request.headers.get('authorization') || ''

  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : ''

  if (!token) {
    return {
      error: json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  const { admin } = clients()

  const { data, error } =
    await admin.auth.getUser(token)

  if (error || !data.user) {
    return {
      error: json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  if (
    (data.user.email || '').toLowerCase() !==
    ADMIN_EMAIL.toLowerCase()
  ) {
    return {
      error: json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }
  }

  return {
    admin,
    currentUser: data.user
  }
}

function cleanUser(user) {
  return {
    id: user.id,
    email: user.email || '',
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    email_confirmed_at: user.email_confirmed_at,
    banned_until: user.banned_until,
    invited_at: user.invited_at,
    role:
      (user.email || '').toLowerCase() ===
      ADMIN_EMAIL.toLowerCase()
        ? 'Admin'
        : 'Member'
  }
}

export async function GET({ request, url }) {
  try {
    const auth = await requireAdmin(request)

    if (auth.error) {
      return auth.error
    }

    const page = Math.max(
      1,
      Number(url.searchParams.get('page')) || 1
    )

    const perPage = 100

    const { data, error } =
      await auth.admin.auth.admin.listUsers({
        page,
        perPage
      })

    if (error) {
      return json(
        { error: error.message },
        { status: 400 }
      )
    }

    return json({
      users: (data.users || []).map(cleanUser),
      page
    })
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown server error'
      },
      { status: 500 }
    )
  }
}

export async function POST({ request }) {
  try {
    const auth = await requireAdmin(request)

    if (auth.error) {
      return auth.error
    }

    const body = await request.json()

    const email = String(
      body.email || ''
    )
      .trim()
      .toLowerCase()

    if (
      !email ||
      !email.includes('@')
    ) {
      return json(
        {
          error:
            'A valid email address is required'
        },
        { status: 400 }
      )
    }

    const origin =
      new URL(request.url).origin

    const { data, error } =
      await auth.admin.auth.admin
        .inviteUserByEmail(
          email,
          {
            redirectTo:
              `${origin}/login`
          }
        )

    if (error) {
      return json(
        { error: error.message },
        { status: 400 }
      )
    }

    return json(
      {
        user: cleanUser(data.user)
      },
      { status: 201 }
    )
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown server error'
      },
      { status: 500 }
    )
  }
}

export async function PATCH({ request }) {
  try {
    const auth = await requireAdmin(request)

    if (auth.error) {
      return auth.error
    }

    const body = await request.json()

    const id = String(
      body.id || ''
    )

    const action = String(
      body.action || ''
    )

    if (!id) {
      return json(
        {
          error:
            'User id is required'
        },
        { status: 400 }
      )
    }

    if (
      id === auth.currentUser.id
    ) {
      return json(
        {
          error:
            'You cannot disable your own account'
        },
        { status: 400 }
      )
    }

    let attributes

    if (action === 'disable') {
      attributes = {
        ban_duration: '876000h'
      }
    } else if (
      action === 'enable'
    ) {
      attributes = {
        ban_duration: 'none'
      }
    } else {
      return json(
        {
          error:
            'Invalid action'
        },
        { status: 400 }
      )
    }

    const { data, error } =
      await auth.admin.auth.admin
        .updateUserById(
          id,
          attributes
        )

    if (error) {
      return json(
        { error: error.message },
        { status: 400 }
      )
    }

    return json({
      user: cleanUser(data.user)
    })
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown server error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE({
  request
}) {
  try {
    const auth =
      await requireAdmin(request)

    if (auth.error) {
      return auth.error
    }

    const body =
      await request.json()

    const id = String(
      body.id || ''
    )

    if (!id) {
      return json(
        {
          error:
            'User id is required'
        },
        { status: 400 }
      )
    }

    if (
      id === auth.currentUser.id
    ) {
      return json(
        {
          error:
            'You cannot delete your own account'
        },
        { status: 400 }
      )
    }

    const { error } =
      await auth.admin.auth.admin
        .deleteUser(id)

    if (error) {
      return json(
        { error: error.message },
        { status: 400 }
      )
    }

    return json({
      ok: true
    })
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown server error'
      },
      { status: 500 }
    )
  }
}