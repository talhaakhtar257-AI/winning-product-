import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSettings } from '@/lib/data/settings';
import { ValidationReport } from '@/components/ValidationReport';
import type { ValidationInput, ValidationResult } from '@/lib/score/rubric';

export const metadata: Metadata = { title: 'Product validation report', robots: { index: false } };

export default async function SharedReport({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(token)) notFound();
  const { data } = await supabaseAdmin().from('validations').select('inputs, result').eq('share_token', token).maybeSingle();
  if (!data) notFound();
  const s = await getSettings();
  return (
    <div className="stack">
      <ValidationReport input={data.inputs as ValidationInput} result={data.result as ValidationResult} />
      <div className="card row between">
        <span>Scored with {s.brand.name} — validate your own product ideas free.</span>
        <Link className="btn accent" href="/login">Try it free</Link>
      </div>
    </div>
  );
}
