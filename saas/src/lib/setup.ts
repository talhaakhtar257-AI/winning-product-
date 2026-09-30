import type { Settings } from './settings';

// Go-live checklist for the owner. Only reports whether things are set — never values.

export interface SetupItem {
  key: string;
  label: string;
  ok: boolean;
  fix: string;
}

export interface SetupInput {
  env: Record<string, string | undefined>;
  settings: Settings;
  plans: { id: string; lemon_variant_id: string | null; paddle_price_id: string | null }[];
  productCount: number;
  lastIngestAt: string | null;
  lastIngestError: string | null;
  now?: number;
}

export function setupChecklist(i: SetupInput): SetupItem[] {
  const site = i.env.NEXT_PUBLIC_SITE_URL ?? '';
  const now = i.now ?? Date.now();
  const fresh = i.lastIngestAt !== null && now - Date.parse(i.lastIngestAt) < 36 * 3_600_000 && !i.lastIngestError;
  const p = i.settings.payments;
  const paidPlans = i.plans.filter((x) => x.id !== 'free');
  return [
    {
      key: 'site',
      label: 'Public site address set',
      ok: /^https:\/\//.test(site) && !/localhost|127\.0\.0\.1/.test(site),
      fix: 'Vercel → Settings → Environment Variables: set NEXT_PUBLIC_SITE_URL to your https address, then Redeploy.',
    },
    {
      key: 'cron',
      label: 'Daily plan-expiry job protected',
      ok: (i.env.CRON_SECRET ?? '').length >= 16,
      fix: 'Vercel → Environment Variables: add CRON_SECRET (32+ random characters), then Redeploy.',
    },
    {
      key: 'products',
      label: 'Products imported and fresh (last 36 hours)',
      ok: i.productCount > 0 && fresh,
      fix: 'GitHub → Settings → Secrets → Actions: add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then run the “Sync products” action.',
    },
    {
      key: 'brand',
      label: 'Support contact added',
      ok: !!(i.settings.brand.supportEmail || i.settings.brand.whatsapp),
      fix: 'Admin → Design & settings → Brand: add a support email or WhatsApp number.',
    },
    {
      key: 'local-pay',
      label: 'JazzCash / Easypaisa / bank details filled',
      ok:
        !i.settings.features.manualPayments ||
        (p.jazzcash.enabled && !!p.jazzcash.number) ||
        (p.easypaisa.enabled && !!p.easypaisa.number) ||
        (p.bank.enabled && !!p.bank.iban),
      fix: 'Admin → Design & settings → Local payment accounts.',
    },
    {
      key: 'card-pay',
      label: 'Card checkout ready (Lemon Squeezy)',
      ok:
        !i.settings.features.lemonsqueezy ||
        (!!i.env.LEMONSQUEEZY_API_KEY && !!i.env.LEMONSQUEEZY_STORE_ID && !!i.env.LEMONSQUEEZY_WEBHOOK_SECRET &&
          paidPlans.some((x) => !!x.lemon_variant_id)),
      fix: 'Add LEMONSQUEEZY_* keys in Vercel and a variant ID per plan in Admin → Plans (or switch card checkout off).',
    },
  ];
}
