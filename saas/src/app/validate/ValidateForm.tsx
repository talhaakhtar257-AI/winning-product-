'use client';
import { useActionState } from 'react';
import { runValidation } from '@/app/actions';

export function ValidateForm({ defaultMarket }: { defaultMarket: 'Global' | 'Pakistan' }) {
  const [state, action, pending] = useActionState(runValidation, null);
  return (
    <form action={action} className="card stack">
      <div className="form-grid">
        <In name="name" label="Product name" required maxLength={120} />
        <Sel name="market" label="Market" def={defaultMarket} opts={[['Global', '🌍 Global (USD)'], ['Pakistan', '🇵🇰 Pakistan (PKR)']]} />
        <In name="niche" label="Niche" maxLength={60} />
        <In name="sellPrice" label="Planned selling price" inputMode="decimal" required />
        <In name="productCost" label="Product cost (landed)" inputMode="decimal" required />
        <In name="weightKg" label="Weight (kg)" inputMode="decimal" required defaultValue="0.3" />
        <Sel name="demand" label="Demand trend" def="unknown" opts={[['rising', 'Rising'], ['stable', 'Stable'], ['falling', 'Falling'], ['unknown', 'Not sure']]} />
        <In name="competitorCount" label="Sellers / active ads found" inputMode="numeric" required defaultValue="20" hint="Count in Ad Library, Daraz or Amazon" />
        <In name="rating" label="Avg. rating of similar items" inputMode="decimal" defaultValue="0" hint="0 = don’t know" />
        <Sel name="appeal" label="Why do people buy it?" def="problem" opts={[['both', 'Solves a problem AND looks wow'], ['problem', 'Solves a clear problem'], ['wow', 'Wow / visual appeal'], ['neither', 'Neither really']]} />
        <Sel name="season" label="When does it sell?" def="all-year" opts={[['all-year', 'All year'], ['seasonal', 'One season'], ['event', 'One event (Eid, Xmas…)']]} />
        <Sel name="safety" label="Is it safe & allowed?" def="ok" opts={[['ok', 'Yes, no rules'], ['certification', 'Needs certification'], ['restricted', 'Restricted / banned in ads']]} />
      </div>
      <div className="row">
        <label className="check"><input type="checkbox" name="fragile" /> Fragile</label>
        <label className="check"><input type="checkbox" name="batteryOrLiquid" /> Has battery or liquid</label>
        <label className="check"><input type="checkbox" name="salesProof" /> I have proof of real sales</label>
      </div>
      {state && !state.ok && <div className="alert bad" role="alert">{state.message}</div>}
      <button className="btn primary" type="submit" disabled={pending}>{pending ? 'Scoring…' : 'Score my product'}</button>
    </form>
  );
}

function In({ name, label, hint, ...rest }: { name: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="lbl" htmlFor={`v-${name}`}>{label}</label>
      <input className="field" id={`v-${name}`} name={name} {...rest} />
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

function Sel({ name, label, def, opts }: { name: string; label: string; def: string; opts: [string, string][] }) {
  return (
    <div>
      <label className="lbl" htmlFor={`v-${name}`}>{label}</label>
      <select className="field" id={`v-${name}`} name={name} defaultValue={def}>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
