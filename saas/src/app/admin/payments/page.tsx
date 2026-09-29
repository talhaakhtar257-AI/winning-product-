import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { fmtDate, money } from '@/lib/format';
import { ActionForm } from '@/components/ActionForm';
import { reviewPayment } from '../actions';

export default async function PaymentsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole('staff');
  const sp = await searchParams;
  const status = ['pending', 'approved', 'rejected'].includes(sp.status ?? '') ? sp.status! : 'pending';
  const db = supabaseAdmin();
  const [{ data: rows }, { data: subs }] = await Promise.all([
    db.from('manual_payments').select('*, profiles!manual_payments_user_id_fkey(email)').eq('status', status).order('created_at', { ascending: status !== 'pending' }).limit(100),
    db.from('subscriptions').select('*, profiles(email)').order('updated_at', { ascending: false }).limit(30),
  ]);
  return (
    <>
      <h1>Payments</h1>
      {sp.done === 'approved' && <div className="alert good" role="status">Approved — plan activated for the customer.</div>}
      {sp.done === 'rejected' && <div className="alert warn" role="status">Payment rejected. The customer sees your note on their account page.</div>}
      <div className="row">
        {['pending', 'approved', 'rejected'].map((st) => (
          <Link key={st} className={`btn sm${st === status ? ' primary' : ''}`} href={`/admin/payments?status=${st}`}>{st}</Link>
        ))}
      </div>
      {!rows?.length && <p className="muted">No {status} manual payments.</p>}
      <div className="stack">
        {rows?.map((p) => (
          <div key={p.id} className="card">
            <div className="row between">
              <div>
                <strong>{(p.profiles as unknown as { email: string } | null)?.email}</strong> · {p.plan_id} × {p.months} month(s)
                <div className="small muted">
                  {p.method} · Txn <code>{p.txn_ref}</code> · {p.payer_name} · {p.payer_phone} · submitted {fmtDate(p.created_at)}
                </div>
              </div>
              <div className="kpi" style={{ fontSize: '1.4rem' }}>{money(Number(p.amount), p.currency)}</div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              {p.proof_path && <a className="btn sm" href={`/api/admin/proof/${p.id}`} target="_blank" rel="noopener noreferrer">View screenshot ↗</a>}
              <Link className="btn sm" href={`/admin/users/${p.user_id}`}>User</Link>
            </div>
            {p.status === 'pending' ? (
              <div className="grid grid-2" style={{ marginTop: 12 }}>
                <ActionForm action={reviewPayment} submitLabel="Approve & activate" className="row">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="decision" value="approve" />
                </ActionForm>
                <ActionForm action={reviewPayment} submitLabel="Reject" className="row" confirm="Reject this payment?">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <input className="field" style={{ flex: 1 }} name="note" placeholder="Reason shown to the user" maxLength={300} />
                </ActionForm>
              </div>
            ) : (
              <p className="small muted" style={{ marginTop: 8 }}>Reviewed {fmtDate(p.reviewed_at)} {p.note && `— ${p.note}`}</p>
            )}
          </div>
        ))}
      </div>
      <section className="card">
        <h2>Card subscriptions</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>User</th><th>Provider</th><th>Plan</th><th>Status</th><th>Period end</th><th>Updated</th></tr></thead>
            <tbody>
              {subs?.map((x) => (
                <tr key={x.id}>
                  <td><Link href={`/admin/users/${x.user_id}`}>{(x.profiles as unknown as { email: string } | null)?.email}</Link></td>
                  <td>{x.provider}</td><td>{x.plan_id}</td>
                  <td><span className={`badge ${x.status === 'active' ? 'good' : x.status === 'past_due' ? 'warn' : ''}`}>{x.status}{x.cancel_at_period_end ? ' (cancelling)' : ''}</span></td>
                  <td>{fmtDate(x.current_period_end)}</td><td>{fmtDate(x.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
