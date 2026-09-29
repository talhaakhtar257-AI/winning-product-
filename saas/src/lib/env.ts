import { z } from 'zod';

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  INGEST_SECRET: z.string().min(24).optional(),
  CRON_SECRET: z.string().min(16).optional(),
  LEMONSQUEEZY_API_KEY: z.string().optional(),
  LEMONSQUEEZY_STORE_ID: z.string().optional(),
  LEMONSQUEEZY_WEBHOOK_SECRET: z.string().optional(),
  PADDLE_API_KEY: z.string().optional(),
  PADDLE_WEBHOOK_SECRET: z.string().optional(),
  PADDLE_SANDBOX: z.enum(['true', 'false']).default('true'),
});

export type Env = z.infer<typeof schema>;
let cached: Env | null = null;

/** Validated server env. Throws a clear message listing what is missing. */
export function env(): Env {
  if (cached) return cached;
  const r = schema.safeParse(process.env);
  if (!r.success) {
    const missing = r.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid or missing environment variables: ${missing}. See saas/.env.example.`);
  }
  cached = r.data;
  return cached;
}

export function siteUrl(path = ''): string {
  return new URL(path, process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').toString();
}
