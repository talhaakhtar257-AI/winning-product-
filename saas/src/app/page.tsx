import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { getSettings } from '@/lib/data/settings';
import { filtersSchema, listProducts } from '@/lib/data/products';
import { FREE_LIMITS } from '@/lib/entitlements';
import { ProductCard } from '@/components/ProductCard';

export default async function Home() {
  const [s, settings] = await Promise.all([getSession(), getSettings()]);
  const L = settings.landing;
  let top: Awaited<ReturnType<typeof listProducts>>['items'] = [];
  try {
    top = (await listProducts(filtersSchema.parse({}), { planId: 'free', paid: false, limits: { ...FREE_LIMITS, maxProducts: 3 } })).items;
  } catch {
    top = [];
  }
  const problems = [
    ['🎯', 'Stop guessing what to sell', 'Fresh products every morning, each scored on 9 criteria with a proof level — sales numbers, not hype.'],
    ['💸', 'Know your real profit first', 'Fees, delivery, COD returns, damaged stock and ad cost — see break-even CPA and ROAS before you spend.'],
    ['📉', 'Avoid saturated products', 'Trend and competition history shows whether you are early or the 500th store selling it.'],
    ['🔎', 'Research competitors in one click', 'Ad Library, TikTok Creative Center, Daraz, Amazon and suppliers — pre-filled for every product.'],
    ['✅', 'Validate your own ideas', 'Answer 12 questions and get a score, a verdict and a fix-list before you buy stock.'],
    ['🇵🇰', 'Built for Pakistan too', 'PKR pricing, Daraz and courier presets, RTO maths — and pay with JazzCash or Easypaisa.'],
  ];
  return (
    <div className="stack" style={{ gap: 48, display: 'flex', flexDirection: 'column' }}>
      <section className="hero">
        <span className="badge gold">{settings.brand.tagline}</span>
        <h1 style={{ marginTop: 12 }}>{L.heroTitle}</h1>
        {L.heroSubtitle && <p>{L.heroSubtitle}</p>}
        <div className="row">
          <Link className="btn accent" href={s.user ? '/products' : '/login'}>{L.ctaLabel}</Link>
          <Link className="btn" href="/calculator">Try the profit calculator</Link>
        </div>
      </section>

      {top.length > 0 && (
        <section>
          <div className="panel-title"><h2 style={{ margin: 0 }}>Today’s top picks</h2><Link href="/products">See all →</Link></div>
          <div className="grid grid-3">{top.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </section>
      )}

      <section>
        <h2>The problems that cost sellers money — solved</h2>
        <div className="grid grid-3">
          {problems.map(([icon, t, d]) => (
            <div key={t} className="card">
              <div style={{ fontSize: '1.6rem' }} aria-hidden="true">{icon}</div>
              <h3>{t}</h3>
              <p className="muted" style={{ margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {L.faq.length > 0 && (
        <section>
          <h2>Questions sellers ask</h2>
          <div className="stack">
            {L.faq.map((q) => (
              <details key={q.q} className="card flat">
                <summary style={{ fontWeight: 700, cursor: 'pointer' }}>{q.q}</summary>
                <p className="muted" style={{ marginTop: 8 }}>{q.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <section className="card row between">
        <div>
          <h2 style={{ marginBottom: 4 }}>Find your next winner today</h2>
          <p className="muted" style={{ margin: 0 }}>Free forever plan. Upgrade when it pays for itself.</p>
        </div>
        <Link className="btn primary" href="/pricing">See pricing</Link>
      </section>
    </div>
  );
}
