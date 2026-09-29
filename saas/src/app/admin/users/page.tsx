import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { fmtDate } from '@/lib/format';

export default async function UsersAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole('staff');
  const sp = await searchParams;
  const q = (sp.q ?? '').replace(/[%_,()\\]/g, '').trim().slice(0, 120);
  const plan = sp.plan ?? 'all';
  const page = Math.max(1, Number(sp.page) || 1);
  let query = supabaseAdmin().from('profiles').select('id, email, full_name, role, plan_id, plan_status, plan_source, plan_expires_at, banned, created_at', { count: 'exact' });
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  if (plan !== 'all') query = query.eq('plan_id', plan);
  const { data, count } = await query.order('created_at', { ascending: false }).range((page - 1) * 50, page * 50 - 1);
  const pages = Math.ceil((count ?? 0) / 50);
  return (
    <>
      <h1>Users <span className="muted small">({count ?? 0})</span></h1>
      <form className="row" method="get">
        <input className="field" style={{ flex: 1 }} name="q" defaultValue={q} placeholder="Search email or name" />
        <select className="field" style={{ width: 160 }} name="plan" defaultValue={plan}>
          <option value="all">All plans</option><option value="free">Free</option><option value="pro">Pro</option><option value="business">Business</option>
        </select>
        <button className="btn" type="submit">Search</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Email</th><th>Role</th><th>Plan</th><th>Status</th><th>Expires</th><th>Joined</th></tr></thead>
          <tbody>
            {data?.map((u) => (
              <tr key={u.id}>
                <td><Link href={`/admin/users/${u.id}`}>{u.email}</Link>{u.banned && <span className="badge bad" style={{ marginLeft: 6 }}>banned</span>}<div className="small muted">{u.full_name}</div></td>
                <td>{u.role}</td>
                <td>{u.plan_id} <span className="small muted">({u.plan_source})</span></td>
                <td>{u.plan_status}</td>
                <td>{fmtDate(u.plan_expires_at)}</td>
                <td>{fmtDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="row">
          {page > 1 && <Link className="btn sm" href={`/admin/users?q=${encodeURIComponent(q)}&plan=${plan}&page=${page - 1}`}>← Prev</Link>}
          <span className="small muted">Page {page} / {pages}</span>
          {page < pages && <Link className="btn sm" href={`/admin/users?q=${encodeURIComponent(q)}&plan=${plan}&page=${page + 1}`}>Next →</Link>}
        </div>
      )}
    </>
  );
}
