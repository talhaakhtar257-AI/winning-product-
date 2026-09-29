'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export function FilterBar({ niches, days, exportAllowed }: { niches: string[]; days: string[]; exportAllowed: boolean }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  function update(form: HTMLFormElement) {
    const params = new URLSearchParams();
    new FormData(form).forEach((v, k) => {
      const s = String(v).trim();
      if (s && s !== 'all' && !(k === 'sort' && s === 'score') && !(k === 'day' && s === 'latest') && !(k === 'minMarkup' && s === '0')) params.set(k, s);
    });
    start(() => router.push(`/products${params.size ? '?' + params : ''}`));
  }

  const v = (k: string, d = 'all') => sp.get(k) ?? d;
  const exportHref = `/api/export?${sp.toString()}`;

  return (
    <form
      className="card flat stack"
      onSubmit={(e) => { e.preventDefault(); update(e.currentTarget); }}
      onChange={(e) => { if ((e.target as HTMLElement).tagName === 'SELECT') update(e.currentTarget); }}
      aria-busy={pending}
    >
      <div className="row">
        <input className="field" style={{ flex: '1 1 240px' }} type="search" name="q" defaultValue={v('q', '')} placeholder="Search products, niches, buyers…" maxLength={80} aria-label="Search" />
        <button className="btn primary" type="submit">{pending ? 'Loading…' : 'Search'}</button>
        {exportAllowed ? <a className="btn" href={exportHref}>Export CSV</a> : <a className="btn" href="/pricing" title="Pro feature">🔒 Export CSV</a>}
      </div>
      <div className="form-grid">
        <Select name="market" label="Market" value={v('market')} options={[['all', 'Both'], ['Global', '🌍 Global'], ['Pakistan', '🇵🇰 Pakistan']]} />
        <Select name="niche" label="Niche" value={v('niche')} options={[['all', 'All niches'], ...niches.map((n) => [n, n] as [string, string])]} />
        <Select name="day" label="Day" value={v('day', 'latest')} options={[['latest', 'Latest'], ['all', 'All my history'], ...days.map((d) => [d, d] as [string, string])]} />
        <Select name="sort" label="Sort" value={v('sort', 'score')} options={[['score', 'Best score'], ['new', 'Newest'], ['markup', 'Highest markup'], ['price-asc', 'Price ↑'], ['price-desc', 'Price ↓']]} />
        <Select name="verdict" label="Verdict" value={v('verdict')} options={[['all', 'Any'], ['Winner', 'Winner'], ['Promising', 'Promising']]} />
        <Select name="proof" label="Proof" value={v('proof')} options={[['all', 'Any'], ['hard', 'Sales proof'], ['popular', 'Popular'], ['opinion', 'Opinion']]} />
        <Select name="competition" label="Competition" value={v('competition')} options={[['all', 'Any'], ['Low', 'Low'], ['Medium', 'Medium'], ['High', 'High']]} />
        <Select name="trend" label="Trend" value={v('trend')} options={[['all', 'Any'], ['Hot', 'Hot'], ['Rising', 'Rising'], ['Stable', 'Stable'], ['Falling', 'Falling']]} />
        <Select name="minMarkup" label="Min markup" value={v('minMarkup', '0')} options={[['0', 'Any'], ['2', '2×+'], ['3', '3×+'], ['4', '4×+']]} />
      </div>
    </form>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: [string, string][] }) {
  return (
    <div>
      <label className="lbl" htmlFor={`f-${name}`}>{label}</label>
      <select className="field" id={`f-${name}`} name={name} defaultValue={value}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
