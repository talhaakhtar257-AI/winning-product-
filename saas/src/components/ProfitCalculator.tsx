'use client';
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { calculateProfit, type ProfitInput } from '@/lib/calc/profit';
import { CHANNEL_PRESETS, PK_COURIERS } from '@/lib/calc/presets';
import { money } from '@/lib/format';
import { saveScenario } from '@/app/actions';

type Field = { key: keyof ProfitInput; label: string; hint?: string; unit: 'money' | 'pct' | 'count' };

const GROUPS: { title: string; fields: Field[] }[] = [
  { title: 'Product', fields: [
    { key: 'sellPrice', label: 'Selling price', unit: 'money' },
    { key: 'productCost', label: 'Product cost', unit: 'money', hint: 'Supplier price per unit' },
    { key: 'inboundShipping', label: 'Shipping to you / landed', unit: 'money' },
    { key: 'packaging', label: 'Packaging', unit: 'money' },
  ] },
  { title: 'Fees', fields: [
    { key: 'commissionPct', label: 'Marketplace commission', unit: 'pct' },
    { key: 'paymentFeePct', label: 'Payment fee', unit: 'pct' },
    { key: 'fixedFeePerOrder', label: 'Fixed fee per order', unit: 'money' },
    { key: 'taxPct', label: 'Sales tax / GST', unit: 'pct' },
  ] },
  { title: 'Delivery & returns', fields: [
    { key: 'deliveryFee', label: 'Delivery fee per order', unit: 'money' },
    { key: 'codFeePct', label: 'COD collection fee', unit: 'pct' },
    { key: 'returnRatePct', label: 'Return / RTO rate', unit: 'pct', hint: 'PK COD is often 20–35%' },
    { key: 'returnShippingFee', label: 'Return shipping fee', unit: 'money' },
    { key: 'returnLossPct', label: 'Returned stock lost', unit: 'pct', hint: 'Damaged / unsellable share' },
  ] },
  { title: 'Marketing & scale', fields: [
    { key: 'adCostPerOrder', label: 'Ad cost per order (CPA)', unit: 'money' },
    { key: 'otherPerOrder', label: 'Other per order', unit: 'money', hint: 'Call confirmation, inserts…' },
    { key: 'ordersPerMonth', label: 'Orders shipped / month', unit: 'count' },
    { key: 'fixedMonthly', label: 'Fixed monthly costs', unit: 'money', hint: 'Apps, staff, rent' },
  ] },
];

const VERDICT = { go: ['good', '✅ Go'], risky: ['warn', '⚠️ Risky'], 'no-go': ['bad', '⛔ No-go'] } as const;

export function ProfitCalculator({ initial, currency: initialCurrency, productId, canSave, signedIn }: {
  initial: Partial<ProfitInput>;
  currency: 'USD' | 'PKR';
  productId?: string;
  canSave: boolean;
  signedIn: boolean;
}) {
  const [currency, setCurrency] = useState(initialCurrency);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(GROUPS.flatMap((g) => g.fields).map((f) => [f.key, String(initial[f.key] ?? (f.key === 'returnLossPct' ? 10 : f.key === 'ordersPerMonth' ? 300 : 0))])),
  );
  const [usd, setUsd] = useState({ cost: '', rate: '280' });
  const [msg, setMsg] = useState('');
  const [saving, start] = useTransition();

  const numeric = useMemo(() => Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v) || 0])), [values]);
  const result = useMemo(() => {
    try {
      return calculateProfit(numeric);
    } catch {
      return null;
    }
  }, [numeric]);

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));
  const applyPreset = (id: string) => {
    const p = CHANNEL_PRESETS.find((c) => c.id === id);
    if (!p) return;
    setCurrency(p.market === 'Pakistan' ? 'PKR' : 'USD');
    setValues((s) => ({ ...s, ...Object.fromEntries(Object.entries(p.values).map(([k, v]) => [k, String(v)])) }));
  };
  const applyCourier = (id: string) => {
    const c = PK_COURIERS.find((x) => x.id === id);
    if (c) setValues((s) => ({ ...s, deliveryFee: String(c.deliveryFee), codFeePct: String(c.codFeePct), returnShippingFee: String(c.returnShippingFee) }));
  };
  const m = (n: number) => money(n, currency);

  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <div className="card stack">
        <div className="form-grid">
          <div>
            <label className="lbl" htmlFor="preset">Sales channel preset</label>
            <select id="preset" className="field" defaultValue="" onChange={(e) => applyPreset(e.target.value)}>
              <option value="" disabled>Choose a channel…</option>
              {CHANNEL_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          {currency === 'PKR' && (
            <div>
              <label className="lbl" htmlFor="courier">Courier (Pakistan)</label>
              <select id="courier" className="field" defaultValue="" onChange={(e) => applyCourier(e.target.value)}>
                <option value="" disabled>Choose a courier…</option>
                {PK_COURIERS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="lbl" htmlFor="currency">Currency</label>
            <select id="currency" className="field" value={currency} onChange={(e) => setCurrency(e.target.value as 'USD' | 'PKR')}>
              <option value="USD">USD $</option>
              <option value="PKR">PKR Rs</option>
            </select>
          </div>
        </div>
        <p className="hint">Presets are typical rates — replace them with your own contract numbers.</p>

        {currency === 'PKR' && (
          <details>
            <summary className="small" style={{ cursor: 'pointer', fontWeight: 700 }}>Supplier price in USD? Convert it</summary>
            <div className="row" style={{ marginTop: 8 }}>
              <input className="field" style={{ flex: 1 }} inputMode="decimal" placeholder="USD cost" value={usd.cost} onChange={(e) => setUsd({ ...usd, cost: e.target.value })} aria-label="Cost in USD" />
              <input className="field" style={{ width: 110 }} inputMode="decimal" value={usd.rate} onChange={(e) => setUsd({ ...usd, rate: e.target.value })} aria-label="PKR per USD" />
              <button type="button" className="btn sm" onClick={() => set('productCost', String(Math.round((Number(usd.cost) || 0) * (Number(usd.rate) || 0))))}>Use</button>
            </div>
          </details>
        )}

        {GROUPS.map((g) => (
          <fieldset key={g.title} style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 800, marginBottom: 8 }}>{g.title}</legend>
            <div className="form-grid">
              {g.fields.map((f) => (
                <div key={f.key}>
                  <label className="lbl" htmlFor={`c-${f.key}`}>
                    {f.label} {f.unit === 'pct' ? '(%)' : f.unit === 'money' ? `(${currency})` : ''}
                  </label>
                  <input id={`c-${f.key}`} className="field" inputMode="decimal" value={values[f.key]} onChange={(e) => set(f.key, e.target.value.replace(/[^0-9.]/g, ''))} />
                  {f.hint && <div className="hint">{f.hint}</div>}
                </div>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="card stack" style={{ position: 'sticky', top: 76 }} aria-live="polite">
        {!result ? (
          <p className="alert bad">Check the numbers — some are out of range.</p>
        ) : (
          <>
            <div className="row between">
              <h3 style={{ margin: 0 }}>Result</h3>
              <span className={`badge ${VERDICT[result.verdict][0]}`} style={{ fontSize: '.9rem' }}>{VERDICT[result.verdict][1]}</span>
            </div>
            <div className="grid grid-4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <Stat k="Profit / delivered order" v={m(result.profitPerDelivered)} tone={result.profitPerDelivered > 0} />
              <Stat k="Net margin" v={`${Math.round(result.margin * 100)}%`} tone={result.margin > 0} />
              <Stat k="Break-even ad cost" v={m(result.breakEvenCpa)} />
              <Stat k="Break-even ROAS" v={result.breakEvenRoas ? `${result.breakEvenRoas}×` : '—'} />
              <Stat k="Max return rate" v={result.maxReturnRate === null ? (result.profitPerShipped > 0 ? 'Any' : '—') : `${Math.round(result.maxReturnRate * 100)}%`} />
              <Stat k="Monthly profit" v={m(result.monthlyProfit)} tone={result.monthlyProfit > 0} />
            </div>
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              {result.reasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
            <div>
              <div className="lbl">Where each shipped order’s money goes (revenue {m(result.revenuePerShipped)})</div>
              <table>
                <tbody>
                  {result.costBreakdown.filter((c) => c.amount > 0).map((c) => (
                    <tr key={c.label}><td>{c.label}</td><td className="num">{m(c.amount)}</td></tr>
                  ))}
                  <tr><td><strong>Profit per shipped order</strong></td><td className="num"><strong className={result.profitPerShipped >= 0 ? 'good-text' : 'bad-text'}>{m(result.profitPerShipped)}</strong></td></tr>
                </tbody>
              </table>
            </div>
            {signedIn && canSave ? (
              <button className="btn primary" type="button" disabled={saving} onClick={() => {
                const name = window.prompt('Name this scenario', 'My scenario');
                if (name === null) return;
                start(async () => {
                  const r = await saveScenario(name, numeric, productId ?? null);
                  setMsg(r?.message ?? '');
                });
              }}>
                {saving ? 'Saving…' : 'Save scenario'}
              </button>
            ) : (
              <Link className="btn" href={signedIn ? '/pricing' : '/login?next=/calculator'}>🔒 Save scenarios with Pro</Link>
            )}
            {msg && <p className="small muted" role="status">{msg}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: boolean }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className={`v ${tone === undefined ? '' : tone ? 'good-text' : 'bad-text'}`}>{v}</div>
    </div>
  );
}
