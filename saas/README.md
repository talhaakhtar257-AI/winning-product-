# WinScout SaaS

The paid version of the WinScout winning-product radar. It answers the one question sellers pay for: **"Will this product make me money in my market before I spend on ads and stock?"**

The existing Make.com automation keeps working unchanged. Every day's products flow into this app's database automatically.

## What sellers get

| Problem | Feature |
|---|---|
| "I don't know what to sell" | **Product database.** Daily AI-scored products for Global and Pakistan: 9-criteria score, proof level, filters, search, CSV export. |
| "I sold, but lost money" | **True profit calculator.** Counts marketplace, payment and COD fees, delivery, **COD returns (RTO)**, damaged stock and ad cost. Shows break-even CPA/ROAS and the **maximum return rate you can survive**. Includes Daraz, Shopify, TikTok Shop and Amazon FBA presets, plus TCS, Leopards, PostEx, Trax and M&P courier presets. |
| "Everyone is already selling it" | **Trend and saturation history.** Daily snapshots of score, price and competition, with Fresh → Saturated labels. |
| "Who are my competitors?" | **Competitor and ad research.** One-click Ad Library, TikTok Creative Center, Daraz, Amazon and supplier searches, plus competitor stores you curate. |
| "Is *my* idea any good?" | **Validate my product.** 12 questions → score, verdict, deal-breakers and a fix-list. Reports can be shared. |

Free vs paid access is enforced **on the server**. Visitors cannot read the products table directly because RLS blocks it, and locked fields are removed before rendering.

## What the owner controls (`/admin`)

- **Dashboard:** card MRR, manual PKR revenue, paying users, conversion, churn, pending payments, feed health alerts.
- **Payments:** JazzCash/Easypaisa/bank approval queue with screenshot preview (approving activates or extends the plan), plus card subscriptions.
- **Users:** search, change plan, comp or extend access, ban. Only owners can change roles.
- **Products:** edit, hide, feature or delete (including bulk), add manually, curate competitors, view daily snapshots.
- **Plans and pricing:** USD/PKR prices, feature limits, Lemon Squeezy/Paddle IDs. Changes go live on `/pricing` instantly.
- **Design and settings:** brand name and logo, colours with live preview, corner radius, hero text, announcement bar, FAQ, local payment accounts, and feature switches (turn any module or sign-ups on or off).
- **Logs and audit:** import runs, webhook deliveries, and every admin action.

Roles: `owner` > `admin` > `staff` > `user`. **The first account to sign up becomes the owner.**

## Setup (about 30 minutes)

1. **Supabase.** Create a project, then run `npx supabase link --project-ref <ref>` and `npx supabase db push` (this applies `supabase/migrations`).
   - Auth → URL configuration: set Site URL to your app URL and add `https://YOUR-APP/auth/callback` as a redirect.
   - Optional: enable Google under Auth → Providers.
2. **Vercel.** Import this repo and set **Root Directory = `saas`**. Add every variable from `.env.example`. The cron job in `vercel.json` runs plan expiry daily.
3. **Sign up** on the deployed app. You are now the owner. Open **Admin → Design & settings** and fill in your brand details and your JazzCash/Easypaisa/bank accounts.
4. **Import product history** (one time), in either of these ways:
   - Run `npm run import:products -- --git-history` locally with the env vars set.
   - Run the **Sync products** GitHub Action with "full history".
5. **Daily feed.** Use either option, or both:
   - Add repo secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Every Make.com commit to `products.json` is then imported by `.github/workflows/sync-products.yml`.
   - Or add an HTTP module to the Make.com scenario: `POST https://YOUR-APP/api/ingest` with header `Authorization: Bearer <INGEST_SECRET>` and body `{"products":[…]}`.
6. **Card payments** (merchant of record, which works for Pakistan-based owners):
   - **Lemon Squeezy:** create a subscription product per plan and paste each variant ID into Admin → Plans. Add a webhook to `https://YOUR-APP/api/webhooks/lemonsqueezy` for all `subscription_*` events.
   - **Paddle** (optional): create prices, paste the price IDs, and set a default payment link. Point notifications to `/api/webhooks/paddle`, then switch it on in Admin → Design & settings → Feature switches.

## Develop and test

```bash
cd saas
npm install
npx supabase start          # local Postgres/Auth/Storage in Docker; copy keys into .env.local
npm run import:products -- --git-history
npm run dev

npm run lint && npm run typecheck && npm test    # unit tests: calculator, scoring, billing, entitlements, import
npm run build && npm start &
npm run e2e                  # browser flows: paywall, sign-up, owner design changes, webhook → Pro, manual payment approval
```

Set `PW_CHROMIUM_PATH` to use an already-installed Chromium for e2e.

## Architecture

- **Stack:** Next.js 15 (App Router, server actions) and Supabase (Postgres + RLS, Auth, Storage).
- **Business logic** lives in pure, unit-tested modules:
  - `src/lib/calc/profit.ts`
  - `src/lib/score/rubric.ts`
  - `src/lib/entitlements.ts`
  - `src/lib/products/normalize.ts`
  - `src/lib/billing/*`
- **Webhooks** are HMAC-verified (Paddle also has replay protection) and idempotent through `webhook_events`. A card downgrade never overwrites a manual or comp plan.
- **Owner settings** are validated with zod; colour values must be hex, which blocks CSS injection.
- **Security:** CSP and security headers are in `next.config.ts`. Rate limits cover ingest, exports and manual payments. Payment proofs sit in a private bucket and staff view them only through 2-minute signed URLs.
