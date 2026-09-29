import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { profileUpdateFor, type NormalizedSubscription } from './state';

export type ApplyOutcome = 'applied' | 'duplicate' | 'ignored';

function log(msg: string, extra: Record<string, unknown>) {
  console.log(JSON.stringify({ level: 'info', msg, ...extra }));
}

/** Idempotently applies a verified subscription webhook to subscriptions + profile. */
export async function applySubscriptionEvent(sub: NormalizedSubscription, payload: unknown): Promise<ApplyOutcome> {
  const db = supabaseAdmin();
  const ins = await db.from('webhook_events').insert({ id: sub.eventId, provider: sub.provider, event_name: sub.eventName, payload });
  if (ins.error) {
    if (ins.error.code === '23505') {
      const { data } = await db.from('webhook_events').select('processed_at').eq('id', sub.eventId).maybeSingle();
      if (data?.processed_at) return 'duplicate';
      // A previous attempt failed half-way: process again.
    } else throw new Error(ins.error.message);
  }

  try {
    const col = sub.provider === 'lemonsqueezy' ? 'lemon_variant_id' : 'paddle_price_id';
    const { data: plan } = sub.priceRef ? await db.from('plans').select('id').eq(col, sub.priceRef).maybeSingle() : { data: null };

    // Resolve the user: checkout custom data → existing subscription → email.
    let userId: string | null = null;
    if (sub.userId) {
      const { data } = await db.from('profiles').select('id').eq('id', sub.userId).maybeSingle();
      userId = data?.id ?? null;
    }
    if (!userId) {
      const { data } = await db.from('subscriptions').select('user_id').eq('provider', sub.provider).eq('provider_sub_id', sub.providerSubId).maybeSingle();
      userId = data?.user_id ?? null;
    }
    if (!userId && sub.email) {
      const { data } = await db.from('profiles').select('id').ilike('email', sub.email).limit(1).maybeSingle();
      userId = data?.id ?? null;
    }
    if (!userId || !plan) {
      await db.from('webhook_events').update({ processed_at: new Date().toISOString(), error: !userId ? 'user not found' : `no plan for price ${sub.priceRef}` }).eq('id', sub.eventId);
      log('webhook ignored', { event: sub.eventId, userId, priceRef: sub.priceRef });
      return 'ignored';
    }

    const sres = await db.from('subscriptions').upsert(
      {
        user_id: userId,
        provider: sub.provider,
        provider_sub_id: sub.providerSubId,
        provider_customer_id: sub.customerId,
        plan_id: plan.id,
        status: sub.status,
        current_period_end: sub.periodEnd,
        cancel_at_period_end: sub.cancelAtPeriodEnd,
        portal_url: sub.portalUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider,provider_sub_id' },
    );
    if (sres.error) throw new Error(sres.error.message);

    const update = profileUpdateFor(sub, plan.id);
    const { data: profile } = await db.from('profiles').select('plan_source').eq('id', userId).single();
    // Never let a card downgrade wipe a plan the user got another way (manual/comp).
    const downgrade = update.plan_id === 'free';
    if (!downgrade || profile?.plan_source === sub.provider) {
      const pres = await db.from('profiles').update(update).eq('id', userId);
      if (pres.error) throw new Error(pres.error.message);
    }
    await db.from('webhook_events').update({ processed_at: new Date().toISOString(), error: null }).eq('id', sub.eventId);
    log('subscription applied', { event: sub.eventId, userId, plan: plan.id, status: sub.status });
    return 'applied';
  } catch (e) {
    await db.from('webhook_events').update({ error: String(e).slice(0, 500) }).eq('id', sub.eventId);
    throw e;
  }
}
