import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Daily (vercel.json): drops users whose paid period ended back to Free.
export async function GET(req: NextRequest) {
  const secret = env().CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin()
    .from('profiles')
    .update({ plan_id: 'free', plan_status: 'active', plan_source: 'free', plan_expires_at: null })
    .neq('plan_id', 'free')
    .lt('plan_expires_at', new Date().toISOString())
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (data?.length)
    await supabaseAdmin().from('audit_log').insert({ action: 'cron.expire', target_type: 'profiles', details: { count: data.length, ids: data.map((d) => d.id) } });
  return NextResponse.json({ ok: true, expired: data?.length ?? 0 });
}
