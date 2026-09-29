import { z } from 'zod';

// Owner-editable site configuration (admin → Design & settings). Every value
// is validated so the owner can change design and copy without code deploys,
// and nothing unsafe (e.g. CSS injection via colour fields) can get in.

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #13201A');
const httpsOrEmpty = z.union([z.literal(''), z.string().url().startsWith('https://')]);
const short = (max: number) => z.string().trim().max(max);

export const settingsSchemas = {
  brand: z.object({
    name: short(40).min(1).default('WinScout'),
    tagline: short(80).default('Winning Product Radar'),
    logoUrl: httpsOrEmpty.default(''),
    supportEmail: z.union([z.literal(''), z.string().email()]).default(''),
    whatsapp: short(20).regex(/^[0-9+ ]*$/).default(''),
  }),
  theme: z.object({
    brand: hex.default('#13201A'),
    accent: hex.default('#E4A11B'),
    good: hex.default('#1F7342'),
    bad: hex.default('#A8361F'),
    radius: z.coerce.number().int().min(0).max(24).default(12),
  }),
  landing: z.object({
    heroTitle: short(140).default('Find your next winning product — before you spend on ads'),
    heroSubtitle: short(400).default(''),
    ctaLabel: short(30).default('Start free'),
    announcement: short(200).default(''),
    faq: z.array(z.object({ q: short(160).min(1), a: short(800).min(1) })).max(20).default([]),
  }),
  payments: z.object({
    jazzcash: z.object({ enabled: z.boolean().default(true), title: short(60).default(''), number: short(20).default('') }).default({}),
    easypaisa: z.object({ enabled: z.boolean().default(true), title: short(60).default(''), number: short(20).default('') }).default({}),
    bank: z.object({ enabled: z.boolean().default(true), bank: short(60).default(''), title: short(60).default(''), iban: short(34).default('') }).default({}),
    instructions: short(500).default(''),
  }),
  features: z.object({
    calculator: z.boolean().default(true),
    validator: z.boolean().default(true),
    competitors: z.boolean().default(true),
    trendHistory: z.boolean().default(true),
    manualPayments: z.boolean().default(true),
    lemonsqueezy: z.boolean().default(true),
    paddle: z.boolean().default(false),
    signups: z.boolean().default(true),
  }),
};

export type SettingsKey = keyof typeof settingsSchemas;
export type Settings = { [K in SettingsKey]: z.infer<(typeof settingsSchemas)[K]> };

export function parseSettings(rows: { key: string; value: unknown }[]): Settings {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as Record<string, unknown>;
  for (const key of Object.keys(settingsSchemas) as SettingsKey[]) {
    const r = settingsSchemas[key].safeParse(byKey.get(key) ?? {});
    out[key] = r.success ? r.data : settingsSchemas[key].parse({});
  }
  return out as Settings;
}

/** CSS custom properties injected into <html> — only validated hex values reach here. */
export function themeCss(t: Settings['theme']): string {
  return `:root{--brand:${t.brand};--hero:${t.brand};--accent:${t.accent};--good:${t.good};--bad:${t.bad};--r:${t.radius}px}`;
}
