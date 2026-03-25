/**
 * Supabase Database Configuration
 * Provides both admin (service key) and public (anon key) clients
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Public client (respects RLS policies)
const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-anon-key'
);

// Admin client (bypasses RLS - use for server-side operations)
const supabaseAdmin = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Check if Supabase is configured (not using placeholders)
 */
function isSupabaseConfigured() {
  return SUPABASE_URL && SUPABASE_URL !== 'https://placeholder.supabase.co' 
    && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== 'placeholder-anon-key';
}

module.exports = { supabase, supabaseAdmin, isSupabaseConfigured };
