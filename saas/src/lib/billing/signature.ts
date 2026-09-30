import { createHmac, timingSafeEqual } from 'node:crypto';

function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

export function hmacHex(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

/** Lemon Squeezy: `X-Signature` = hex HMAC-SHA256(raw body). */
export function verifyLemonSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  return safeEqualHex(signature.trim(), hmacHex(secret, rawBody));
}

/** Paddle Billing: `Paddle-Signature: ts=…;h1=…`, signed payload `${ts}:${body}`. */
export function verifyPaddleSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  now = Date.now(),
  toleranceSec = 300,
): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(';').map((kv) => {
      const [k, ...v] = kv.split('=');
      return [k.trim(), v.join('=').trim()];
    }),
  );
  const ts = Number(parts.ts);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > toleranceSec) return false;
  const signatures = header
    .split(';')
    .filter((kv) => kv.trim().startsWith('h1='))
    .map((kv) => kv.trim().slice(3));
  const expected = hmacHex(secret, `${parts.ts}:${rawBody}`);
  return signatures.some((s) => safeEqualHex(s, expected));
}
