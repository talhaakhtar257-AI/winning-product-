import { requireRole } from '@/lib/auth';
import { getPlans, type Plan } from '@/lib/data/settings';
import { ActionForm } from '@/components/ActionForm';
import { savePlan } from '../actions';

export default async function PlansAdmin() {
  await requireRole('admin');
  const plans = await getPlans(true);
  const blank: Plan = {
    id: '', name: '', description: '', price_usd: 0, price_pkr: 0, interval: 'month', features: [], lemon_variant_id: null, paddle_price_id: null,
    active: false, highlighted: false, sort: plans.length,
    limits: { historyDays: 30, maxProducts: 1000, fullDetails: true, trendHistory: true, competitors: true, export: true, savedMax: 100, calcSave: true, validationsPerMonth: 30 },
  };
  return (
    <>
      <h1>Plans & pricing</h1>
      <p className="muted">
        Changes go live on the pricing page immediately. Card prices are charged by Lemon Squeezy / Paddle — create the product there
        with the same price, then paste its variant ID / price ID here.
      </p>
      {[...plans, blank].map((p) => (
        <details key={p.id || 'new'} className="card" open={!p.id}>
          <summary style={{ fontWeight: 800, cursor: 'pointer' }}>
            {p.id ? `${p.name} — $${p.price_usd} / Rs ${p.price_pkr} per ${p.interval}` : '+ New plan'} {p.id && !p.active && <span className="badge">inactive</span>}
          </summary>
          <ActionForm action={savePlan} submitLabel={p.id ? 'Save plan' : 'Create plan'}>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <F name="id" label="ID (url-safe)" v={p.id} readOnly={!!p.id} />
              <F name="name" label="Name" v={p.name} />
              <F name="price_usd" label="Price USD" v={p.price_usd} />
              <F name="price_pkr" label="Price PKR" v={p.price_pkr} />
              <div>
                <label className="lbl" htmlFor={`${p.id}-interval`}>Billing interval</label>
                <select className="field" id={`${p.id}-interval`} name="interval" defaultValue={p.interval}><option value="month">month</option><option value="year">year</option></select>
              </div>
              <F name="sort" label="Order on page" v={p.sort} />
              <F name="lemon_variant_id" label="Lemon Squeezy variant ID" v={p.lemon_variant_id ?? ''} />
              <F name="paddle_price_id" label="Paddle price ID" v={p.paddle_price_id ?? ''} />
            </div>
            <F name="description" label="Short description" v={p.description} />
            <div>
              <label className="lbl" htmlFor={`${p.id}-features`}>Feature bullets (one per line)</label>
              <textarea className="field" id={`${p.id}-features`} name="features" defaultValue={p.features.join('\n')} />
            </div>
            <h3>Limits</h3>
            <div className="form-grid">
              <F name="historyDays" label="History (days)" v={p.limits.historyDays} />
              <F name="maxProducts" label="Max products visible" v={p.limits.maxProducts} />
              <F name="savedMax" label="Saved products" v={p.limits.savedMax} />
              <F name="validationsPerMonth" label="Validations / month" v={p.limits.validationsPerMonth} />
            </div>
            <div className="row">
              {(['fullDetails', 'trendHistory', 'competitors', 'export', 'calcSave'] as const).map((k) => (
                <label key={k} className="check"><input type="checkbox" name={k} defaultChecked={p.limits[k]} /> {k}</label>
              ))}
            </div>
            <div className="row">
              <label className="check"><input type="checkbox" name="active" defaultChecked={p.active} disabled={p.id === 'free'} /> Active (visible & purchasable)</label>
              <label className="check"><input type="checkbox" name="highlighted" defaultChecked={p.highlighted} /> Highlight as “Most popular”</label>
            </div>
          </ActionForm>
        </details>
      ))}
    </>
  );
}

function F({ name, label, v, readOnly }: { name: string; label: string; v: string | number; readOnly?: boolean }) {
  return (
    <div>
      <label className="lbl">
        {label}
        <input className="field" name={name} defaultValue={v} readOnly={readOnly} style={{ marginTop: 6 }} />
      </label>
    </div>
  );
}
