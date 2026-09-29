import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { verifyPaddleSignature } from '@/lib/billing/signature';
import { parsePaddleEvent } from '@/lib/billing/paddle';
import { applySubscriptionEvent } from '@/lib/billing/apply';

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyPaddleSignature(raw, req.headers.get('paddle-signature'), env().PADDLE_WEBHOOK_SECRET ?? ''))
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const sub = parsePaddleEvent(payload);
  if (!sub) return NextResponse.json({ ok: true, ignored: true });
  try {
    return NextResponse.json({ ok: true, outcome: await applySubscriptionEvent(sub, payload) });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', msg: 'paddle webhook failed', error: String(e) }));
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}
