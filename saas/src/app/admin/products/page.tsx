import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { fmtDate, money } from '@/lib/format';
import { ActionForm } from '@/components/ActionForm';
import { addProductManually, bulkProducts } from '../actions';

export default async function ProductsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole('staff');
  const sp = await searchParams;
  const q = (sp.q ?? '').replace(/[%_,()\\]/g, '').trim().slice(0, 80);
  const show = sp.show ?? 'all';
  const page = Math.max(1, Number(sp.page) || 1);
  let query = supabaseAdmin().from('products').select('id, slug, name, market, niche, score, price, currency, last_seen, days_seen, hidden, featured', { count: 'exact' });
  if (q) query = query.ilike('name', `%${q}%`);
  if (show === 'hidden') query = query.eq('hidden', true);
  if (show === 'featured') query = query.eq('featured', true);
  const { data, count } = await query.order('last_seen', { ascending: false }).order('score', { ascending: false }).range((page - 1) * 50, page * 50 - 1);
  const pages = Math.ceil((count ?? 0) / 50);
  const href = (p: number) => `/admin/products?q=${encodeURIComponent(q)}&show=${show}&page=${p}`;

  return (
    <>
      <h1>Products <span className="muted small">({count ?? 0})</span></h1>
      <form className="row" method="get">
        <input className="field" style={{ flex: 1 }} name="q" defaultValue={q} placeholder="Search name" />
        <select className="field" style={{ width: 150 }} name="show" defaultValue={show}>
          <option value="all">All</option><option value="featured">Featured</option><option value="hidden">Hidden</option>
        </select>
        <button className="btn" type="submit">Filter</button>
      </form>

      <form action={bulkProducts} className="stack">
        <div className="row">
          <span className="small muted">With selected:</span>
          {['feature', 'unfeature', 'hide', 'show', 'delete'].map((op) => (
            <button key={op} className={`btn sm${op === 'delete' ? ' danger' : ''}`} name="op" value={op} type="submit">{op}</button>
          ))}
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th><span className="sr-only">Select</span></th><th>Product</th><th>Market</th><th className="num">Score</th><th className="num">Price</th><th>Last seen</th><th className="num">Days</th><th>Flags</th></tr></thead>
            <tbody>
              {data?.map((p) => (
                <tr key={p.id}>
                  <td><input type="checkbox" name="ids" value={p.id} aria-label={`Select ${p.name}`} /></td>
                  <td><Link href={`/admin/products/${p.id}`}>{p.name}</Link><div className="small muted">{p.niche}</div></td>
                  <td>{p.market}</td>
                  <td className="num">{p.score}</td>
                  <td className="num">{money(p.price === null ? null : Number(p.price), p.currency)}</td>
                  <td>{fmtDate(p.last_seen)}</td>
                  <td className="num">{p.days_seen}</td>
                  <td>{p.featured && <span className="badge gold">featured</span>} {p.hidden && <span className="badge bad">hidden</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>
      {pages > 1 && (
        <div className="row">
          {page > 1 && <Link className="btn sm" href={href(page - 1)}>← Prev</Link>}
          <span className="small muted">Page {page} / {pages}</span>
          {page < pages && <Link className="btn sm" href={href(page + 1)}>Next →</Link>}
        </div>
      )}

      <details className="card">
        <summary style={{ fontWeight: 800, cursor: 'pointer' }}>+ Add a product manually</summary>
        <ActionForm action={addProductManually} submitLabel="Add product" className="stack">
          <div className="form-grid" style={{ marginTop: 12 }}>
            <In name="name" label="Name" required />
            <div>
              <label className="lbl" htmlFor="n-market">Market</label>
              <select className="field" id="n-market" name="market"><option>Global</option><option>Pakistan</option></select>
            </div>
            <In name="niche" label="Niche" />
            <In name="keyword" label="Search keyword" />
            <In name="score" label="Score (0-100)" inputMode="numeric" />
            <In name="price" label="Price" inputMode="decimal" />
            <In name="cost" label="Cost" inputMode="decimal" />
            <In name="verdict" label="Verdict (Winner/Promising)" />
            <In name="trend" label="Trend (Hot/Rising/Stable/Falling)" />
            <In name="competition" label="Competition (Low/Medium/High)" />
            <In name="image" label="Image URL (https)" />
            <In name="supplier" label="Supplier URL (https)" />
          </div>
          <div>
            <label className="lbl" htmlFor="n-why">Why it sells</label>
            <textarea className="field" id="n-why" name="why" maxLength={600} />
          </div>
        </ActionForm>
      </details>
    </>
  );
}

function In({ name, label, ...rest }: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="lbl" htmlFor={`n-${name}`}>{label}</label>
      <input className="field" id={`n-${name}`} name={name} {...rest} />
    </div>
  );
}
