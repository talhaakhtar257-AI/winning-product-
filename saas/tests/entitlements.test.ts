import { describe, expect, it } from 'vitest';
import { FREE_LIMITS, getEntitlements, hasRole, planIsLive, redactProduct, UNLIMITED } from '@/lib/entitlements';

const limits = (id: string) =>
  id === 'pro' ? { historyDays: 90, maxProducts: 5000, fullDetails: true, trendHistory: true, competitors: true, export: true, savedMax: 500, calcSave: true, validationsPerMonth: 100 } : {};
const base = { role: 'user' as const, plan_id: 'pro', plan_status: 'active', plan_expires_at: null, banned: false };

describe('entitlements', () => {
  it('visitors get free limits', () => {
    expect(getEntitlements(null, limits)).toEqual({ planId: 'free', paid: false, limits: FREE_LIMITS });
  });
  it('active pro user gets pro limits', () => {
    const e = getEntitlements(base, limits);
    expect(e.paid).toBe(true);
    expect(e.limits.historyDays).toBe(90);
  });
  it('expired plan falls back to free', () => {
    const e = getEntitlements({ ...base, plan_expires_at: '2020-01-01T00:00:00Z' }, limits);
    expect(e.paid).toBe(false);
    expect(e.limits.export).toBe(false);
  });
  it('cancelled/expired status falls back to free', () => {
    expect(planIsLive({ plan_status: 'expired', plan_expires_at: null })).toBe(false);
    expect(planIsLive({ plan_status: 'cancelled', plan_expires_at: null })).toBe(false);
    expect(planIsLive({ plan_status: 'past_due', plan_expires_at: null })).toBe(true);
  });
  it('banned users get free limits', () => {
    expect(getEntitlements({ ...base, banned: true }, limits).paid).toBe(false);
  });
  it('staff get unlimited access', () => {
    expect(getEntitlements({ ...base, plan_id: 'free', role: 'staff' }, limits).limits).toEqual(UNLIMITED);
  });
  it('role ranking', () => {
    expect(hasRole('owner', 'admin')).toBe(true);
    expect(hasRole('staff', 'admin')).toBe(false);
    expect(hasRole(undefined, 'staff')).toBe(false);
  });
  it('redacts paid fields for free plans', () => {
    const p = { name: 'X', supplier: 'https://a', cost: 5, score_parts: [{ label: 'a', value: 1 }], why: 'ok' };
    const r = redactProduct(p, FREE_LIMITS);
    expect(r.locked).toBe(true);
    expect(r.supplier).toBeNull();
    expect(r.cost).toBeNull();
    expect(r.score_parts).toEqual([]);
    expect(r.why).toBe('ok');
    expect(redactProduct(p, UNLIMITED).supplier).toBe('https://a');
  });
});
