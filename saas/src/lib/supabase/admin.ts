import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

let client: SupabaseClient | null = null;

/**
 * Service-role client: bypasses RLS. Only ever used in server code AFTER the
 * caller's identity, role and plan have been checked. Never import in client code.
 */
export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const e = env();
  client = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
