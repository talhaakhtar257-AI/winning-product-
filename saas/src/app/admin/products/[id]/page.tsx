import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { fmtDate } from '@/lib/format';
import { ActionForm } from '@/components/ActionForm';
import { addCompetitor, removeCompetitor, updateProduct } from '../../actions';

export default async function ProductAdmin({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('staff');
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const db = supabaseAdmin();
  const [{ data: p }, { data: comps }, { data: snaps }] = await Promise.all([
    db.from('products').select('*').eq('id', id).maybeSingle(),
    db.from('competitors').select('*').eq('product_id', id).order('created_at'),
    db.from('product_snapshots').select('date, score, price').eq('product_id', id).order('date', { ascending: false }).limit(30),
  ]);
  if (!p) notFound();
  const text = (name: string, label: string, max = 200) => (
    <div>
      <label className="lbl" htmlFor={`e-${name}`}>{label}</label>
      <input className="field" id={`e-${name}`} name={name} defaultValue={p[name] ?? ''} maxLength={max} />
    </div>
  );
  const area = (name: string, label: string, max: number) => (
    <div>
      <label className="lbl" htmlFor={`e-${name}`}>{label}</label>
      <textarea className="field" id={`e-${name}`} name={name} defaultValue={p[name] ?? ''} maxLength={max} />
    </div>
  );
  const sel = (name: string, label: string, opts: string[]) => (
    <div>
      <label className="lbl" htmlFor={`e-${name}`}>{label}</label>
      <select className="field" id={`e-${name}`} name={name} defaultValue={p[name] ?? ''}>
        {opts.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
    </div>
  );

  return (
    <>
      <div className="row between">
        <Link href="/admin/products" className="small">← Products</Link>
        {!p.hidden && <Link className="btn sm" href={`/products/${p.slug}`} target="_blank">View live ↗</Link>}
      </div>
      <h1>{p.name}</h1>
      <p className="muted small">{p.market} · first seen {fmtDate(p.first_seen)} · last seen {fmtDate(p.last_seen)} · {p.days_seen} day(s) · key <code>{p.dedup_key}</code></p>

      <section className="card">
        <ActionForm action={updateProduct} submitLabel="Save product">
          <input type="hidden" name="id" value={p.id} />
          <div className="form-grid">
            {text('name', 'Name', 120)}
            {text('niche', 'Niche', 60)}
            {text('score', 'Score', 3)}
            {sel('verdict', 'Verdict', ['', 'Winner', 'Promising', 'Risky', 'Skip'])}
            {sel('trend', 'Trend', ['', 'Hot', 'Rising', 'Stable', 'Falling'])}
            {sel('competition', 'Competition', ['', 'Low', 'Medium', 'High'])}
            {text('price', `Price (${p.currency})`, 12)}
            {text('cost', `Cost (${p.currency})`, 12)}
            {text('audience', 'Audience')}
            {text('where_to_sell', 'Where to sell')}
            {text('image', 'Image URL', 2048)}
            {text('supplier', 'Supplier URL', 2048)}
            {text('source', 'Proof / source URL', 2048)}
          </div>
          {area('why', 'Why it sells', 600)}
          {area('risk', 'Risk', 400)}
          {area('ad_idea', 'Ad idea', 400)}
          {area('admin_notes', 'Internal notes (never shown to users)', 1000)}
          <div className="row">
            <label className="check"><input type="checkbox" name="featured" defaultChecked={p.featured} /> Featured (pinned to top)</label>
            <label className="check"><input type="checkbox" name="hidden" defaultChecked={p.hidden} /> Hidden from users</label>
          </div>
          <p className="hint">Note: the next daily import for this product refreshes the feed fields (name, score, prices, texts). Hidden, featured and notes are always kept.</p>
        </ActionForm>
      </section>

      <section className="card stack">
        <h2>Competitors & ads</h2>
        {comps?.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Type</th><th>Link</th><th>Note</th><th /></tr></thead>
              <tbody>
                {comps.map((c) => (
                  <tr key={c.id}>
                    <td>{c.kind}</td>
                    <td><a href={c.url} target="_blank" rel="noopener noreferrer nofollow">{c.title || c.url}</a></td>
                    <td className="small">{c.note}</td>
                    <td><form action={removeCompetitor.bind(null, c.id, p.id)}><button className="btn sm danger" type="submit">Remove</button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No curated competitors yet. Pro users still get the auto research links.</p>
        )}
        <ActionForm action={addCompetitor} submitLabel="Add competitor">
          <input type="hidden" name="product_id" value={p.id} />
          <div className="form-grid">
            <div>
              <label className="lbl" htmlFor="c-kind">Type</label>
              <select className="field" id="c-kind" name="kind"><option value="store">Store</option><option value="ad">Ad</option><option value="video">Video</option><option value="listing">Listing</option></select>
            </div>
            <div><label className="lbl" htmlFor="c-url">URL (https)</label><input className="field" id="c-url" name="url" required /></div>
            <div><label className="lbl" htmlFor="c-title">Title</label><input className="field" id="c-title" name="title" maxLength={120} /></div>
            <div><label className="lbl" htmlFor="c-note">Note (price, ad age…)</label><input className="field" id="c-note" name="note" maxLength={300} /></div>
          </div>
        </ActionForm>
      </section>

      <section className="card">
        <h2>Daily snapshots</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th className="num">Score</th><th className="num">Price</th></tr></thead>
            <tbody>{snaps?.map((s) => <tr key={s.date}><td>{s.date}</td><td className="num">{s.score}</td><td className="num">{s.price ?? '—'}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
