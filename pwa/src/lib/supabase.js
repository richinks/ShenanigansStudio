import { createClient } from '@supabase/supabase-js';

// These MUST exist in your .env.local or Netlify environment
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Safety check — prevents silent failures
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Supabase environment variables are missing.');
  console.error('Expected VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

// Create the client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});
