import { getPlans, getSettings } from '@/lib/data/settings';
import { setupChecklist } from '@/lib/setup';

export async function SetupChecklist({ productCount, lastIngestAt, lastIngestError }: { productCount: number; lastIngestAt: string | null; lastIngestError: string | null }) {
  const [settings, plans] = await Promise.all([getSettings(), getPlans(true)]);
  const items = setupChecklist({ env: process.env, settings, plans, productCount, lastIngestAt, lastIngestError });
  const done = items.filter((i) => i.ok).length;
  return (
    <section className="card">
      <div className="panel-title">
        <h2 style={{ margin: 0 }}>Setup checklist</h2>
        <span className={`badge ${done === items.length ? 'good' : 'warn'}`}>{done}/{items.length} done</span>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
        {items.map((i) => (
          <li key={i.key}>
            <strong>{i.ok ? '✅' : '⬜'} {i.label}</strong>
            {!i.ok && <div className="small muted">{i.fix}</div>}
          </li>
        ))}
      </ul>
    </section>
  );
}
