import 'server-only';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { redactProduct, type Entitlements } from '@/lib/entitlements';
import type { ScorePart } from '@/lib/products/normalize';

export interface Product {
  id: string;
  slug: string;
  name: string;
  keyword: string;
  market: 'Global' | 'Pakistan';
  niche: string;
  currency: 'USD' | 'PKR';
  cost: number | null;
  price: number | null;
  markup: number | null;
  score: number;
  verdict: string;
  trend: string;
  competition: string;
  proof_level: string;
  score_details: string | null;
  score_parts: ScorePart[];
  why: string;
  risk: string | null;
  ad_idea: string | null;
  audience: string | null;
  where_to_sell: string | null;
  image: string | null;
  source: string | null;
  supplier: string | null;
  first_seen: string;
  last_seen: string;
  days_seen: number;
  featured: boolean;
  locked?: boolean;
}

export const filtersSchema = z.object({
  market: z.enum(['all', 'Global', 'Pakistan']).catch('all'),
  niche: z.string().max(60).catch('all'),
  q: z.string().max(80).catch(''),
  verdict: z.enum(['all', 'Winner', 'Promising']).catch('all'),
  trend: z.enum(['all', 'Hot', 'Rising', 'Stable', 'Falling']).catch('all'),
  competition: z.enum(['all', 'Low', 'Medium', 'High']).catch('all'),
  proof: z.enum(['all', 'hard', 'popular', 'opinion']).catch('all'),
  minMarkup: z.coerce.number().min(0).max(20).catch(0),
  day: z.string().regex(/^(latest|all|\d{4}-\d{2}-\d{2})$/).catch('latest'),
  sort: z.enum(['score', 'new', 'markup', 'price-asc', 'price-desc']).catch('score'),
  page: z.coerce.number().int().min(1).max(500).catch(1),
});
export type Filters = z.infer<typeof filtersSchema>;

export const PAGE_SIZE = 24;
const FIELDS =
  'id, slug, name, keyword, market, niche, currency, cost, price, markup, score, verdict, trend, competition, proof_level, score_details, score_parts, why, risk, ad_idea, audience, where_to_sell, image, source, supplier, first_seen, last_seen, days_seen, featured';

export async function latestDate(): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from('products')
    .select('last_seen')
    .eq('hidden', false)
    .order('last_seen', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.last_seen ?? null;
}

function minDateFor(latest: string, historyDays: number): string {
  const d = new Date(latest + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - (historyDays - 1));
  return d.toISOString().slice(0, 10);
}

export interface ListResult {
  items: Product[];
  total: number; // matches the user can see
  lockedCount: number; // matches hidden behind the plan
  latest: string | null;
  minDate: string | null;
  page: number;
  pages: number;
}

export async function listProducts(f: Filters, ent: Entitlements): Promise<ListResult> {
  const latest = await latestDate();
  if (!latest) return { items: [], total: 0, lockedCount: 0, latest: null, minDate: null, page: 1, pages: 0 };
  const minDate = minDateFor(latest, ent.limits.historyDays);

  const build = (restrictHistory: boolean) => {
    let q = supabaseAdmin().from('products').select(FIELDS, { count: 'exact' }).eq('hidden', false);
    if (f.day === 'latest') q = q.eq('last_seen', latest);
    else if (f.day !== 'all') q = q.eq('last_seen', f.day);
    if (restrictHistory) q = q.gte('last_seen', minDate);
    if (f.market !== 'all') q = q.eq('market', f.market);
    if (f.niche !== 'all') q = q.eq('niche', f.niche);
    if (f.verdict !== 'all') q = q.eq('verdict', f.verdict);
    if (f.trend !== 'all') q = q.eq('trend', f.trend);
    if (f.competition !== 'all') q = q.eq('competition', f.competition);
    if (f.proof !== 'all') q = q.eq('proof_level', f.proof);
    if (f.minMarkup > 0) q = q.gte('markup', f.minMarkup);
    if (f.q) {
      const term = f.q.replace(/[%_,()\\]/g, ' ').trim();
      if (term) q = q.or(`name.ilike.%${term}%,niche.ilike.%${term}%,keyword.ilike.%${term}%,audience.ilike.%${term}%`);
    }
    return q;
  };

  const cap = ent.limits.maxProducts;
  const from = (f.page - 1) * PAGE_SIZE;
  const to = Math.min(from + PAGE_SIZE, cap) - 1;

  let q = build(true).order('featured', { ascending: false });
  if (f.sort === 'new') q = q.order('last_seen', { ascending: false }).order('score', { ascending: false });
  else if (f.sort === 'markup') q = q.order('markup', { ascending: false, nullsFirst: false });
  else if (f.sort === 'price-asc') q = q.order('price', { ascending: true, nullsFirst: false });
  else if (f.sort === 'price-desc') q = q.order('price', { ascending: false, nullsFirst: false });
  else q = q.order('score', { ascending: false });
  q = q.order('id');

  const { data, count, error } = to >= from ? await q.range(from, to) : { data: [], count: 0, error: null };
  if (error) throw new Error(error.message);

  // How many matches exist beyond the plan (for the upgrade prompt).
  const { count: allCount } = await build(false).range(0, 0);
  const visible = Math.min(count ?? 0, cap);
  const items = (data ?? []).map((p) => redactProduct(p as unknown as Product, ent.limits));
  return {
    items,
    total: visible,
    lockedCount: Math.max(0, (allCount ?? 0) - visible),
    latest,
    minDate,
    page: f.page,
    pages: Math.ceil(visible / PAGE_SIZE),
  };
}

export async function listNiches(): Promise<string[]> {
  const { data } = await supabaseAdmin().from('products').select('niche').eq('hidden', false).limit(5000);
  return [...new Set((data ?? []).map((r) => r.niche as string))].sort();
}

export async function listDays(ent: Entitlements): Promise<string[]> {
  const latest = await latestDate();
  if (!latest) return [];
  const { data } = await supabaseAdmin()
    .from('product_snapshots')
    .select('date')
    .gte('date', minDateFor(latest, Math.min(ent.limits.historyDays, 60)))
    .order('date', { ascending: false })
    .limit(5000);
  return [...new Set((data ?? []).map((r) => r.date as string))];
}

export interface ProductDetail {
  product: Product;
  outOfPlan: boolean;
  snapshots: { date: string; score: number; price: number | null; competition: string; trend: string }[];
  competitors: { id: string; kind: string; url: string; title: string; note: string }[];
}

export async function getProduct(slug: string, ent: Entitlements): Promise<ProductDetail | null> {
  const db = supabaseAdmin();
  const { data } = await db.from('products').select(FIELDS).eq('slug', slug).eq('hidden', false).maybeSingle();
  if (!data) return null;
  const raw = data as unknown as Product;
  const latest = (await latestDate()) ?? raw.last_seen;
  const outOfPlan = raw.last_seen < minDateFor(latest, ent.limits.historyDays);

  const [snaps, comps] = await Promise.all([
    ent.limits.trendHistory && !outOfPlan
      ? db.from('product_snapshots').select('date, score, price, competition, trend').eq('product_id', raw.id).order('date').limit(400)
      : Promise.resolve({ data: [] }),
    ent.limits.competitors && !outOfPlan
      ? db.from('competitors').select('id, kind, url, title, note').eq('product_id', raw.id).order('created_at')
      : Promise.resolve({ data: [] }),
  ]);
  const product = outOfPlan ? redactProduct(raw, { ...ent.limits, fullDetails: false }) : redactProduct(raw, ent.limits);
  return {
    product,
    outOfPlan,
    snapshots: ((snaps.data ?? []) as ProductDetail['snapshots']).map((s) => ({ ...s, price: s.price === null ? null : Number(s.price) })),
    competitors: (comps.data ?? []) as ProductDetail['competitors'],
  };
}
