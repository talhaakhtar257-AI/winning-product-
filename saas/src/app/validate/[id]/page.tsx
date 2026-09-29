import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ValidationReport } from '@/components/ValidationReport';
import type { ValidationInput, ValidationResult } from '@/lib/score/rubric';
import { ShareButton } from './ShareButton';

export default async function ValidationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const s = await requireUser(`/validate/${id}`);
  const { data } = await supabaseAdmin().from('validations').select('*').eq('id', id).eq('user_id', s.user.id).maybeSingle();
  if (!data) notFound();
  return (
    <div className="stack">
      <div className="row between">
        <Link href="/validate" className="small">← New validation</Link>
        <div className="row">
          <Link className="btn sm" href="/calculator">Check profit</Link>
          <ShareButton id={id} />
        </div>
      </div>
      <ValidationReport input={data.inputs as ValidationInput} result={data.result as ValidationResult} />
    </div>
  );
}
