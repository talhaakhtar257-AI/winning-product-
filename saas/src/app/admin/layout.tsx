import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AdminNav } from './AdminNav';

export const metadata: Metadata = { title: 'Admin', robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireRole('staff');
  const { count } = await supabaseAdmin().from('manual_payments').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  return (
    <div className="admin-shell">
      <AdminNav role={s.profile.role} pending={count ?? 0} />
      <div className="stack" style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}
