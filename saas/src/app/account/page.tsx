import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPlans, getSettings } from '@/lib/data/settings';
import { fmtDate, money } from '@/lib/format';
import { updateMarketPref } from '../actions';
import { ManualPaymentForm } from './ManualPaymentForm';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireUser('/account');
  const db = supabaseAdmin();
  const [plans, settings, { data: subs }, { data: payments }] = await Promise.all([
    getPlans(),
    getSettings(),
    db.from('subscriptions').select('*').eq('user_id', s.user.id).order('updated_at', { ascending: false }).limit(5),
    db.from('manual_payments').select('*').eq('user_id', s.user.id).order('created_at', { ascending: false }).limit(20),
  ]);
  const plan = plans.find((p) => p.id === s.ent.planId);
  const portal = subs?.find((x) => x.portal_url)?.portal_url as string | undefined;
  const paidPlans = plans.filter((p) => p.id !== 'free' && p.price_pkr > 0);

  return (
    <div className="stack">
      <h1>Account</h1>
      {sp.paid && <div className="alert good">Thanks! Your payment is processing — your plan updates within a minute.</div>}
      <div className="grid grid-2">
        <section className="card stack">
          <h2>Your plan</h2>
          <div className="row between">
            <div>
              <div className="kpi">{plan?.name ?? 'Free'}</div>
              <div className="muted small">
                {s.profile.role !== 'user' ? `Staff access (${s.profile.role})` : s.ent.paid ? `Active · via ${s.profile.plan_source}` : 'Free plan'}
                {s.ent.paid && s.profile.plan_expires_at && ` · ${s.profile.plan_source === 'manual' || s.profile.plan_source === 'comp' ? 'expires' : 'renews / ends'} ${fmtDate(s.profile.plan_expires_at)}`}
              </div>
            </div>
            <Link className="btn accent" href="/pricing">{s.ent.paid ? 'Change plan' : 'Upgrade'}</Link>
          </div>
          {portal && <a className="btn" href={portal} target="_blank" rel="noopener noreferrer">Manage card subscription & invoices ↗</a>}
          <ul className="small muted" style={{ margin: 0 }}>
            <li>History: {s.ent.limits.historyDays === 1 ? 'today only' : `${s.ent.limits.historyDays} days`}</li>
            <li>Validations: {s.ent.limits.validationsPerMonth} / month</li>
            <li>Saved products: up to {s.ent.limits.savedMax}</li>
            <li>CSV export: {s.ent.limits.export ? 'yes' : 'no'}</li>
          </ul>
        </section>
        <section className="card stack">
          <h2>Profile</h2>
          <form action={updateMarketPref} className="stack">
            <div>
              <label className="lbl" htmlFor="full_name">Name</label>
              <input className="field" id="full_name" name="full_name" defaultValue={s.profile.full_name} maxLength={80} />
            </div>
            <div>
              <label className="lbl" htmlFor="market">I mainly sell in</label>
              <select className="field" id="market" name="market" defaultValue={s.profile.market_pref}>
                <option value="all">Both</option>
                <option value="Global">🌍 Global</option>
                <option value="Pakistan">🇵🇰 Pakistan</option>
              </select>
            </div>
            <button className="btn" type="submit">Save</button>
          </form>
          <div className="muted small">Signed in as {s.user.email}</div>
          <form action="/auth/signout" method="post"><button className="btn sm" type="submit">Sign out</button></form>
        </section>
      </div>

      {settings.features.manualPayments && paidPlans.length > 0 && (
        <section className="card stack" id="pay-local">
          <h2>Pay with JazzCash, Easypaisa or bank transfer (Pakistan)</h2>
          <p className="muted">{settings.payments.instructions}</p>
          <div className="grid grid-3">
            {settings.payments.jazzcash.enabled && settings.payments.jazzcash.number && (
              <div className="stat"><div className="k">JazzCash</div><div><strong>{settings.payments.jazzcash.number}</strong><br />{settings.payments.jazzcash.title}</div></div>
            )}
            {settings.payments.easypaisa.enabled && settings.payments.easypaisa.number && (
              <div className="stat"><div className="k">Easypaisa</div><div><strong>{settings.payments.easypaisa.number}</strong><br />{settings.payments.easypaisa.title}</div></div>
            )}
            {settings.payments.bank.enabled && settings.payments.bank.iban && (
              <div className="stat"><div className="k">{settings.payments.bank.bank || 'Bank'}</div><div><strong>{settings.payments.bank.iban}</strong><br />{settings.payments.bank.title}</div></div>
            )}
          </div>
          <ManualPaymentForm
            plans={paidPlans.map((p) => ({ id: p.id, name: p.name, pkr: p.price_pkr }))}
            methods={(['jazzcash', 'easypaisa', 'bank'] as const).filter((m) => settings.payments[m].enabled)}
          />
          {payments && payments.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Plan</th><th>Method</th><th className="num">Amount</th><th>Txn ID</th><th>Status</th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{fmtDate(p.created_at)}</td>
                      <td>{p.plan_id} × {p.months} mo</td>
                      <td>{p.method}</td>
                      <td className="num">{money(Number(p.amount), 'PKR')}</td>
                      <td>{p.txn_ref}</td>
                      <td>
                        <span className={`badge ${p.status === 'approved' ? 'good' : p.status === 'rejected' ? 'bad' : 'warn'}`}>{p.status}</span>
                        {p.note && <div className="small muted">{p.note}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
