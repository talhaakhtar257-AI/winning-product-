import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { hasRole } from '@/lib/entitlements';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { fmtDate, money } from '@/lib/format';
import { runExpiryNow } from './actions';

interface Metrics {
  users: number; signups7: number; signups30: number; paid: number; paidBySource: Record<string, number>;
  mrrUsd: number; manualPkr30: number; churn30: number; pendingPayments: number; products: number; productsToday: number;
  lastIngest: { source: string; received: number; inserted: number; updated: number; error: string | null; created_at: string } | null;
}

export default async function AdminDashboard() {
  const s = await requireRole('staff');
  const db = supabaseAdmin();
  const [{ data: m }, { data: recent }] = await Promise.all([
    db.rpc('admin_metrics'),
    db.from('profiles').select('id, email, plan_id, created_at').order('created_at', { ascending: false }).limit(8),
  ]);
  const x = (m ?? {}) as Metrics;
  const conv = x.users ? Math.round((x.paid / x.users) * 1000) / 10 : 0;
  const stale = x.lastIngest ? Date.now() - Date.parse(x.lastIngest.created_at) > 36 * 3_600_000 : true;

  return (
    <>
      <h1>Dashboard</h1>
      {x.pendingPayments > 0 && (
        <div className="alert warn row between">
          <span><strong>{x.pendingPayments}</strong> manual payment(s) waiting for review.</span>
          <Link className="btn sm" href="/admin/payments">Review now</Link>
        </div>
      )}
      {(stale || x.lastIngest?.error) && (
        <div className="alert bad">
          Product feed problem: {x.lastIngest?.error ? `last import failed — ${x.lastIngest.error}` : 'no successful import in the last 36 hours'}. Check the Make.com scenario.
        </div>
      )}
      <div className="grid grid-4">
        <Stat k="Card MRR" v={money(x.mrrUsd, 'USD')} />
        <Stat k="Manual (PKR, 30d)" v={money(x.manualPkr30, 'PKR')} />
        <Stat k="Paying users" v={String(x.paid ?? 0)} sub={Object.entries(x.paidBySource ?? {}).map(([k, v]) => `${k}: ${v}`).join(' · ')} />
        <Stat k="Free → paid" v={`${conv}%`} />
        <Stat k="Users" v={String(x.users ?? 0)} sub={`+${x.signups7 ?? 0} this week · +${x.signups30 ?? 0} in 30d`} />
        <Stat k="Churned (30d)" v={String(x.churn30 ?? 0)} />
        <Stat k="Products" v={String(x.products ?? 0)} sub={`${x.productsToday ?? 0} on the latest day`} />
        <Stat k="Last import" v={x.lastIngest ? fmtDate(x.lastIngest.created_at) : 'never'} sub={x.lastIngest ? `${x.lastIngest.source}: +${x.lastIngest.inserted} new, ${x.lastIngest.updated} updated` : ''} />
      </div>
      <section className="card">
        <div className="panel-title"><h2 style={{ margin: 0 }}>Newest users</h2><Link href="/admin/users">All users →</Link></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Email</th><th>Plan</th><th>Joined</th></tr></thead>
            <tbody>
              {(recent ?? []).map((u) => (
                <tr key={u.id}><td><Link href={`/admin/users/${u.id}`}>{u.email}</Link></td><td>{u.plan_id}</td><td>{fmtDate(u.created_at)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {hasRole(s.profile.role, 'admin') && (
        <section className="card row between">
          <span>Expired plans are downgraded daily at 01:15 UTC automatically.</span>
          <form action={runExpiryNow}><button className="btn sm" type="submit">Run expiry now</button></form>
        </section>
      )}
    </>
  );
}

function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {sub && <div className="small muted">{sub}</div>}
    </div>
  );
}
