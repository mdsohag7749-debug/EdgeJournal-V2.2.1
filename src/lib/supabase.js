import { createClient } from '@supabase/supabase-js';

// Supabase project credentials come from environment variables so the
// real keys never get committed to the repo. Copy .env.example to .env
// and fill in your project's URL + anon key (Supabase dashboard ->
// Project Settings -> API).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Don't throw — just warn loudly. This keeps the app (and the rest of
  // the UI) renderable even before Supabase is configured, instead of a
  // blank white screen from a thrown error during module init.
  console.warn(
    '[EdgeJournal] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and add your Supabase project credentials, then restart the dev server.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
