import Link from 'next/link';
import type { Product } from '@/lib/data/products';
import { money, PROOF_LABEL } from '@/lib/format';
import { ProductPhoto } from './ProductPhoto';

export function MarketBadge({ market }: { market: string }) {
  return market === 'Pakistan' ? <span className="badge pk">🇵🇰 Pakistan</span> : <span className="badge global">🌍 Global</span>;
}

export function ScoreBubble({ score }: { score: number }) {
  return (
    <span className={`score${score < 80 ? ' mid' : ''}`} aria-label={`Score ${score} out of 100`}>
      {score}
    </span>
  );
}

export function ProductCard({ p }: { p: Product }) {
  return (
    <Link className="pcard" href={`/products/${p.slug}`}>
      <div className="ph">
        <ProductPhoto src={p.image} niche={p.niche} />
      </div>
      <div className="body">
        <div className="row between">
          <MarketBadge market={p.market} />
          <ScoreBubble score={p.score} />
        </div>
        <h3>{p.name}</h3>
        <div className="row small muted">
          <span>{p.niche}</span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {p.verdict && <span className={`badge ${p.verdict === 'Winner' ? 'good' : 'gold'}`}>{p.verdict}</span>}
          {p.trend && <span className="badge">{p.trend === 'Hot' ? '🔥 ' : ''}{p.trend}</span>}
          {p.competition && <span className={`badge ${p.competition === 'Low' ? 'good' : p.competition === 'High' ? 'bad' : ''}`}>{p.competition} comp.</span>}
          {p.proof_level && <span className="badge">{PROOF_LABEL[p.proof_level] ?? p.proof_level}</span>}
        </div>
        <div className="row between" style={{ marginTop: 'auto' }}>
          <strong>{money(p.price, p.currency)}</strong>
          {p.markup ? <span className="small muted">{p.markup.toFixed(1)}× markup</span> : null}
        </div>
      </div>
    </Link>
  );
}
