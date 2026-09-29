import { createHash } from 'node:crypto';
import type { NormalizedSubscription, SubStatus } from './state';

const API = 'https://api.lemonsqueezy.com/v1';

export interface CheckoutArgs {
  variantId: string;
  userId: string;
  email: string;
  planId: string;
  redirectUrl: string;
}

export async function createLemonCheckout(a: CheckoutArgs, apiKey: string, storeId: string): Promise<string> {
  const res = await fetch(`${API}/checkouts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: { email: a.email, custom: { user_id: a.userId, plan_id: a.planId } },
          product_options: { redirect_url: a.redirectUrl },
        },
        relationships: {
          store: { data: { type: 'stores', id: storeId } },
          variant: { data: { type: 'variants', id: a.variantId } },
        },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Lemon Squeezy checkout failed (${res.status})`);
  const json = (await res.json()) as { data?: { attributes?: { url?: string } } };
  const url = json.data?.attributes?.url;
  if (!url) throw new Error('Lemon Squeezy returned no checkout URL');
  return url;
}

const STATUS: Record<string, SubStatus> = {
  on_trial: 'trialing',
  active: 'active',
  paused: 'past_due',
  past_due: 'past_due',
  unpaid: 'past_due',
  cancelled: 'cancelled',
  expired: 'expired',
};

/** Returns null for events we don't act on (orders, license keys, …). */
export function parseLemonEvent(payload: unknown, rawBody: string): NormalizedSubscription | null {
  const p = payload as {
    meta?: { event_name?: string; custom_data?: Record<string, unknown> };
    data?: { id?: string | number; type?: string; attributes?: Record<string, unknown> };
  };
  const eventName = p.meta?.event_name ?? '';
  if (!eventName.startsWith('subscription_') || p.data?.type !== 'subscriptions') return null;
  const a = p.data.attributes ?? {};
  const status = STATUS[String(a.status)] ?? 'past_due';
  const urls = (a.urls ?? {}) as Record<string, unknown>;
  // Lemon Squeezy has no event id; the body hash is a stable idempotency key for retries.
  const eventId = `lemonsqueezy:${createHash('sha256').update(rawBody).digest('hex').slice(0, 40)}`;
  const userId = p.meta?.custom_data?.user_id;
  return {
    provider: 'lemonsqueezy',
    eventId,
    eventName,
    providerSubId: String(p.data.id ?? ''),
    customerId: a.customer_id != null ? String(a.customer_id) : null,
    userId: typeof userId === 'string' ? userId : null,
    email: typeof a.user_email === 'string' ? a.user_email : null,
    priceRef: a.variant_id != null ? String(a.variant_id) : null,
    status,
    periodEnd: (typeof a.ends_at === 'string' && a.ends_at) || (typeof a.renews_at === 'string' ? a.renews_at : null),
    cancelAtPeriodEnd: a.cancelled === true,
    portalUrl: typeof urls.customer_portal === 'string' ? urls.customer_portal : null,
  };
}
