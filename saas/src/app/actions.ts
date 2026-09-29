'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { calculateProfit, profitInputSchema } from '@/lib/calc/profit';
import { scoreProduct, validationInputSchema } from '@/lib/score/rubric';
import { getPlans, getSettings } from '@/lib/data/settings';
import { env, siteUrl } from '@/lib/env';
import { createLemonCheckout } from '@/lib/billing/lemonsqueezy';
import { createPaddleCheckout } from '@/lib/billing/paddle';
import { clientIp, rateLimit } from '@/lib/ratelimit';

export type ActionState = { ok: boolean; message: string } | null;

async function signedIn() {
  const s = await getSession();
  if (!s.user || !s.profile || s.profile.banned) redirect('/login');
  return s as typeof s & { user: NonNullable<typeof s.user>; profile: NonNullable<typeof s.profile> };
}

// ───────── Saved products ─────────
export async function toggleSaved(productId: string): Promise<ActionState> {
  const s = await signedIn();
  const id = z.string().uuid().parse(productId);
  const db = supabaseAdmin();
  const { data: existing } = await db.from('saved_products').select('product_id').eq('user_id', s.user.id).eq('product_id', id).maybeSingle();
  if (existing) {
    await db.from('saved_products').delete().eq('user_id', s.user.id).eq('product_id', id);
    revalidatePath('/saved');
    return { ok: true, message: 'Removed from saved' };
  }
  const { count } = await db.from('saved_products').select('*', { count: 'exact', head: true }).eq('user_id', s.user.id);
  if ((count ?? 0) >= s.ent.limits.savedMax)
    return { ok: false, message: `Your plan saves up to ${s.ent.limits.savedMax} products. Upgrade to save more.` };
  const { error } = await db.from('saved_products').insert({ user_id: s.user.id, product_id: id });
  if (error) return { ok: false, message: 'Could not save. Try again.' };
  revalidatePath('/saved');
  return { ok: true, message: 'Saved' };
}

// ───────── Profit scenarios ─────────
export async function saveScenario(name: string, inputs: unknown, productId: string | null): Promise<ActionState> {
  const s = await signedIn();
  if (!s.ent.limits.calcSave) return { ok: false, message: 'Saving scenarios is a Pro feature.' };
  const parsed = profitInputSchema.safeParse(inputs);
  if (!parsed.success) return { ok: false, message: 'Some numbers are out of range.' };
  const title = z.string().trim().min(1).max(80).safeParse(name);
  const pid = productId ? z.string().uuid().safeParse(productId) : null;
  const { error } = await supabaseAdmin().from('calc_scenarios').insert({
    user_id: s.user.id,
    product_id: pid?.success ? pid.data : null,
    name: title.success ? title.data : 'Scenario',
    inputs: parsed.data,
    result: calculateProfit(parsed.data),
  });
  if (error) return { ok: false, message: 'Could not save scenario.' };
  revalidatePath('/saved');
  return { ok: true, message: 'Scenario saved' };
}

export async function deleteScenario(id: string) {
  const s = await signedIn();
  await supabaseAdmin().from('calc_scenarios').delete().eq('id', z.string().uuid().parse(id)).eq('user_id', s.user.id);
  revalidatePath('/saved');
}

// ───────── Product validation ─────────
export async function runValidation(_prev: ActionState, form: FormData): Promise<ActionState> {
  const s = await signedIn();
  const raw = Object.fromEntries(form.entries());
  const parsed = validationInputSchema.safeParse({
    ...raw,
    fragile: raw.fragile === 'on',
    batteryOrLiquid: raw.batteryOrLiquid === 'on',
    salesProof: raw.salesProof === 'on',
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ') };

  const db = supabaseAdmin();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count } = await db
    .from('usage_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', s.user.id)
    .eq('kind', 'validate')
    .gte('created_at', monthStart.toISOString());
  if ((count ?? 0) >= s.ent.limits.validationsPerMonth)
    return { ok: false, message: `You used all ${s.ent.limits.validationsPerMonth} validations this month. Upgrade for more.` };

  const result = scoreProduct(parsed.data);
  const { data, error } = await db
    .from('validations')
    .insert({ user_id: s.user.id, name: parsed.data.name, inputs: parsed.data, result })
    .select('id')
    .single();
  if (error || !data) return { ok: false, message: 'Could not save the report. Try again.' };
  await db.from('usage_events').insert({ user_id: s.user.id, kind: 'validate' });
  redirect(`/validate/${data.id}`);
}

export async function shareValidation(id: string): Promise<string | null> {
  const s = await signedIn();
  const db = supabaseAdmin();
  const vid = z.string().uuid().parse(id);
  const { data } = await db.from('validations').select('share_token').eq('id', vid).eq('user_id', s.user.id).maybeSingle();
  if (!data) return null;
  if (data.share_token) return siteUrl(`/r/${data.share_token}`);
  const token = randomBytes(12).toString('base64url');
  await db.from('validations').update({ share_token: token }).eq('id', vid).eq('user_id', s.user.id);
  return siteUrl(`/r/${token}`);
}

// ───────── Account ─────────
export async function updateMarketPref(form: FormData) {
  const s = await signedIn();
  const market = z.enum(['all', 'Global', 'Pakistan']).catch('all').parse(form.get('market'));
  const name = z.string().trim().max(80).catch('').parse(form.get('full_name'));
  await supabaseAdmin().from('profiles').update({ market_pref: market, full_name: name }).eq('id', s.user.id);
  revalidatePath('/account');
}

// ───────── Billing ─────────
export async function startCheckout(form: FormData) {
  const s = await signedIn();
  const planId = z.string().max(32).parse(form.get('plan'));
  const provider = z.enum(['lemonsqueezy', 'paddle']).parse(form.get('provider'));
  const [plans, settings] = await Promise.all([getPlans(), getSettings()]);
  const plan = plans.find((p) => p.id === planId && p.id !== 'free');
  if (!plan) redirect('/pricing?error=plan');
  const e = env();
  const args = { userId: s.user.id, email: s.user.email, planId: plan.id, redirectUrl: siteUrl('/account?paid=1') };
  let url: string;
  try {
    if (provider === 'lemonsqueezy') {
      if (!settings.features.lemonsqueezy || !plan.lemon_variant_id || !e.LEMONSQUEEZY_API_KEY || !e.LEMONSQUEEZY_STORE_ID) throw new Error('not configured');
      url = await createLemonCheckout({ ...args, variantId: plan.lemon_variant_id }, e.LEMONSQUEEZY_API_KEY, e.LEMONSQUEEZY_STORE_ID);
    } else {
      if (!settings.features.paddle || !plan.paddle_price_id || !e.PADDLE_API_KEY) throw new Error('not configured');
      url = await createPaddleCheckout({ ...args, priceId: plan.paddle_price_id }, e.PADDLE_API_KEY, e.PADDLE_SANDBOX === 'true');
    }
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'checkout failed', provider, plan: plan.id, error: String(err) }));
    redirect('/pricing?error=checkout');
  }
  redirect(url);
}

const manualSchema = z.object({
  plan: z.string().max(32),
  months: z.coerce.number().int().min(1).max(12),
  method: z.enum(['jazzcash', 'easypaisa', 'bank']),
  txn_ref: z.string().trim().min(4).max(64).regex(/^[A-Za-z0-9\-_/ ]+$/, 'Letters and numbers only'),
  payer_name: z.string().trim().min(2).max(80),
  payer_phone: z.string().trim().min(7).max(20).regex(/^[0-9+ \-]+$/),
});

const PROOF_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' };

export async function submitManualPayment(_prev: ActionState, form: FormData): Promise<ActionState> {
  const s = await signedIn();
  if (!rateLimit(`manual:${s.user.id}:${clientIp(await headers())}`, 5, 3_600_000))
    return { ok: false, message: 'Too many submissions. Try again in an hour.' };
  const settings = await getSettings();
  if (!settings.features.manualPayments) return { ok: false, message: 'Manual payments are turned off.' };
  const parsed = manualSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ') };
  const d = parsed.data;
  if (!settings.payments[d.method].enabled) return { ok: false, message: 'That payment method is not available.' };
  const plan = (await getPlans()).find((p) => p.id === d.plan && p.id !== 'free');
  if (!plan || plan.price_pkr <= 0) return { ok: false, message: 'Choose a paid plan.' };

  const file = form.get('proof');
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Attach a screenshot of your payment.' };
  if (file.size > 5 * 1024 * 1024) return { ok: false, message: 'Screenshot must be under 5 MB.' };
  const ext = PROOF_TYPES[file.type];
  if (!ext) return { ok: false, message: 'Upload a PNG, JPG, WEBP or PDF.' };

  const db = supabaseAdmin();
  const { count } = await db.from('manual_payments').select('*', { count: 'exact', head: true }).eq('user_id', s.user.id).eq('status', 'pending');
  if ((count ?? 0) >= 3) return { ok: false, message: 'You already have payments waiting for review.' };

  const path = `${s.user.id}/${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`;
  const up = await db.storage.from('payment-proofs').upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) return { ok: false, message: 'Upload failed. Try again.' };

  const { error } = await db.from('manual_payments').insert({
    user_id: s.user.id,
    plan_id: plan.id,
    months: d.months,
    method: d.method,
    amount: plan.price_pkr * d.months,
    currency: 'PKR',
    txn_ref: d.txn_ref,
    payer_name: d.payer_name,
    payer_phone: d.payer_phone,
    proof_path: path,
  });
  if (error) {
    await db.storage.from('payment-proofs').remove([path]);
    return { ok: false, message: error.code === '23505' ? 'This transaction ID was already submitted.' : 'Could not submit. Try again.' };
  }
  revalidatePath('/account');
  return { ok: true, message: 'Payment submitted! We’ll activate your plan after checking it — usually within a few hours.' };
}
