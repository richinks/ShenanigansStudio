import { json } from '@sveltejs/kit';
import { validateSong } from '$lib/songSchema';
import { supabase } from '$lib/supabaseClient';

// =========================
// GET — fetch & validate songs
// =========================
export async function GET() {
  const { data, error } = await supabase.from('songs').select('*');

  if (error) {
    console.error('Supabase fetch error:', error.message);
    return json({ error: error.message }, { status: 500 });
  }

  const validSongs = [];
  const invalidSongs = [];

  for (const row of data) {
    const result = validateSong(row);
    if (result.success) {
      validSongs.push(result.data);
    } else {
      invalidSongs.push({
        song: row.song,
        issues: result.error.errors
      });
    }
  }

  if (invalidSongs.length > 0) {
    console.warn('Invalid Supabase rows:', invalidSongs);
  }

  return json({ songs: validSongs });
}

// =========================
// POST — validate & insert song
// =========================
export async function POST({ request }) {
  const payload = await request.json();

  const result = validateSong(payload);
  if (!result.success) {
    console.error('Validation failed:', result.error.errors);
    return json({ error: result.error.message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('songs')
    .insert(result.data)
    .select();

  if (error) {
    console.error('Supabase insert error:', error.message);
    return json({ error: error.message }, { status: 500 });
  }

  return json({ success: true, data });
}
