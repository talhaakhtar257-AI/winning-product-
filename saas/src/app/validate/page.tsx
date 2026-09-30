import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getSettings } from '@/lib/data/settings';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { fmtDate } from '@/lib/format';
import { ValidateForm } from './ValidateForm';

export const metadata: Metadata = { title: 'Validate a product idea' };

export default async function ValidatePage() {
  const settings = await getSettings();
  if (!settings.features.validator) notFound();
  const s = await requireUser('/validate');
  const db = supabaseAdmin();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [{ data: past }, { count }] = await Promise.all([
    db.from('validations').select('id, name, result, created_at').eq('user_id', s.user.id).order('created_at', { ascending: false }).limit(20),
    db.from('usage_events').select('*', { count: 'exact', head: true }).eq('user_id', s.user.id).eq('kind', 'validate').gte('created_at', monthStart.toISOString()),
  ]);
  const left = Math.max(0, s.ent.limits.validationsPerMonth - (count ?? 0));
  return (
    <div className="stack">
      <div>
        <h1>Validate your own product idea</h1>
        <p className="muted" style={{ maxWidth: '70ch' }}>
          Answer 12 quick questions. We score it on the same 9 criteria as the daily radar and tell you exactly what to fix before you buy stock.
          <strong> {left} validation(s) left this month.</strong>
        </p>
      </div>
      <ValidateForm defaultMarket={s.profile.market_pref === 'Pakistan' ? 'Pakistan' : 'Global'} />
      {past && past.length > 0 && (
        <section className="card">
          <h2>Your reports</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Product</th><th className="num">Score</th><th>Verdict</th><th>Date</th></tr></thead>
              <tbody>
                {past.map((v) => (
                  <tr key={v.id}>
                    <td><Link href={`/validate/${v.id}`}>{v.name}</Link></td>
                    <td className="num">{(v.result as { score: number }).score}</td>
                    <td>{(v.result as { verdict: string }).verdict}</td>
                    <td>{fmtDate(v.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
