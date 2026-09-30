import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { hasRole } from '@/lib/entitlements';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Short-lived signed link to a payment screenshot, staff only.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!hasRole(s.profile?.role, 'staff') || s.profile?.banned) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  const db = supabaseAdmin();
  const { data } = await db.from('manual_payments').select('proof_path').eq('id', id).maybeSingle();
  if (!data?.proof_path) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const signed = await db.storage.from('payment-proofs').createSignedUrl(data.proof_path, 120);
  if (!signed.data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.redirect(signed.data.signedUrl);
}
