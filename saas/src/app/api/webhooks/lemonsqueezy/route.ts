import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { verifyLemonSignature } from '@/lib/billing/signature';
import { parseLemonEvent } from '@/lib/billing/lemonsqueezy';
import { applySubscriptionEvent } from '@/lib/billing/apply';

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyLemonSignature(raw, req.headers.get('x-signature'), env().LEMONSQUEEZY_WEBHOOK_SECRET ?? ''))
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const sub = parseLemonEvent(payload, raw);
  if (!sub) return NextResponse.json({ ok: true, ignored: true });
  try {
    return NextResponse.json({ ok: true, outcome: await applySubscriptionEvent(sub, payload) });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', msg: 'lemonsqueezy webhook failed', error: String(e) }));
    return NextResponse.json({ error: 'processing failed' }, { status: 500 }); // provider retries
  }
}
