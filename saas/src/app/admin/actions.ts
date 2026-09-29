'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { limitsSchema } from '@/lib/entitlements';
import { settingsSchemas, type SettingsKey } from '@/lib/settings';
import { ingestProducts } from '@/lib/products/ingest';

export type AdminState = { ok: boolean; message: string } | null;
const uuid = z.string().uuid();
const fail = (e: unknown): AdminState => ({ ok: false, message: e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ') : e instanceof Error ? e.message : 'Failed' });

// ───────── Users (admin+) ─────────
const userPlanSchema = z.object({
  id: uuid,
  plan_id: z.string().max(32),
  plan_status: z.enum(['active', 'trialing', 'past_due', 'cancelled', 'expired']),
  plan_source: z.enum(['free', 'lemonsqueezy', 'paddle', 'manual', 'comp']),
  plan_expires_at: z.string().max(10).optional(),
});

export async function updateUserPlan(_p: AdminState, form: FormData): Promise<AdminState> {
  try {
    const s = await assertRole('admin');
    const d = userPlanSchema.parse(Object.fromEntries(form.entries()));
    const expires = d.plan_expires_at ? new Date(d.plan_expires_at + 'T23:59:59Z').toISOString() : null;
    const { error } = await supabaseAdmin()
      .from('profiles')
      .update({ plan_id: d.plan_id, plan_status: d.plan_status, plan_source: d.plan_id === 'free' ? 'free' : d.plan_source, plan_expires_at: d.plan_id === 'free' ? null : expires })
      .eq('id', d.id);
    if (error) throw new Error(error.message);
    await audit(s.user.id, 'user.plan', 'profile', d.id, { ...d, plan_expires_at: expires });
    revalidatePath(`/admin/users/${d.id}`);
    return { ok: true, message: 'Plan updated' };
  } catch (e) {
    return fail(e);
  }
}

export async function setBanned(id: string, banned: boolean) {
  const s = await assertRole('admin');
  uuid.parse(id);
  if (id === s.user.id) throw new Error('You cannot ban yourself');
  const { data: target } = await supabaseAdmin().from('profiles').select('role').eq('id', id).single();
  if (target?.role === 'owner') throw new Error('Owners cannot be banned');
  await supabaseAdmin().from('profiles').update({ banned }).eq('id', id);
  await audit(s.user.id, banned ? 'user.ban' : 'user.unban', 'profile', id);
  revalidatePath(`/admin/users/${id}`);
}

export async function setRole(_p: AdminState, form: FormData): Promise<AdminState> {
  try {
    const s = await assertRole('owner');
    const id = uuid.parse(form.get('id'));
    const role = z.enum(['user', 'staff', 'admin', 'owner']).parse(form.get('role'));
    if (id === s.user.id && role !== 'owner') {
      const { count } = await supabaseAdmin().from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'owner');
      if ((count ?? 0) <= 1) return { ok: false, message: 'You are the only owner — promote someone else first.' };
    }
    await supabaseAdmin().from('profiles').update({ role }).eq('id', id);
    await audit(s.user.id, 'user.role', 'profile', id, { role });
    revalidatePath(`/admin/users/${id}`);
    return { ok: true, message: 'Role updated' };
  } catch (e) {
    return fail(e);
  }
}

// ───────── Manual payments (staff+) ─────────
export async function reviewPayment(_p: AdminState, form: FormData): Promise<AdminState> {
  let done: string;
  try {
    const s = await assertRole('staff');
    const id = uuid.parse(form.get('id'));
    const decision = z.enum(['approve', 'reject']).parse(form.get('decision'));
    const note = z.string().trim().max(300).catch('').parse(form.get('note'));
    const db = supabaseAdmin();
    // Atomic claim: only a still-pending payment can be reviewed (no double approval).
    const { data: pay, error } = await db
      .from('manual_payments')
      .update({ status: decision === 'approve' ? 'approved' : 'rejected', note, reviewed_by: s.user.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pay) return { ok: false, message: 'Already reviewed' };

    if (decision === 'approve') {
      const { data: prof } = await db.from('profiles').select('plan_id, plan_expires_at, plan_source').eq('id', pay.user_id).single();
      // Extend from the current expiry when renewing the same plan early.
      const now = Date.now();
      const current = prof && prof.plan_id === pay.plan_id && prof.plan_expires_at ? new Date(prof.plan_expires_at).getTime() : 0;
      const start = new Date(Math.max(now, current));
      start.setUTCMonth(start.getUTCMonth() + pay.months);
      await db.from('profiles').update({ plan_id: pay.plan_id, plan_status: 'active', plan_source: 'manual', plan_expires_at: start.toISOString() }).eq('id', pay.user_id);
    }
    await audit(s.user.id, `payment.${decision}`, 'manual_payment', id, { user: pay.user_id, plan: pay.plan_id, months: pay.months, amount: pay.amount, note });
    revalidatePath('/admin');
    done = decision === 'approve' ? 'approved' : 'rejected';
  } catch (e) {
    return fail(e);
  }
  // The reviewed card leaves the pending list, so confirm with a banner instead of inline text.
  redirect(`/admin/payments?done=${done}`);
}

// ───────── Products CMS (staff+) ─────────
const productEditSchema = z.object({
  id: uuid,
  name: z.string().trim().min(2).max(120),
  niche: z.string().trim().max(60),
  score: z.coerce.number().int().min(0).max(100),
  verdict: z.enum(['', 'Winner', 'Promising', 'Risky', 'Skip']),
  trend: z.enum(['', 'Hot', 'Rising', 'Stable', 'Falling']),
  competition: z.enum(['', 'Low', 'Medium', 'High']),
  price: z.coerce.number().min(0).max(10_000_000),
  cost: z.coerce.number().min(0).max(10_000_000),
  why: z.string().trim().max(600),
  risk: z.string().trim().max(400),
  ad_idea: z.string().trim().max(400),
  audience: z.string().trim().max(200),
  where_to_sell: z.string().trim().max(200),
  image: z.union([z.literal(''), z.string().url().startsWith('https://')]),
  supplier: z.union([z.literal(''), z.string().url().startsWith('https://')]),
  source: z.union([z.literal(''), z.string().url().startsWith('https://')]),
  admin_notes: z.string().trim().max(1000),
  hidden: z.coerce.boolean(),
  featured: z.coerce.boolean(),
});

export async function updateProduct(_p: AdminState, form: FormData): Promise<AdminState> {
  try {
    const s = await assertRole('staff');
    const raw = Object.fromEntries(form.entries());
    const d = productEditSchema.parse({ ...raw, hidden: raw.hidden === 'on', featured: raw.featured === 'on' });
    const { id, ...fields } = d;
    const { error } = await supabaseAdmin()
      .from('products')
      .update({
        ...fields,
        price: fields.price || null,
        cost: fields.cost || null,
        markup: fields.price && fields.cost ? Math.round((fields.price / fields.cost) * 100) / 100 : null,
        image: fields.image || null,
        supplier: fields.supplier || null,
        source: fields.source || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
    await audit(s.user.id, 'product.update', 'product', id, { name: d.name, hidden: d.hidden, featured: d.featured });
    revalidatePath('/admin/products');
    return { ok: true, message: 'Saved' };
  } catch (e) {
    return fail(e);
  }
}

export async function bulkProducts(form: FormData) {
  const s = await assertRole('staff');
  const ids = z.array(uuid).max(500).parse(form.getAll('ids'));
  const op = z.enum(['hide', 'show', 'feature', 'unfeature', 'delete']).parse(form.get('op'));
  if (!ids.length) return;
  const db = supabaseAdmin().from('products');
  if (op === 'delete') {
    await assertRole('admin');
    await db.delete().in('id', ids);
  } else {
    const patch = op === 'hide' ? { hidden: true } : op === 'show' ? { hidden: false } : { featured: op === 'feature' };
    await db.update(patch).in('id', ids);
  }
  await audit(s.user.id, `product.bulk.${op}`, 'product', '', { ids });
  revalidatePath('/admin/products');
}

export async function addProductManually(_p: AdminState, form: FormData): Promise<AdminState> {
  try {
    const s = await assertRole('staff');
    const raw = Object.fromEntries(form.entries());
    const res = await ingestProducts(supabaseAdmin(), [{ ...raw, date: new Date().toISOString().slice(0, 10) }], `manual:${s.user.id}`);
    if (!res.valid) return { ok: false, message: 'Name is required' };
    await audit(s.user.id, 'product.create', 'product', '', { name: raw.name });
    revalidatePath('/admin/products');
    return { ok: true, message: res.inserted ? 'Product added' : 'Product already existed — updated it' };
  } catch (e) {
    return fail(e);
  }
}

export async function addCompetitor(_p: AdminState, form: FormData): Promise<AdminState> {
  try {
    const s = await assertRole('staff');
    const d = z
      .object({
        product_id: uuid,
        kind: z.enum(['store', 'ad', 'video', 'listing']),
        url: z.string().url().startsWith('https://'),
        title: z.string().trim().max(120),
        note: z.string().trim().max(300),
      })
      .parse(Object.fromEntries(form.entries()));
    const { error } = await supabaseAdmin().from('competitors').insert({ ...d, created_by: s.user.id });
    if (error) throw new Error(error.message);
    await audit(s.user.id, 'competitor.add', 'product', d.product_id, { url: d.url });
    revalidatePath(`/admin/products/${d.product_id}`);
    return { ok: true, message: 'Competitor added' };
  } catch (e) {
    return fail(e);
  }
}

export async function removeCompetitor(id: string, productId: string) {
  const s = await assertRole('staff');
  await supabaseAdmin().from('competitors').delete().eq('id', uuid.parse(id));
  await audit(s.user.id, 'competitor.remove', 'product', productId, { id });
  revalidatePath(`/admin/products/${productId}`);
}

// ───────── Plans & pricing (admin+) ─────────
export async function savePlan(_p: AdminState, form: FormData): Promise<AdminState> {
  try {
    const s = await assertRole('admin');
    const raw = Object.fromEntries(form.entries()) as Record<string, string>;
    const limits = limitsSchema.parse({
      historyDays: raw.historyDays,
      maxProducts: raw.maxProducts,
      savedMax: raw.savedMax,
      validationsPerMonth: raw.validationsPerMonth,
      fullDetails: raw.fullDetails === 'on',
      trendHistory: raw.trendHistory === 'on',
      competitors: raw.competitors === 'on',
      export: raw.export === 'on',
      calcSave: raw.calcSave === 'on',
    });
    const d = z
      .object({
        id: z.string().regex(/^[a-z0-9_-]{2,32}$/, 'lowercase letters, numbers, - or _'),
        name: z.string().trim().min(1).max(40),
        description: z.string().trim().max(200),
        price_usd: z.coerce.number().min(0).max(100000),
        price_pkr: z.coerce.number().int().min(0).max(10_000_000),
        interval: z.enum(['month', 'year']),
        sort: z.coerce.number().int().min(0).max(100),
        lemon_variant_id: z.string().trim().max(40),
        paddle_price_id: z.string().trim().max(60),
        features: z.string().max(3000),
      })
      .parse(raw);
    if (d.id === 'free' && (d.price_usd > 0 || d.price_pkr > 0)) return { ok: false, message: 'The free plan must stay at 0.' };
    const { error } = await supabaseAdmin()
      .from('plans')
      .upsert({
        ...d,
        lemon_variant_id: d.lemon_variant_id || null,
        paddle_price_id: d.paddle_price_id || null,
        features: d.features.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20),
        limits,
        active: d.id === 'free' ? true : raw.active === 'on',
        highlighted: raw.highlighted === 'on',
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    await audit(s.user.id, 'plan.save', 'plan', d.id, { price_usd: d.price_usd, price_pkr: d.price_pkr, limits });
    revalidatePath('/admin/plans');
    revalidatePath('/pricing');
    return { ok: true, message: `Plan “${d.name}” saved` };
  } catch (e) {
    return fail(e);
  }
}

// ───────── Design & site settings (admin+) ─────────
export async function saveSettings(_p: AdminState, form: FormData): Promise<AdminState> {
  try {
    const s = await assertRole('admin');
    const key = z.enum(Object.keys(settingsSchemas) as [SettingsKey, ...SettingsKey[]]).parse(form.get('__key'));
    const value = settingsSchemas[key].parse(formToSettings(key, form));
    const { error } = await supabaseAdmin().from('site_settings').upsert({ key, value, updated_at: new Date().toISOString(), updated_by: s.user.id });
    if (error) throw new Error(error.message);
    await audit(s.user.id, 'settings.save', 'settings', key, { value });
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Saved — live on the site now' };
  } catch (e) {
    return fail(e);
  }
}

function formToSettings(key: SettingsKey, form: FormData): unknown {
  const g = (k: string) => String(form.get(k) ?? '');
  const on = (k: string) => form.get(k) === 'on';
  switch (key) {
    case 'brand':
      return { name: g('name'), tagline: g('tagline'), logoUrl: g('logoUrl'), supportEmail: g('supportEmail'), whatsapp: g('whatsapp') };
    case 'theme':
      return { brand: g('brand'), accent: g('accent'), good: g('good'), bad: g('bad'), radius: g('radius') };
    case 'landing': {
      const faq = g('faq')
        .split(/\n\s*\n/)
        .map((block) => {
          const [q, ...a] = block.trim().split('\n');
          return { q: (q ?? '').replace(/^Q:\s*/i, '').trim(), a: a.join(' ').replace(/^A:\s*/i, '').trim() };
        })
        .filter((x) => x.q && x.a);
      return { heroTitle: g('heroTitle'), heroSubtitle: g('heroSubtitle'), ctaLabel: g('ctaLabel'), announcement: g('announcement'), faq };
    }
    case 'payments':
      return {
        jazzcash: { enabled: on('jazzcash.enabled'), title: g('jazzcash.title'), number: g('jazzcash.number') },
        easypaisa: { enabled: on('easypaisa.enabled'), title: g('easypaisa.title'), number: g('easypaisa.number') },
        bank: { enabled: on('bank.enabled'), bank: g('bank.bank'), title: g('bank.title'), iban: g('bank.iban') },
        instructions: g('instructions'),
      };
    case 'features':
      return Object.fromEntries(Object.keys(settingsSchemas.features.shape).map((k) => [k, on(k)]));
  }
}

export async function runExpiryNow() {
  const s = await assertRole('admin');
  const { data } = await supabaseAdmin()
    .from('profiles')
    .update({ plan_id: 'free', plan_status: 'active', plan_source: 'free', plan_expires_at: null })
    .neq('plan_id', 'free')
    .lt('plan_expires_at', new Date().toISOString())
    .select('id');
  await audit(s.user.id, 'cron.expire.manual', 'profiles', '', { count: data?.length ?? 0 });
  revalidatePath('/admin');
}

export async function goToUser(form: FormData) {
  await assertRole('staff');
  const q = z.string().trim().max(120).parse(form.get('q') ?? '');
  redirect(`/admin/users?q=${encodeURIComponent(q)}`);
}
