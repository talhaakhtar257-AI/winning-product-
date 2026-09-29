import type { NextConfig } from 'next';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const csp = [
  "default-src 'self'",
  // Next.js App Router needs inline bootstrap scripts.
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' https: data: blob:",
  `connect-src 'self' ${supabase} ${supabase.replace('https://', 'wss://')}`.trim(),
  "form-action 'self' https://*.lemonsqueezy.com https://*.paddle.com",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
].join('; ');

const config: NextConfig = {
  poweredByHeader: false,
  // Payment screenshots (≤5 MB) are uploaded through a server action.
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default config;
