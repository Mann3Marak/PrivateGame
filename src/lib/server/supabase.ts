import 'server-only';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from './env';

let cachedClient: SupabaseClient | null | undefined;

export function getServiceSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const env = getServerEnv();
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    cachedClient = null;
    return null;
  }

  cachedClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return cachedClient;
}
