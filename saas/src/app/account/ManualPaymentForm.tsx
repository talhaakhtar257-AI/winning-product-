'use client';
import { useActionState, useState } from 'react';
import { submitManualPayment } from '../actions';
import { money } from '@/lib/format';

export function ManualPaymentForm({ plans, methods }: { plans: { id: string; name: string; pkr: number }[]; methods: string[] }) {
  const [state, action, pending] = useActionState(submitManualPayment, null);
  const [plan, setPlan] = useState(plans[0]?.id ?? '');
  const [months, setMonths] = useState(1);
  const price = plans.find((p) => p.id === plan)?.pkr ?? 0;
  if (state?.ok) return <div className="alert good" role="status">{state.message}</div>;
  return (
    <form action={action} className="stack">
      <div className="form-grid">
        <div>
          <label className="lbl" htmlFor="m-plan">Plan</label>
          <select className="field" id="m-plan" name="plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {money(p.pkr, 'PKR')}/mo</option>)}
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor="m-months">Months</label>
          <select className="field" id="m-months" name="months" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor="m-method">Paid with</label>
          <select className="field" id="m-method" name="method">
            {methods.map((m) => <option key={m} value={m}>{m === 'bank' ? 'Bank transfer' : m === 'jazzcash' ? 'JazzCash' : 'Easypaisa'}</option>)}
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor="m-txn">Transaction ID</label>
          <input className="field" id="m-txn" name="txn_ref" required minLength={4} maxLength={64} />
        </div>
        <div>
          <label className="lbl" htmlFor="m-name">Sender name</label>
          <input className="field" id="m-name" name="payer_name" required minLength={2} maxLength={80} />
        </div>
        <div>
          <label className="lbl" htmlFor="m-phone">Sender phone</label>
          <input className="field" id="m-phone" name="payer_phone" required inputMode="tel" maxLength={20} />
        </div>
        <div>
          <label className="lbl" htmlFor="m-proof">Payment screenshot</label>
          <input className="field" id="m-proof" name="proof" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required />
        </div>
      </div>
      <div className="row between">
        <strong>Amount to send: {money(price * months, 'PKR')}</strong>
        <button className="btn primary" type="submit" disabled={pending}>{pending ? 'Submitting…' : 'Submit payment'}</button>
      </div>
      {state && !state.ok && <div className="alert bad" role="alert">{state.message}</div>}
    </form>
  );
}
