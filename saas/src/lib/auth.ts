import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getEntitlements, hasRole, type Entitlements, type ProfileLike, type Role } from '@/lib/entitlements';
import { getPlans } from '@/lib/data/settings';

export interface Profile extends ProfileLike {
  id: string;
  email: string;
  full_name: string;
  plan_source: string;
  market_pref: 'all' | 'Global' | 'Pakistan';
  created_at: string;
}

export interface Session {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  ent: Entitlements;
}

/** Current user, profile and plan entitlements (memoised per request). */
export const getSession = cache(async (): Promise<Session> => {
  const plans = await getPlans(true);
  const limitsOf = (id: string) => plans.find((p) => p.id === id)?.limits;
  let user: Session['user'] = null;
  try {
    const { data } = await (await supabaseServer()).auth.getUser();
    if (data.user) user = { id: data.user.id, email: data.user.email ?? '' };
  } catch {
    user = null;
  }
  if (!user) return { user: null, profile: null, ent: getEntitlements(null, limitsOf) };
  const { data: profile } = await supabaseAdmin().from('profiles').select('*').eq('id', user.id).maybeSingle<Profile>();
  return { user, profile, ent: getEntitlements(profile, limitsOf) };
});

export async function requireUser(next = '/app') {
  const s = await getSession();
  if (!s.user || !s.profile) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (s.profile.banned) redirect('/login?error=banned');
  return s as Session & { user: NonNullable<Session['user']>; profile: Profile };
}

export async function requireRole(min: Role) {
  const s = await requireUser('/admin');
  if (!hasRole(s.profile.role, min)) redirect('/app');
  return s;
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function assertRole(min: Role) {
  const s = await getSession();
  if (!s.profile || s.profile.banned || !hasRole(s.profile.role, min)) throw new Error('Forbidden');
  return s as Session & { user: NonNullable<Session['user']>; profile: Profile };
}
