import { requireRole } from '@/lib/auth';
import { getSettings } from '@/lib/data/settings';
import { ActionForm } from '@/components/ActionForm';
import { saveSettings } from '../actions';
import { ThemeEditor } from './ThemeEditor';

const FEATURE_LABELS: Record<string, string> = {
  calculator: 'Profit calculator',
  validator: 'Validate-my-product',
  competitors: 'Competitor research section',
  trendHistory: 'Trend & saturation section',
  manualPayments: 'JazzCash / Easypaisa / bank payments',
  lemonsqueezy: 'Lemon Squeezy card checkout',
  paddle: 'Paddle card checkout',
  signups: 'New sign-ups open',
  emailLogin: 'Email sign-in links (needs custom SMTP for customers)',
};

export default async function DesignAdmin() {
  await requireRole('admin');
  const s = await getSettings();
  const input = (name: string, label: string, v: string, max = 200, hint?: string) => (
    <div>
      <label className="lbl" htmlFor={`s-${name}`}>{label}</label>
      <input className="field" id={`s-${name}`} name={name} defaultValue={v} maxLength={max} />
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
  const faqText = s.landing.faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n\n');

  return (
    <>
      <h1>Design & site settings</h1>
      <p className="muted">Everything here is live the moment you save — no code or redeploy needed.</p>

      <section className="card stack">
        <h2>Brand</h2>
        <ActionForm action={saveSettings} submitLabel="Save brand">
          <input type="hidden" name="__key" value="brand" />
          <div className="form-grid">
            {input('name', 'Product name', s.brand.name, 40)}
            {input('tagline', 'Tagline', s.brand.tagline, 80)}
            {input('logoUrl', 'Logo URL (https, square)', s.brand.logoUrl, 500, 'Leave empty for the default radar logo')}
            {input('supportEmail', 'Support email', s.brand.supportEmail, 120)}
            {input('whatsapp', 'WhatsApp number', s.brand.whatsapp, 20)}
          </div>
        </ActionForm>
      </section>

      <section className="card stack">
        <h2>Colours & shape</h2>
        <ThemeEditor initial={s.theme} brandName={s.brand.name} />
      </section>

      <section className="card stack">
        <h2>Home page & announcement</h2>
        <ActionForm action={saveSettings} submitLabel="Save home page">
          <input type="hidden" name="__key" value="landing" />
          {input('announcement', 'Top announcement bar (empty = hidden)', s.landing.announcement, 200, 'e.g. “Launch offer: 30% off Pro this week”')}
          {input('heroTitle', 'Hero headline', s.landing.heroTitle, 140)}
          <div>
            <label className="lbl" htmlFor="s-heroSubtitle">Hero text</label>
            <textarea className="field" id="s-heroSubtitle" name="heroSubtitle" defaultValue={s.landing.heroSubtitle} maxLength={400} />
          </div>
          {input('ctaLabel', 'Main button label', s.landing.ctaLabel, 30)}
          <div>
            <label className="lbl" htmlFor="s-faq">FAQ</label>
            <textarea className="field" id="s-faq" name="faq" defaultValue={faqText} style={{ minHeight: 220 }} />
            <div className="hint">Write “Q: question” then “A: answer” on the next line. Leave a blank line between questions.</div>
          </div>
        </ActionForm>
      </section>

      <section className="card stack">
        <h2>Local payment accounts (Pakistan)</h2>
        <ActionForm action={saveSettings} submitLabel="Save payment details">
          <input type="hidden" name="__key" value="payments" />
          <div className="grid grid-3">
            <fieldset className="stack" style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 12 }}>
              <legend>JazzCash</legend>
              <label className="check"><input type="checkbox" name="jazzcash.enabled" defaultChecked={s.payments.jazzcash.enabled} /> Enabled</label>
              {input('jazzcash.number', 'Account number', s.payments.jazzcash.number, 20)}
              {input('jazzcash.title', 'Account title', s.payments.jazzcash.title, 60)}
            </fieldset>
            <fieldset className="stack" style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 12 }}>
              <legend>Easypaisa</legend>
              <label className="check"><input type="checkbox" name="easypaisa.enabled" defaultChecked={s.payments.easypaisa.enabled} /> Enabled</label>
              {input('easypaisa.number', 'Account number', s.payments.easypaisa.number, 20)}
              {input('easypaisa.title', 'Account title', s.payments.easypaisa.title, 60)}
            </fieldset>
            <fieldset className="stack" style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 12 }}>
              <legend>Bank transfer</legend>
              <label className="check"><input type="checkbox" name="bank.enabled" defaultChecked={s.payments.bank.enabled} /> Enabled</label>
              {input('bank.bank', 'Bank name', s.payments.bank.bank, 60)}
              {input('bank.iban', 'IBAN', s.payments.bank.iban, 34)}
              {input('bank.title', 'Account title', s.payments.bank.title, 60)}
            </fieldset>
          </div>
          <div>
            <label className="lbl" htmlFor="s-instructions">Instructions shown to customers</label>
            <textarea className="field" id="s-instructions" name="instructions" defaultValue={s.payments.instructions} maxLength={500} />
          </div>
        </ActionForm>
      </section>

      <section className="card stack">
        <h2>Feature switches</h2>
        <ActionForm action={saveSettings} submitLabel="Save switches">
          <input type="hidden" name="__key" value="features" />
          <div className="grid grid-3">
            {Object.entries(s.features).map(([k, v]) => (
              <label key={k} className="check"><input type="checkbox" name={k} defaultChecked={v} /> {FEATURE_LABELS[k] ?? k}</label>
            ))}
          </div>
        </ActionForm>
      </section>
    </>
  );
}
