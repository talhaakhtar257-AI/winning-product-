import { describe, expect, it } from 'vitest';
import { setupChecklist } from '@/lib/setup';
import { parseSettings } from '@/lib/settings';

const now = Date.parse('2026-10-01T12:00:00Z');
const base = {
  env: {},
  settings: parseSettings([]),
  plans: [{ id: 'free', lemon_variant_id: null, paddle_price_id: null }, { id: 'pro', lemon_variant_id: null, paddle_price_id: null }],
  productCount: 0,
  lastIngestAt: null,
  lastIngestError: null,
  now,
};
const ok = (items: ReturnType<typeof setupChecklist>, key: string) => items.find((i) => i.key === key)!.ok;

describe('setupChecklist', () => {
  it('fresh install: everything is still to do', () => {
    expect(setupChecklist(base).every((i) => !i.ok)).toBe(true);
  });
  it('recognises a finished setup', () => {
    const settings = parseSettings([
      { key: 'brand', value: { name: 'WinScout', supportEmail: 'help@example.com' } },
      { key: 'payments', value: { jazzcash: { enabled: true, number: '03001234567', title: 'Owner' } } },
    ]);
    const items = setupChecklist({
      ...base,
      settings,
      env: { NEXT_PUBLIC_SITE_URL: 'https://winscout.vercel.app', CRON_SECRET: 'x'.repeat(32), LEMONSQUEEZY_API_KEY: 'k', LEMONSQUEEZY_STORE_ID: '1', LEMONSQUEEZY_WEBHOOK_SECRET: 's' },
      plans: [...base.plans.slice(0, 1), { id: 'pro', lemon_variant_id: '777', paddle_price_id: null }],
      productCount: 280,
      lastIngestAt: '2026-10-01T09:30:00Z',
    });
    expect(items.every((i) => i.ok)).toBe(true);
  });
  it('flags localhost, stale imports and failed imports', () => {
    expect(ok(setupChecklist({ ...base, env: { NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' } }), 'site')).toBe(false);
    expect(ok(setupChecklist({ ...base, productCount: 10, lastIngestAt: '2026-09-28T00:00:00Z' }), 'products')).toBe(false);
    expect(ok(setupChecklist({ ...base, productCount: 10, lastIngestAt: '2026-10-01T11:00:00Z', lastIngestError: 'boom' }), 'products')).toBe(false);
  });
  it('switched-off payment methods count as done', () => {
    const settings = parseSettings([{ key: 'features', value: { lemonsqueezy: false, manualPayments: false } }]);
    const items = setupChecklist({ ...base, settings });
    expect(ok(items, 'card-pay')).toBe(true);
    expect(ok(items, 'local-pay')).toBe(true);
  });
});
