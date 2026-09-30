import type { Metadata } from 'next';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { getPlans, getSettings, type Plan } from '@/lib/data/settings';
import { money } from '@/lib/format';
import { startCheckout } from '../actions';

export const metadata: Metadata = { title: 'Pricing' };

export default async function PricingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [s, plans, settings] = await Promise.all([getSession(), getPlans(), getSettings()]);
  const pk = sp.market === 'pk' || (sp.market !== 'global' && s.profile?.market_pref === 'Pakistan');
  const f = settings.features;
  return (
    <div className="stack">
      <div style={{ textAlign: 'center' }}>
        <h1>Simple pricing. Cancel anytime.</h1>
        <p className="muted">One avoided bad product pays for a year of {settings.brand.name}.</p>
        <div className="row" style={{ justifyContent: 'center' }} role="group" aria-label="Currency">
          <Link className={`btn sm${!pk ? ' primary' : ''}`} href="/pricing?market=global">🌍 USD</Link>
          <Link className={`btn sm${pk ? ' primary' : ''}`} href="/pricing?market=pk">🇵🇰 PKR</Link>
        </div>
      </div>
      {sp.error === 'checkout' && <div className="alert bad">Card checkout isn’t available right now. Please try again or pay locally from your account page.</div>}
      <div className="grid grid-3">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} pk={pk} current={s.ent.planId === p.id} signedIn={!!s.user} lemon={f.lemonsqueezy && !!p.lemon_variant_id} paddle={f.paddle && !!p.paddle_price_id} manual={f.manualPayments} />
        ))}
      </div>
      <p className="muted small" style={{ textAlign: 'center' }}>
        Card payments are processed securely by our payment partner (merchant of record) — we never see your card.
        In Pakistan you can also pay by JazzCash, Easypaisa or bank transfer.
      </p>
    </div>
  );
}

function PlanCard({ plan: p, pk, current, signedIn, lemon, paddle, manual }: { plan: Plan; pk: boolean; current: boolean; signedIn: boolean; lemon: boolean; paddle: boolean; manual: boolean }) {
  const price = pk ? money(p.price_pkr, 'PKR') : money(p.price_usd, 'USD');
  return (
    <div className="card stack" style={p.highlighted ? { borderColor: 'var(--accent)', borderWidth: 2 } : undefined}>
      <div className="row between">
        <h2 style={{ margin: 0 }}>{p.name}</h2>
        {p.highlighted && <span className="badge gold">Most popular</span>}
      </div>
      <div><span className="kpi">{price}</span> <span className="muted">/ {p.interval}</span></div>
      <p className="muted">{p.description}</p>
      <ul style={{ paddingLeft: 18, margin: 0 }}>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
      <div className="stack" style={{ marginTop: 'auto' }}>
        {current ? (
          <span className="btn" aria-disabled="true">Your current plan</span>
        ) : p.id === 'free' ? (
          <Link className="btn" href={signedIn ? '/products' : '/login'}>Start free</Link>
        ) : !signedIn ? (
          <Link className="btn primary" href={`/login?next=/pricing`}>Get {p.name}</Link>
        ) : (
          <>
            {lemon && (
              <form action={startCheckout}>
                <input type="hidden" name="plan" value={p.id} />
                <input type="hidden" name="provider" value="lemonsqueezy" />
                <button className="btn primary" style={{ width: '100%' }} type="submit">Pay by card</button>
              </form>
            )}
            {paddle && (
              <form action={startCheckout}>
                <input type="hidden" name="plan" value={p.id} />
                <input type="hidden" name="provider" value="paddle" />
                <button className="btn" style={{ width: '100%' }} type="submit">{lemon ? 'Pay by card (Paddle)' : 'Pay by card'}</button>
              </form>
            )}
            {manual && p.price_pkr > 0 && <Link className="btn" href="/account#pay-local">JazzCash / Easypaisa / Bank</Link>}
          </>
        )}
      </div>
    </div>
  );
}
