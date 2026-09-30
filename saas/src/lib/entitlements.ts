import { z } from 'zod';

export const limitsSchema = z.object({
  historyDays: z.coerce.number().int().min(1).max(36500).default(1),
  maxProducts: z.coerce.number().int().min(1).max(1_000_000).default(10),
  fullDetails: z.coerce.boolean().default(false),
  trendHistory: z.coerce.boolean().default(false),
  competitors: z.coerce.boolean().default(false),
  export: z.coerce.boolean().default(false),
  savedMax: z.coerce.number().int().min(0).max(1_000_000).default(5),
  calcSave: z.coerce.boolean().default(false),
  validationsPerMonth: z.coerce.number().int().min(0).max(1_000_000).default(3),
});

export type Limits = z.infer<typeof limitsSchema>;

export const FREE_LIMITS: Limits = limitsSchema.parse({});

export const UNLIMITED: Limits = {
  historyDays: 36500,
  maxProducts: 1_000_000,
  fullDetails: true,
  trendHistory: true,
  competitors: true,
  export: true,
  savedMax: 1_000_000,
  calcSave: true,
  validationsPerMonth: 1_000_000,
};

export type Role = 'user' | 'staff' | 'admin' | 'owner';

export interface ProfileLike {
  role: Role;
  plan_id: string;
  plan_status: string;
  plan_expires_at: string | null;
  banned: boolean;
}

export interface Entitlements {
  planId: string;
  paid: boolean;
  limits: Limits;
}

/** Is the stored plan currently in force? Expired or cancelled plans fall back to free. */
export function planIsLive(p: Pick<ProfileLike, 'plan_status' | 'plan_expires_at'>, now = new Date()): boolean {
  if (!['active', 'trialing', 'past_due'].includes(p.plan_status)) return false;
  if (p.plan_expires_at && new Date(p.plan_expires_at).getTime() < now.getTime()) return false;
  return true;
}

export function getEntitlements(
  profile: ProfileLike | null,
  planLimits: (planId: string) => unknown,
  now = new Date(),
): Entitlements {
  if (!profile || profile.banned) return { planId: 'free', paid: false, limits: parseLimits(planLimits('free')) };
  if (profile.role !== 'user') return { planId: profile.plan_id, paid: true, limits: UNLIMITED };
  if (profile.plan_id === 'free' || !planIsLive(profile, now))
    return { planId: 'free', paid: false, limits: parseLimits(planLimits('free')) };
  return { planId: profile.plan_id, paid: true, limits: parseLimits(planLimits(profile.plan_id)) };
}

export function parseLimits(value: unknown): Limits {
  const r = limitsSchema.safeParse(value ?? {});
  return r.success ? r.data : FREE_LIMITS;
}

const RANK: Record<Role, number> = { user: 0, staff: 1, admin: 2, owner: 3 };
export function hasRole(role: Role | undefined, min: Role): boolean {
  return role !== undefined && RANK[role] >= RANK[min];
}

/** Fields a free visitor must not receive (enforced server-side before rendering). */
export const LOCKED_FIELDS = ['source', 'supplier', 'ad_idea', 'risk', 'audience', 'where_to_sell', 'cost', 'score_details', 'score_parts'] as const;

export function redactProduct<T extends object>(p: T, limits: Limits): T & { locked: boolean } {
  if (limits.fullDetails) return { ...p, locked: false };
  const copy = { ...p } as Record<string, unknown>;
  for (const f of LOCKED_FIELDS) if (f in copy) copy[f] = Array.isArray(copy[f]) ? [] : null;
  return { ...(copy as T), locked: true };
}
