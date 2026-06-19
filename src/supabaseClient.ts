import { createClient } from '@supabase/supabase-js';

// Retrieve Supabase credentials. Both VITE_ and NEXT_PUBLIC_ prefixes are checked
// for full compatibility across Vite dev environments and Vercel hosting.
const metaEnv = (import.meta as any).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || metaEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || metaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'YOUR_SUPABASE_URL');
};

let supabaseInstance: ReturnType<typeof createClient> | null = null;

export const getSupabase = () => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase URL and Anon Key are required. Please configure your .env file or environment variables.');
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return supabaseInstance;
};
