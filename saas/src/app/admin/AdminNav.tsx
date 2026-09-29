'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS: [string, string, string][] = [
  ['/admin', 'Dashboard', 'staff'],
  ['/admin/payments', 'Payments', 'staff'],
  ['/admin/users', 'Users', 'staff'],
  ['/admin/products', 'Products', 'staff'],
  ['/admin/plans', 'Plans & pricing', 'admin'],
  ['/admin/design', 'Design & settings', 'admin'],
  ['/admin/logs', 'Logs & audit', 'staff'],
];
const RANK: Record<string, number> = { staff: 1, admin: 2, owner: 3 };

export function AdminNav({ role, pending }: { role: string; pending: number }) {
  const path = usePathname();
  return (
    <nav className="admin-nav" aria-label="Admin">
      {LINKS.filter(([, , min]) => RANK[role] >= RANK[min]).map(([href, label]) => {
        const active = href === '/admin' ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}>
            {label} {href === '/admin/payments' && pending > 0 && <span className="badge warn">{pending}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
