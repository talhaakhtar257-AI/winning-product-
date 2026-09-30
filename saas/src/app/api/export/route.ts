import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { filtersSchema, listProducts, PAGE_SIZE } from '@/lib/data/products';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { toCsv } from '@/lib/csv';
import { rateLimit } from '@/lib/ratelimit';

const COLUMNS = ['last_seen', 'name', 'market', 'niche', 'score', 'verdict', 'trend', 'competition', 'proof_level', 'currency', 'cost', 'price', 'markup', 'audience', 'why', 'risk', 'ad_idea', 'where_to_sell', 'supplier', 'source', 'image', 'days_seen', 'first_seen'];

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s.user) return NextResponse.redirect(new URL('/login?next=/products', req.url));
  if (!s.ent.limits.export) return NextResponse.redirect(new URL('/pricing', req.url));
  if (!rateLimit(`export:${s.user.id}`, 20, 3_600_000)) return NextResponse.json({ error: 'Export limit reached, try later' }, { status: 429 });

  const base = filtersSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const rows: Record<string, unknown>[] = [];
  for (let page = 1; page <= 200; page++) {
    const r = await listProducts({ ...base, page }, s.ent);
    rows.push(...(r.items as unknown as Record<string, unknown>[]));
    if (r.items.length < PAGE_SIZE || page >= r.pages) break;
  }
  await supabaseAdmin().from('usage_events').insert({ user_id: s.user.id, kind: 'export' });
  return new NextResponse(toCsv(rows, COLUMNS), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="winning-products-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
