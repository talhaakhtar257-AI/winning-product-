import 'server-only';
import { cache } from 'react';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { parseSettings, type Settings } from '@/lib/settings';
import { parseLimits, type Limits } from '@/lib/entitlements';

export const getSettings = cache(async (): Promise<Settings> => {
  try {
    const { data } = await supabaseAdmin().from('site_settings').select('key, value');
    return parseSettings(data ?? []);
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', msg: 'settings unavailable, using defaults', error: String(e) }));
    return parseSettings([]);
  }
});

export interface Plan {
  id: string;
  name: string;
  description: string;
  price_usd: number;
  price_pkr: number;
  interval: 'month' | 'year';
  limits: Limits;
  features: string[];
  lemon_variant_id: string | null;
  paddle_price_id: string | null;
  active: boolean;
  highlighted: boolean;
  sort: number;
}

export const getPlans = cache(async (includeInactive = false): Promise<Plan[]> => {
  let data: Record<string, unknown>[] | null = null;
  try {
    let q = supabaseAdmin().from('plans').select('*').order('sort');
    if (!includeInactive) q = q.eq('active', true);
    data = (await q).data;
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', msg: 'plans unavailable', error: String(e) }));
  }
  return (data ?? []).map((p) => ({
    ...(p as unknown as Plan),
    price_usd: Number(p.price_usd),
    price_pkr: Number(p.price_pkr),
    limits: parseLimits(p.limits),
    features: Array.isArray(p.features) ? p.features.map(String) : [],
  }));
});
