import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getSettings } from '@/lib/data/settings';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '/products';
  const [s, settings] = await Promise.all([getSession(), getSettings()]);
  if (s.user && sp.error !== 'banned') redirect(next);
  return (
    <div style={{ maxWidth: 440, margin: '40px auto' }} className="card stack">
      <h1 style={{ fontSize: '1.8rem' }}>Sign in to {settings.brand.name}</h1>
      <p className="muted">New here? Signing in creates your free account — no card needed.</p>
      {sp.error === 'banned' && <div className="alert bad">This account is suspended. Contact support.</div>}
      {sp.error === 'auth' && <div className="alert bad">That sign-in link expired. Please request a new one.</div>}
      <LoginForm next={next} signupsOpen={settings.features.signups} />
    </div>
  );
}
