import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { extractItems, ingestProducts } from '@/lib/products/ingest';
import { clientIp, rateLimit } from '@/lib/ratelimit';

// Make.com (or any automation) posts the daily products here:
//   POST /api/ingest   Authorization: Bearer <INGEST_SECRET>
//   body: {"products":[…]} | […] | {single product}
export async function POST(req: NextRequest) {
  if (!rateLimit(`ingest:${clientIp(req.headers)}`, 30, 60_000)) return NextResponse.json({ error: 'rate limited' }, { status: 429 });
  const secret = env().INGEST_SECRET;
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret)))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const raw = await req.text();
  if (raw.length > 5_000_000) return NextResponse.json({ error: 'payload too large' }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const items = extractItems(body);
  if (!items.length) return NextResponse.json({ error: 'no products in body' }, { status: 400 });
  if (items.length > 2000) return NextResponse.json({ error: 'max 2000 products per request' }, { status: 413 });
  try {
    const result = await ingestProducts(supabaseAdmin(), items, 'make');
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', msg: 'ingest failed', error: String(e) }));
    return NextResponse.json({ error: 'ingest failed' }, { status: 500 });
  }
}
