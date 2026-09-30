import type { CheckoutArgs } from './lemonsqueezy';
import type { NormalizedSubscription, SubStatus } from './state';

export function paddleApi(sandbox: boolean) {
  return sandbox ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com';
}

/** Creates a transaction; Paddle returns a hosted checkout URL (needs a default payment link set in Paddle). */
export async function createPaddleCheckout(
  a: Omit<CheckoutArgs, 'variantId'> & { priceId: string },
  apiKey: string,
  sandbox: boolean,
): Promise<string> {
  const res = await fetch(`${paddleApi(sandbox)}/transactions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ price_id: a.priceId, quantity: 1 }],
      custom_data: { user_id: a.userId, plan_id: a.planId },
      checkout: { url: a.redirectUrl },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Paddle checkout failed (${res.status})`);
  const json = (await res.json()) as { data?: { checkout?: { url?: string } } };
  const url = json.data?.checkout?.url;
  if (!url) throw new Error('Paddle returned no checkout URL');
  return url;
}

const STATUS: Record<string, SubStatus> = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  paused: 'past_due',
  canceled: 'expired', // Paddle only sets "canceled" once access has ended
};

export function parsePaddleEvent(payload: unknown): NormalizedSubscription | null {
  const p = payload as { event_id?: string; event_type?: string; data?: Record<string, unknown> };
  const eventName = p.event_type ?? '';
  if (!eventName.startsWith('subscription.') || !p.data || !p.event_id) return null;
  const d = p.data;
  const custom = (d.custom_data ?? {}) as Record<string, unknown>;
  const items = (d.items ?? []) as { price?: { id?: string } }[];
  const period = (d.current_billing_period ?? {}) as { ends_at?: string };
  const scheduled = (d.scheduled_change ?? null) as { action?: string; effective_at?: string } | null;
  const mgmt = (d.management_urls ?? {}) as { update_payment_method?: string; cancel?: string };
  const cancelling = scheduled?.action === 'cancel';
  let status = STATUS[String(d.status)] ?? 'past_due';
  if (cancelling && status === 'active') status = 'cancelled';
  return {
    provider: 'paddle',
    eventId: `paddle:${p.event_id}`,
    eventName,
    providerSubId: String(d.id ?? ''),
    customerId: typeof d.customer_id === 'string' ? d.customer_id : null,
    userId: typeof custom.user_id === 'string' ? custom.user_id : null,
    email: null,
    priceRef: items[0]?.price?.id ?? null,
    status,
    periodEnd: (cancelling && scheduled?.effective_at) || period.ends_at || null,
    cancelAtPeriodEnd: cancelling,
    portalUrl: mgmt.update_payment_method ?? mgmt.cancel ?? null,
  };
}
