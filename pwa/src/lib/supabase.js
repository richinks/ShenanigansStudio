import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://ejdpcizxmbvxbzipwsfb.supabase.co'
const SUPABASE_KEY  = 'sb_publishable_aTp1MufuuzY9nkHjpqYtCw_c3mkMmN_'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
