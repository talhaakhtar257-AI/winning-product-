// Provider-neutral subscription state and how it maps onto a user's plan.

export type Provider = 'lemonsqueezy' | 'paddle';
export type SubStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired';

export interface NormalizedSubscription {
  provider: Provider;
  eventId: string;
  eventName: string;
  providerSubId: string;
  customerId: string | null;
  userId: string | null;
  email: string | null;
  priceRef: string | null; // variant id / price id → plan lookup
  status: SubStatus;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  portalUrl: string | null;
}

export interface ProfilePlanUpdate {
  plan_id: string;
  plan_status: SubStatus;
  plan_source: Provider | 'free';
  plan_expires_at: string | null;
}

const GRACE_MS = 3 * 86_400_000;

/**
 * What the profile should look like after this subscription event.
 * - live statuses keep the plan until period end + 3-day grace
 * - cancelled keeps access until the paid period ends
 * - expired (or cancelled with no time left) drops to free
 */
export function profileUpdateFor(sub: NormalizedSubscription, planId: string, now = new Date()): ProfilePlanUpdate {
  const end = sub.periodEnd ? new Date(sub.periodEnd) : null;
  const endsInFuture = end !== null && end.getTime() > now.getTime();

  if (sub.status === 'expired' || (sub.status === 'cancelled' && !endsInFuture)) {
    return { plan_id: 'free', plan_status: 'active', plan_source: 'free', plan_expires_at: null };
  }
  if (sub.status === 'cancelled') {
    return { plan_id: planId, plan_status: 'active', plan_source: sub.provider, plan_expires_at: end!.toISOString() };
  }
  return {
    plan_id: planId,
    plan_status: sub.status,
    plan_source: sub.provider,
    plan_expires_at: end ? new Date(end.getTime() + GRACE_MS).toISOString() : null,
  };
}
