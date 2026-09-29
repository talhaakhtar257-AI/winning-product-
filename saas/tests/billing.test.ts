import { describe, expect, it } from 'vitest';
import { hmacHex, verifyLemonSignature, verifyPaddleSignature } from '@/lib/billing/signature';
import { parseLemonEvent } from '@/lib/billing/lemonsqueezy';
import { parsePaddleEvent } from '@/lib/billing/paddle';
import { profileUpdateFor, type NormalizedSubscription } from '@/lib/billing/state';

describe('webhook signatures', () => {
  const body = '{"hello":"world"}';
  it('lemon squeezy: accepts valid, rejects tampered or missing', () => {
    const sig = hmacHex('s3cret', body);
    expect(verifyLemonSignature(body, sig, 's3cret')).toBe(true);
    expect(verifyLemonSignature(body + ' ', sig, 's3cret')).toBe(false);
    expect(verifyLemonSignature(body, sig, 'other')).toBe(false);
    expect(verifyLemonSignature(body, null, 's3cret')).toBe(false);
    expect(verifyLemonSignature(body, 'zz', 's3cret')).toBe(false);
    expect(verifyLemonSignature(body, sig, '')).toBe(false);
  });
  it('paddle: checks ts + h1 and tolerance', () => {
    const now = 1_700_000_000_000;
    const ts = String(now / 1000);
    const h1 = hmacHex('pdl', `${ts}:${body}`);
    expect(verifyPaddleSignature(body, `ts=${ts};h1=${h1}`, 'pdl', now)).toBe(true);
    expect(verifyPaddleSignature(body, `ts=${ts};h1=${h1}`, 'pdl', now + 10 * 60_000)).toBe(false); // replay
    expect(verifyPaddleSignature('{}', `ts=${ts};h1=${h1}`, 'pdl', now)).toBe(false);
    expect(verifyPaddleSignature(body, `ts=${ts}`, 'pdl', now)).toBe(false);
  });
});

describe('event parsing', () => {
  it('lemon squeezy subscription event', () => {
    const payload = {
      meta: { event_name: 'subscription_updated', custom_data: { user_id: 'u1', plan_id: 'pro' } },
      data: { id: '42', type: 'subscriptions', attributes: { status: 'active', variant_id: 777, customer_id: 9, renews_at: '2030-01-01T00:00:00Z', ends_at: null, cancelled: false, user_email: 'a@b.c', urls: { customer_portal: 'https://portal' } } },
    };
    const raw = JSON.stringify(payload);
    const s = parseLemonEvent(payload, raw)!;
    expect(s).toMatchObject({ provider: 'lemonsqueezy', providerSubId: '42', userId: 'u1', priceRef: '777', status: 'active', periodEnd: '2030-01-01T00:00:00Z', portalUrl: 'https://portal' });
    expect(parseLemonEvent(payload, raw)!.eventId).toBe(s.eventId); // stable idempotency key
    expect(parseLemonEvent({ meta: { event_name: 'order_created' }, data: { type: 'orders' } }, '{}')).toBeNull();
  });
  it('paddle scheduled cancel becomes cancelled with access until effective date', () => {
    const s = parsePaddleEvent({
      event_id: 'evt_1', event_type: 'subscription.updated',
      data: { id: 'sub_1', status: 'active', custom_data: { user_id: 'u1' }, items: [{ price: { id: 'pri_1' } }], current_billing_period: { ends_at: '2030-02-01T00:00:00Z' }, scheduled_change: { action: 'cancel', effective_at: '2030-02-01T00:00:00Z' } },
    })!;
    expect(s.status).toBe('cancelled');
    expect(s.cancelAtPeriodEnd).toBe(true);
    expect(s.priceRef).toBe('pri_1');
    expect(s.eventId).toBe('paddle:evt_1');
  });
});

describe('profileUpdateFor', () => {
  const now = new Date('2030-01-15T00:00:00Z');
  const sub = (o: Partial<NormalizedSubscription>): NormalizedSubscription => ({
    provider: 'lemonsqueezy', eventId: 'e', eventName: 'x', providerSubId: '1', customerId: null, userId: 'u', email: null,
    priceRef: '1', status: 'active', periodEnd: '2030-02-01T00:00:00Z', cancelAtPeriodEnd: false, portalUrl: null, ...o,
  });
  it('active adds a 3-day grace period', () => {
    expect(profileUpdateFor(sub({}), 'pro', now)).toEqual({ plan_id: 'pro', plan_status: 'active', plan_source: 'lemonsqueezy', plan_expires_at: '2030-02-04T00:00:00.000Z' });
  });
  it('cancelled keeps access until the paid period ends', () => {
    expect(profileUpdateFor(sub({ status: 'cancelled' }), 'pro', now)).toMatchObject({ plan_id: 'pro', plan_expires_at: '2030-02-01T00:00:00.000Z' });
  });
  it('expired or cancelled-in-the-past drops to free', () => {
    expect(profileUpdateFor(sub({ status: 'expired' }), 'pro', now).plan_id).toBe('free');
    expect(profileUpdateFor(sub({ status: 'cancelled', periodEnd: '2029-01-01T00:00:00Z' }), 'pro', now).plan_id).toBe('free');
  });
});
