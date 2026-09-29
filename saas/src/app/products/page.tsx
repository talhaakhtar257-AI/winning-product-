import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getSession } from '@/lib/auth';
import { filtersSchema, listDays, listNiches, listProducts } from '@/lib/data/products';
import { ProductCard } from '@/components/ProductCard';
import { Upgrade } from '@/components/Upgrade';
import { fmtDate } from '@/lib/format';
import { FilterBar } from './FilterBar';

export const metadata: Metadata = { title: 'Winning products' };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await getSession();
  const f = filtersSchema.parse(sp);
  const [res, niches, days] = await Promise.all([listProducts(f, s.ent), listNiches(), listDays(s.ent)]);
  const pageHref = (p: number) => {
    const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    q.set('page', String(p));
    return `/products?${q}`;
  };

  return (
    <div className="stack">
      <div className="row between">
        <div>
          <h1 style={{ marginBottom: 4 }}>Winning products</h1>
          <p className="muted" style={{ margin: 0 }}>
            Updated {fmtDate(res.latest)} · {res.total} products on your plan
            {!s.ent.paid && ' · Free plan shows today’s top 10'}
          </p>
        </div>
        {!s.ent.paid && <Link className="btn accent" href="/pricing">Unlock everything</Link>}
      </div>

      <Suspense>
        <FilterBar niches={niches} days={days} exportAllowed={s.ent.limits.export} />
      </Suspense>

      {res.items.length === 0 ? (
        <div className="card">
          <h3>No products match</h3>
          <p className="muted">Try clearing a filter or switching the day to “All my history”.</p>
          <Link className="btn" href="/products">Clear filters</Link>
        </div>
      ) : (
        <div className="grid grid-3">
          {res.items.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}

      {res.pages > 1 && (
        <nav className="row" aria-label="Pages" style={{ justifyContent: 'center' }}>
          {res.page > 1 && <Link className="btn sm" href={pageHref(res.page - 1)}>← Previous</Link>}
          <span className="muted small">Page {res.page} of {res.pages}</span>
          {res.page < res.pages && <Link className="btn sm" href={pageHref(res.page + 1)}>Next →</Link>}
        </nav>
      )}

      {res.lockedCount > 0 && (
        <Upgrade title={`${res.lockedCount} more matching products are locked`}>
          Your plan shows {s.ent.limits.historyDays === 1 ? 'today only' : `the last ${s.ent.limits.historyDays} days`}
          {s.ent.limits.maxProducts < 1000 ? ` and up to ${s.ent.limits.maxProducts} products` : ''}. Upgrade for the full archive,
          suppliers, trend history and competitor research.
        </Upgrade>
      )}
    </div>
  );
}
