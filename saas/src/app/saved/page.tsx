import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { redactProduct } from '@/lib/entitlements';
import type { Product } from '@/lib/data/products';
import type { ProfitResult } from '@/lib/calc/profit';
import { ProductCard } from '@/components/ProductCard';
import { fmtDate, money } from '@/lib/format';
import { deleteScenario } from '../actions';

export const metadata: Metadata = { title: 'Saved' };

export default async function SavedPage() {
  const s = await requireUser('/saved');
  const db = supabaseAdmin();
  const [{ data: saved }, { data: scenarios }] = await Promise.all([
    db.from('saved_products').select('products(*)').eq('user_id', s.user.id).order('created_at', { ascending: false }).limit(500),
    db.from('calc_scenarios').select('id, name, result, created_at, products(name, slug, currency)').eq('user_id', s.user.id).order('created_at', { ascending: false }).limit(100),
  ]);
  const products = (saved ?? [])
    .map((r) => r.products as unknown as Product | null)
    .filter((p): p is Product => !!p)
    .map((p) => redactProduct(p, s.ent.limits));

  return (
    <div className="stack">
      <h1>Saved</h1>
      <section className="stack">
        <h2>Products ({products.length}/{s.ent.limits.savedMax >= 1_000_000 ? '∞' : s.ent.limits.savedMax})</h2>
        {products.length === 0 ? (
          <p className="muted">Tap ☆ Save on any product to build your shortlist. <Link href="/products">Browse products →</Link></p>
        ) : (
          <div className="grid grid-3">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        )}
      </section>
      <section className="stack">
        <h2>Profit scenarios</h2>
        {!scenarios?.length ? (
          <p className="muted">{s.ent.limits.calcSave ? 'Save a scenario from the calculator to compare options.' : 'Saving scenarios is included in Pro.'}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Scenario</th><th>Product</th><th className="num">Profit / order</th><th className="num">Margin</th><th>Verdict</th><th>Date</th><th /></tr></thead>
              <tbody>
                {scenarios.map((sc) => {
                  const r = sc.result as ProfitResult;
                  const prod = sc.products as unknown as { name: string; slug: string; currency: string } | null;
                  return (
                    <tr key={sc.id}>
                      <td>{sc.name}</td>
                      <td>{prod ? <Link href={`/products/${prod.slug}`}>{prod.name}</Link> : '—'}</td>
                      <td className="num">{money(r.profitPerDelivered, prod?.currency ?? 'USD')}</td>
                      <td className="num">{Math.round(r.margin * 100)}%</td>
                      <td>{r.verdict}</td>
                      <td>{fmtDate(sc.created_at)}</td>
                      <td>
                        <form action={deleteScenario.bind(null, sc.id)}><button className="btn sm danger" type="submit">Delete</button></form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
