import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Header } from '@/components/Header';
import { getSettings } from '@/lib/data/settings';
import { themeCss } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: `${s.brand.name} — ${s.brand.tagline}`, template: `%s · ${s.brand.name}` },
    description: s.landing.heroSubtitle || 'Daily winning products with real profit maths for Global and Pakistan sellers.',
    icons: { icon: '/favicon.svg' },
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Figtree:wght@400;500;600;700;800&display=swap" />
        {/* Owner-controlled theme (validated hex values only). */}
        <style dangerouslySetInnerHTML={{ __html: themeCss(s.theme) }} />
      </head>
      <body>
        <a className="sr-only" href="#main">Skip to content</a>
        <Header />
        <main id="main">
          <div className="wrap">{children}</div>
        </main>
        <footer className="foot">
          <div className="wrap row between">
            <span>© {new Date().getFullYear()} {s.brand.name}. Made in Karachi for sellers everywhere.</span>
            <span className="row">
              <Link href="/pricing">Pricing</Link>
              <Link href="/legal/terms">Terms</Link>
              <Link href="/legal/privacy">Privacy</Link>
              {s.brand.supportEmail && <a href={`mailto:${s.brand.supportEmail}`}>Support</a>}
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
