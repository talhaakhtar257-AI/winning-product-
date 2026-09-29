import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getProduct } from '@/lib/data/products';
import { getSettings } from '@/lib/data/settings';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { inputsFromProduct } from '@/lib/calc/presets';
import { analyseHistory } from '@/lib/products/history';
import { researchLinks } from '@/lib/research/links';
import { fmtDate, money, PROOF_LABEL } from '@/lib/format';
import { MarketBadge, ScoreBubble } from '@/components/ProductCard';
import { ProfitCalculator } from '@/components/ProfitCalculator';
import { LineChart } from '@/components/LineChart';
import { Meter } from '@/components/Meter';
import { Upgrade } from '@/components/Upgrade';
import { SaveButton } from '@/components/SaveButton';
import { ProductPhoto } from '@/components/ProductPhoto';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = await getSession();
  const d = await getProduct(slug, s.ent);
  return { title: d ? d.product.name : 'Product' };
}

const SATURATION = {
  fresh: ['good', 'Fresh — early-mover window'],
  building: ['gold', 'Building momentum'],
  saturating: ['warn', 'Getting crowded'],
  saturated: ['bad', 'Saturated — needs a new angle'],
} as const;

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [s, settings] = await Promise.all([getSession(), getSettings()]);
  const d = await getProduct(slug, s.ent);
  if (!d) notFound();
  const { product: p, outOfPlan } = d;
  const f = settings.features;

  let saved = false;
  if (s.user) {
    const { data } = await supabaseAdmin().from('saved_products').select('product_id').eq('user_id', s.user.id).eq('product_id', p.id).maybeSingle();
    saved = !!data;
  }
  const insight = analyseHistory(d.snapshots);
  const links = researchLinks(p.keyword || p.name, p.market);

  if (outOfPlan)
    return (
      <div className="stack">
        <Link href="/products" className="small">← All products</Link>
        <h1>{p.name}</h1>
        <Upgrade title="This product is in the archive">
          It was last on the radar {fmtDate(p.last_seen)}. Your plan includes the last {s.ent.limits.historyDays} day(s).
        </Upgrade>
      </div>
    );

  return (
    <div className="stack">
      <Link href="/products" className="small">← All products</Link>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card flat" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="pcard" style={{ border: 0, boxShadow: 'none' }}>
            <div className="ph">
              <ProductPhoto src={p.image} alt={p.name} w={800} h={600} niche={p.niche} />
            </div>
          </div>
        </div>
        <div className="stack">
          <div className="row between">
            <MarketBadge market={p.market} />
            {s.user ? <SaveButton productId={p.id} initiallySaved={saved} /> : <Link className="btn sm" href={`/login?next=/products/${p.slug}`}>☆ Save</Link>}
          </div>
          <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <ScoreBubble score={p.score} />
            <div>
              <h1 style={{ fontSize: '1.9rem', marginBottom: 4 }}>{p.name}</h1>
              <div className="muted small">{p.niche} · on radar {p.days_seen} day(s) since {fmtDate(p.first_seen)}</div>
            </div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {p.verdict && <span className={`badge ${p.verdict === 'Winner' ? 'good' : 'gold'}`}>{p.verdict}</span>}
            {p.trend && <span className="badge">Trend: {p.trend}</span>}
            {p.competition && <span className="badge">Competition: {p.competition}</span>}
            {p.proof_level && <span className="badge">{PROOF_LABEL[p.proof_level]}</span>}
          </div>
          <div className="grid grid-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat"><div className="k">Sell price</div><div className="v">{money(p.price, p.currency)}</div></div>
            <div className="stat"><div className="k">Cost</div><div className="v">{p.locked ? '🔒' : money(p.cost, p.currency)}</div></div>
            <div className="stat"><div className="k">Markup</div><div className="v">{p.markup ? `${p.markup.toFixed(1)}×` : '—'}</div></div>
          </div>
          {p.why && <p><strong>Why it sells:</strong> {p.why}</p>}
          {p.locked ? (
            <Upgrade title="Supplier, source, ad idea, audience and risks">Included in Pro — plus trend history and competitor research.</Upgrade>
          ) : (
            <div className="stack small">
              {p.audience && <p><strong>Who buys:</strong> {p.audience}</p>}
              {p.ad_idea && <p><strong>Ad idea:</strong> {p.ad_idea}</p>}
              {p.risk && <p><strong>Risk:</strong> {p.risk}</p>}
              {p.where_to_sell && <p><strong>Where to sell:</strong> {p.where_to_sell}</p>}
              <div className="row">
                {p.supplier && <a className="btn sm" href={p.supplier} target="_blank" rel="noopener noreferrer nofollow">Supplier ↗</a>}
                {p.source && <a className="btn sm" href={p.source} target="_blank" rel="noopener noreferrer nofollow">Sales proof ↗</a>}
              </div>
            </div>
          )}
        </div>
      </div>

      {!p.locked && p.score_parts.length > 0 && (
        <section className="card">
          <h2>Score breakdown</h2>
          <div className="grid grid-3">
            {p.score_parts.map((sp) => (
              <div key={sp.label}>
                <div className="row between small"><span>{sp.label}</span><strong>{sp.value}/10</strong></div>
                <Meter value={sp.value} />
              </div>
            ))}
          </div>
        </section>
      )}

      {f.calculator && (
        <section className="stack">
          <h2>Will it make money for you?</h2>
          <ProfitCalculator initial={inputsFromProduct(p)} currency={p.currency} productId={p.id} canSave={s.ent.limits.calcSave} signedIn={!!s.user} />
        </section>
      )}

      {f.trendHistory && (
        <section className="card stack">
          <div className="panel-title">
            <h2 style={{ margin: 0 }}>Trend & saturation</h2>
            {s.ent.limits.trendHistory && <span className={`badge ${SATURATION[insight.saturation][0]}`}>{SATURATION[insight.saturation][1]}</span>}
          </div>
          {!s.ent.limits.trendHistory ? (
            <Upgrade title="Score, price and competition history">See whether a product is still early or already saturated before you buy stock.</Upgrade>
          ) : (
            <>
              {insight.notes.length > 0 && <ul>{insight.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
              <div className="grid grid-2">
                <div>
                  <h3>Score</h3>
                  <LineChart label="Score" points={d.snapshots.map((x) => ({ x: x.date, y: x.score }))} format={(v) => v.toFixed(0)} />
                </div>
                <div>
                  <h3>Selling price</h3>
                  <LineChart label="Price" points={d.snapshots.filter((x) => x.price !== null).map((x) => ({ x: x.date, y: x.price! }))} format={(v) => money(v, p.currency)} />
                </div>
              </div>
              <details>
                <summary className="small" style={{ cursor: 'pointer' }}>Show as table</summary>
                <div className="table-wrap" style={{ marginTop: 8 }}>
                  <table>
                    <thead><tr><th>Date</th><th className="num">Score</th><th className="num">Price</th><th>Competition</th><th>Trend</th></tr></thead>
                    <tbody>
                      {d.snapshots.map((x) => (
                        <tr key={x.date}><td>{x.date}</td><td className="num">{x.score}</td><td className="num">{money(x.price, p.currency)}</td><td>{x.competition}</td><td>{x.trend}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </section>
      )}

      {f.competitors && (
        <section className="card stack">
          <h2>Competitor & ad research</h2>
          {!s.ent.limits.competitors ? (
            <Upgrade title="Competitor stores, live ads and supplier searches">One click into Facebook Ad Library, TikTok Creative Center, Daraz, Amazon and suppliers — pre-filled for this product.</Upgrade>
          ) : (
            <>
              {d.competitors.length > 0 && (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Type</th><th>Competitor</th><th>Note</th></tr></thead>
                    <tbody>
                      {d.competitors.map((c) => (
                        <tr key={c.id}>
                          <td><span className="badge">{c.kind}</span></td>
                          <td><a href={c.url} target="_blank" rel="noopener noreferrer nofollow">{c.title || new URL(c.url).hostname} ↗</a></td>
                          <td className="small">{c.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {(['Ads', 'Marketplaces', 'Suppliers', 'Demand'] as const).map((g) => (
                <div key={g}>
                  <div className="lbl">{g}</div>
                  <div className="row">
                    {links.filter((l) => l.group === g).map((l) => (
                      <a key={l.label} className="btn sm" href={l.url} target="_blank" rel="noopener noreferrer nofollow">{l.label} ↗</a>
                    ))}
                  </div>
                </div>
              ))}
              <p className="hint">Check: how many active ads, how long they have run, what price competitors charge, and their review complaints — that is your angle.</p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
