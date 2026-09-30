import type { ValidationInput, ValidationResult } from '@/lib/score/rubric';
import { money } from '@/lib/format';
import { Meter } from './Meter';

const TONE = { Winner: 'good', Promising: 'gold', Risky: 'warn', Skip: 'bad' } as const;

export function ValidationReport({ input, result }: { input: ValidationInput; result: ValidationResult }) {
  const cur = input.market === 'Pakistan' ? 'PKR' : 'USD';
  return (
    <div className="stack">
      <div className="card row between">
        <div>
          <h1 style={{ marginBottom: 4 }}>{input.name}</h1>
          <div className="muted">
            {input.market} · {input.niche || 'No niche'} · sells {money(input.sellPrice, cur)} · costs {money(input.productCost, cur)} · {result.markup}× markup
          </div>
        </div>
        <div className="row">
          <span className={`score${result.score < 80 ? ' mid' : ''}`} style={{ width: 64, height: 64, fontSize: '1.4rem' }}>{result.score}</span>
          <span className={`badge ${TONE[result.verdict]}`} style={{ fontSize: '1rem' }}>{result.verdict}</span>
        </div>
      </div>
      {result.blockers.length > 0 && (
        <div className="alert bad"><strong>Deal-breakers:</strong> <ul style={{ margin: 0 }}>{result.blockers.map((b) => <li key={b}>{b}</li>)}</ul></div>
      )}
      <div className="card">
        <h2>Score breakdown</h2>
        <div className="grid grid-3">
          {result.criteria.map((c) => (
            <div key={c.key}>
              <div className="row between small"><span>{c.label} <span className="muted">({c.weight}%)</span></span><strong>{c.value}/10</strong></div>
              <Meter value={c.value} />
            </div>
          ))}
        </div>
      </div>
      {result.tips.length > 0 && (
        <div className="card">
          <h2>How to improve your odds</h2>
          <ol>{result.tips.map((t) => <li key={t} style={{ marginBottom: 6 }}>{t}</li>)}</ol>
        </div>
      )}
    </div>
  );
}
