import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { hasRole } from '@/lib/entitlements';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPlans } from '@/lib/data/settings';
import { fmtDate, money } from '@/lib/format';
import { ActionForm } from '@/components/ActionForm';
import { setBanned, setRole, updateUserPlan } from '../../actions';

export default async function UserAdmin({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole('staff');
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const db = supabaseAdmin();
  const [{ data: u }, plans, { data: subs }, { data: pays }, { data: usage }, { count: saved }, { count: validations }] = await Promise.all([
    db.from('profiles').select('*').eq('id', id).maybeSingle(),
    getPlans(true),
    db.from('subscriptions').select('*').eq('user_id', id).order('updated_at', { ascending: false }),
    db.from('manual_payments').select('*').eq('user_id', id).order('created_at', { ascending: false }),
    db.from('audit_log').select('action, details, created_at').eq('target_id', id).order('created_at', { ascending: false }).limit(20),
    db.from('saved_products').select('*', { count: 'exact', head: true }).eq('user_id', id),
    db.from('validations').select('*', { count: 'exact', head: true }).eq('user_id', id),
  ]);
  if (!u) notFound();
  const isAdmin = hasRole(s.profile.role, 'admin');
  const isOwner = s.profile.role === 'owner';

  return (
    <>
      <Link href="/admin/users" className="small">← Users</Link>
      <div className="row between">
        <div>
          <h1 style={{ marginBottom: 4 }}>{u.email}</h1>
          <div className="muted small">{u.full_name || 'No name'} · joined {fmtDate(u.created_at)} · role {u.role} · {saved ?? 0} saved · {validations ?? 0} validations</div>
        </div>
        {u.banned && <span className="badge bad">Banned</span>}
      </div>

      <div className="grid grid-2">
        <section className="card">
          <h2>Plan & access</h2>
          {isAdmin ? (
            <ActionForm action={updateUserPlan} submitLabel="Update plan">
              <input type="hidden" name="id" value={u.id} />
              <div className="form-grid">
                <div>
                  <label className="lbl" htmlFor="plan_id">Plan</label>
                  <select className="field" id="plan_id" name="plan_id" defaultValue={u.plan_id}>
                    {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl" htmlFor="plan_status">Status</label>
                  <select className="field" id="plan_status" name="plan_status" defaultValue={u.plan_status}>
                    {['active', 'trialing', 'past_due', 'cancelled', 'expired'].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl" htmlFor="plan_source">Source</label>
                  <select className="field" id="plan_source" name="plan_source" defaultValue={u.plan_source === 'free' ? 'comp' : u.plan_source}>
                    {['comp', 'manual', 'lemonsqueezy', 'paddle', 'free'].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl" htmlFor="plan_expires_at">Access until</label>
                  <input className="field" type="date" id="plan_expires_at" name="plan_expires_at" defaultValue={u.plan_expires_at?.slice(0, 10) ?? ''} />
                  <div className="hint">Empty = no end date</div>
                </div>
              </div>
            </ActionForm>
          ) : (
            <p>{u.plan_id} · {u.plan_status} · until {fmtDate(u.plan_expires_at)}</p>
          )}
        </section>

        <section className="card stack">
          <h2>Account controls</h2>
          {isOwner && (
            <ActionForm action={setRole} submitLabel="Change role" className="row">
              <input type="hidden" name="id" value={u.id} />
              <select className="field" style={{ width: 160 }} name="role" defaultValue={u.role}>
                {['user', 'staff', 'admin', 'owner'].map((r) => <option key={r}>{r}</option>)}
              </select>
            </ActionForm>
          )}
          {isAdmin && u.role !== 'owner' && u.id !== s.user.id && (
            <form action={setBanned.bind(null, u.id, !u.banned)}>
              <button className={`btn ${u.banned ? '' : 'danger'}`} type="submit">{u.banned ? 'Unban user' : 'Ban user'}</button>
            </form>
          )}
          <p className="hint">Staff can view; admins change plans and bans; only owners change roles.</p>
        </section>
      </div>

      <section className="card">
        <h2>Billing history</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Type</th><th>Plan</th><th>Status</th><th>Amount / period</th><th>Date</th></tr></thead>
            <tbody>
              {subs?.map((x) => (
                <tr key={x.id}><td>{x.provider}</td><td>{x.plan_id}</td><td>{x.status}</td><td>ends {fmtDate(x.current_period_end)}</td><td>{fmtDate(x.updated_at)}</td></tr>
              ))}
              {pays?.map((p) => (
                <tr key={p.id}><td>{p.method} <code className="small">{p.txn_ref}</code></td><td>{p.plan_id} × {p.months}</td><td>{p.status}</td><td>{money(Number(p.amount), 'PKR')}</td><td>{fmtDate(p.created_at)}</td></tr>
              ))}
              {!subs?.length && !pays?.length && <tr><td colSpan={5} className="muted">No payments yet</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {usage && usage.length > 0 && (
        <section className="card">
          <h2>Admin actions on this user</h2>
          <ul className="small">{usage.map((a, i) => <li key={i}>{fmtDate(a.created_at)} — {a.action}</li>)}</ul>
        </section>
      )}
    </>
  );
}
