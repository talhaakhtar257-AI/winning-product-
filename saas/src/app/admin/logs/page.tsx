import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

const dt = (d: string) => new Date(d).toISOString().replace('T', ' ').slice(0, 16);

export default async function LogsAdmin() {
  await requireRole('staff');
  const db = supabaseAdmin();
  const [{ data: audit }, { data: ingest }, { data: hooks }] = await Promise.all([
    db.from('audit_log').select('id, action, target_type, target_id, details, created_at, profiles(email)').order('created_at', { ascending: false }).limit(100),
    db.from('ingest_runs').select('*').order('id', { ascending: false }).limit(30),
    db.from('webhook_events').select('id, provider, event_name, processed_at, error, created_at').order('created_at', { ascending: false }).limit(50),
  ]);
  return (
    <>
      <h1>Logs & audit</h1>
      <section className="card">
        <h2>Product imports</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>When (UTC)</th><th>Source</th><th className="num">Received</th><th className="num">New</th><th className="num">Updated</th><th className="num">Snapshots</th><th>Error</th></tr></thead>
            <tbody>
              {ingest?.map((r) => (
                <tr key={r.id}><td>{dt(r.created_at)}</td><td>{r.source}</td><td className="num">{r.received}</td><td className="num">{r.inserted}</td><td className="num">{r.updated}</td><td className="num">{r.snapshots}</td><td className="bad-text small">{r.error}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2>Payment webhooks</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>When (UTC)</th><th>Provider</th><th>Event</th><th>Status</th></tr></thead>
            <tbody>
              {hooks?.map((h) => (
                <tr key={h.id}><td>{dt(h.created_at)}</td><td>{h.provider}</td><td>{h.event_name}</td><td>{h.error ? <span className="bad-text small">{h.error}</span> : h.processed_at ? <span className="badge good">processed</span> : <span className="badge warn">pending</span>}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2>Admin audit trail</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>When (UTC)</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
            <tbody>
              {audit?.map((a) => (
                <tr key={a.id}>
                  <td>{dt(a.created_at)}</td>
                  <td>{(a.profiles as unknown as { email: string } | null)?.email ?? 'system'}</td>
                  <td>{a.action}</td>
                  <td className="small">{a.target_type} {a.target_id?.slice(0, 8)}</td>
                  <td className="small" style={{ maxWidth: 360, wordBreak: 'break-word' }}>{JSON.stringify(a.details).slice(0, 200)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
