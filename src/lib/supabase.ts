import { createClient } from '@supabase/supabase-js';

// These variables will be loaded from a .env file locally 
// or environment variables in production.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
