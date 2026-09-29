import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { getSettings } from '@/lib/data/settings';
import { hasRole } from '@/lib/entitlements';
import { Logo } from './Logo';

export async function Header() {
  const [s, settings] = await Promise.all([getSession(), getSettings()]);
  const f = settings.features;
  return (
    <>
      {settings.landing.announcement && <div className="announce">{settings.landing.announcement}</div>}
      <header className="top">
        <div className="wrap top-in">
          <Link className="brand" href="/">
            <Logo url={settings.brand.logoUrl} name={settings.brand.name} />
            {settings.brand.name}
          </Link>
          <nav className="nav" aria-label="Main">
            <Link href="/products">Products</Link>
            {f.calculator && <Link href="/calculator">Profit calculator</Link>}
            {f.validator && <Link href="/validate">Validate idea</Link>}
            <Link href="/pricing">Pricing</Link>
            {s.user ? (
              <>
                <Link href="/saved">Saved</Link>
                <Link href="/account">Account</Link>
                {hasRole(s.profile?.role, 'staff') && <Link href="/admin">Admin</Link>}
              </>
            ) : (
              <Link className="btn primary sm" href="/login">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}
