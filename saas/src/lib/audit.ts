import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function audit(actorId: string | null, action: string, targetType = '', targetId = '', details: Record<string, unknown> = {}) {
  const { error } = await supabaseAdmin()
    .from('audit_log')
    .insert({ actor_id: actorId, action, target_type: targetType, target_id: targetId, details });
  if (error) console.error(JSON.stringify({ level: 'error', msg: 'audit insert failed', action, error: error.message }));
}
