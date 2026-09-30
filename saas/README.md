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

## Go-live setup (about 45 minutes)

Use the **Mumbai** region everywhere. `vercel.json` pins the app to Vercel `bom1`, so the database must be in Mumbai too. Keys go straight from Supabase into Vercel and GitHub. Never paste them into chats or commit them.

1. **Create the Supabase project.**
   - Sign in at supabase.com with the email you'll use as the WinScout owner.
   - Click New project: name `winscout`, set a strong database password (save it in a password manager), region **South Asia (Mumbai)**, Free plan.
2. **Create the database.**
   - Open SQL Editor → New query.
   - Paste all of [`supabase/migrations/20260929000000_init.sql`](https://raw.githubusercontent.com/talhaakhtar257-AI/winning-product-/main/saas/supabase/migrations/20260929000000_init.sql) and click **Run**.
   - You should see “Success. No rows returned”.
3. **Find your keys.** Project Settings → API Keys has the **Project URL**, the **Publishable key** and the **Secret key**. Legacy `anon` / `service_role` keys work too.
4. **Deploy on Vercel.**
   - At vercel.com, sign up with GitHub and click **Add New → Project**. Import `winning-product-`.
   - Set **Root Directory = `saas`**.
   - Add these environment variables:
     | Variable | Value |
     |---|---|
     | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
     | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key |
     | `SUPABASE_SERVICE_ROLE_KEY` | Secret key |
     | `NEXT_PUBLIC_SITE_URL` | `https://<project-name>.vercel.app` |
     | `CRON_SECRET` | 32+ random characters (from a password generator) |
   - Click **Deploy**. If Vercel gives a different domain, update `NEXT_PUBLIC_SITE_URL` and **Redeploy**.
5. **Set auth URLs in Supabase.** Go to Authentication → URL Configuration.
   - **Site URL** = your Vercel URL.
   - **Redirect URLs** = `https://<your-domain>/**`
6. **Turn on Google sign-in.** Supabase's built-in email only reaches your own team, so customers sign in with Google.
   - In Google Cloud Console, create a project. Then open **OAuth consent screen**: choose External, set app name and support email, then **Publish app**.
   - Go to **Credentials → Create OAuth client ID → Web application**:
     - Authorized JavaScript origin: your Vercel URL
     - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Paste the Client ID and Secret into Supabase → Authentication → Sign In / Providers → **Google** → Enable.
7. **Become the owner.**
   - Open your site and click **Continue with Google**. The first account becomes the owner.
   - In **Admin → Design & settings**, fill in your brand and local payment accounts.
   - Switch **off** “Email sign-in links” until you add custom SMTP (Supabase → Authentication → Emails → SMTP, e.g. Resend with your own domain).
   - The **Setup checklist** on the Admin dashboard shows what's left.
8. **Load products.**
   - In GitHub, go to the repo's Settings → Secrets and variables → **Actions**. Add `SUPABASE_URL` (Project URL) and `SUPABASE_SERVICE_ROLE_KEY` (Secret key).
   - Open **Actions → Sync products to SaaS database → Run workflow**, and tick **full history**.
   - After that, every Make.com update to `products.json` syncs automatically.
   - Alternative: call `POST /api/ingest` from Make with `Authorization: Bearer <INGEST_SECRET>` (add `INGEST_SECRET` in Vercel).
9. **Card payments** (merchant of record, works for Pakistan-based owners):
   - **Lemon Squeezy:** create a subscription product per plan and paste each variant ID into Admin → Plans. Add `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID` and `LEMONSQUEEZY_WEBHOOK_SECRET` in Vercel. Add a webhook to `https://<your-domain>/api/webhooks/lemonsqueezy` for all `subscription_*` events.
   - **Paddle** (optional):
     - Create prices, paste the price IDs, and set a default payment link.
     - Point notifications to `/api/webhooks/paddle`.
     - Switch it on in Admin → Design & settings → Feature switches.

> **Plans and costs:** Vercel's free Hobby plan is for **non-commercial** use. Test on it, but upgrade to **Pro** before charging customers. Supabase's free plan pauses after 7 idle days; the daily product sync keeps it active.

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
