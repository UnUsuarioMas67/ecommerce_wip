import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import env from '../config/env.js';
import { HttpError } from './errors.js';

let client: SupabaseClient | undefined;

export function supabase(): SupabaseClient {
  if (env.SUPABASE_URL === undefined || env.SUPABASE_SECRET_KEY === undefined) {
    throw new HttpError(503, 'Product image storage is not configured');
  }
  client ??= createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
