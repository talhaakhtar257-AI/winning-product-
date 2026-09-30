-- WinScout SaaS — initial schema.
-- Security model: every table has RLS enabled. Paid data (products, snapshots,
-- competitors) has NO client policies, so it can only be read by server code
-- using the service role, after plan entitlements are checked.

create extension if not exists pg_trgm with schema extensions;

-- ───────────────────────── Roles & plans ─────────────────────────
do $$ begin
  create type app_role as enum ('user', 'staff', 'admin', 'owner');
exception when duplicate_object then null; end $$;

create table if not exists public.plans (
  id               text primary key check (id ~ '^[a-z0-9_-]{2,32}$'),
  name             text not null,
  description      text not null default '',
  price_usd        numeric(10,2) not null default 0 check (price_usd >= 0),
  price_pkr        numeric(12,0) not null default 0 check (price_pkr >= 0),
  interval         text not null default 'month' check (interval in ('month', 'year')),
  limits           jsonb not null default '{}'::jsonb,
  features         jsonb not null default '[]'::jsonb,
  lemon_variant_id text,
  paddle_price_id  text,
  active           boolean not null default true,
  highlighted      boolean not null default false,
  sort             int not null default 0,
  updated_at       timestamptz not null default now()
);

create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null default '',
  full_name       text not null default '',
  role            app_role not null default 'user',
  plan_id         text not null default 'free' references public.plans (id),
  plan_status     text not null default 'active'
                  check (plan_status in ('active', 'trialing', 'past_due', 'cancelled', 'expired')),
  plan_source     text not null default 'free'
                  check (plan_source in ('free', 'lemonsqueezy', 'paddle', 'manual', 'comp')),
  plan_expires_at timestamptz,
  market_pref     text not null default 'all' check (market_pref in ('all', 'Global', 'Pakistan')),
  banned          boolean not null default false,
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz
);
create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_plan_idx on public.profiles (plan_id, plan_status);

-- New auth user → profile row. The very first user becomes the owner.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when exists (select 1 from public.profiles where role = 'owner') then 'user'::app_role else 'owner'::app_role end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Billing ─────────────────────────
create table if not exists public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  provider             text not null check (provider in ('lemonsqueezy', 'paddle')),
  provider_sub_id      text not null,
  provider_customer_id text,
  plan_id              text references public.plans (id),
  status               text not null,
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  portal_url           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (provider, provider_sub_id)
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

create table if not exists public.manual_payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  plan_id     text not null references public.plans (id),
  months      int not null default 1 check (months between 1 and 24),
  method      text not null check (method in ('jazzcash', 'easypaisa', 'bank')),
  amount      numeric(12,2) not null check (amount > 0),
  currency    text not null default 'PKR',
  txn_ref     text not null check (length(txn_ref) between 4 and 64),
  payer_name  text not null default '',
  payer_phone text not null default '',
  proof_path  text,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note        text not null default '',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (method, txn_ref)
);
create index if not exists manual_payments_status_idx on public.manual_payments (status, created_at desc);

create table if not exists public.webhook_events (
  id           text primary key,             -- provider:event-id (idempotency key)
  provider     text not null,
  event_name   text not null,
  payload      jsonb not null,
  processed_at timestamptz,
  error        text,
  created_at   timestamptz not null default now()
);

-- ───────────────────────── Products ─────────────────────────
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  dedup_key     text not null unique,
  slug          text not null unique,
  name          text not null,
  keyword       text not null default '',
  market        text not null check (market in ('Global', 'Pakistan')),
  niche         text not null default 'Other',
  currency      text not null default 'USD',
  cost          numeric(12,2),
  price         numeric(12,2),
  markup        numeric(8,2),
  score         int not null default 0 check (score between 0 and 100),
  verdict       text not null default '',
  trend         text not null default '',
  competition   text not null default '',
  proof_level   text not null default '',
  score_details text not null default '',
  score_parts   jsonb not null default '[]'::jsonb,
  why           text not null default '',
  risk          text not null default '',
  ad_idea       text not null default '',
  audience      text not null default '',
  where_to_sell text not null default '',
  image         text,
  source        text,
  supplier      text,
  first_seen    date not null,
  last_seen     date not null,
  days_seen     int not null default 1,
  hidden        boolean not null default false,
  featured      boolean not null default false,
  admin_notes   text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists products_last_seen_idx on public.products (last_seen desc, score desc);
create index if not exists products_market_idx on public.products (market, niche);
create index if not exists products_name_trgm on public.products using gin (name extensions.gin_trgm_ops);

create table if not exists public.product_snapshots (
  product_id  uuid not null references public.products (id) on delete cascade,
  date        date not null,
  score       int not null,
  price       numeric(12,2),
  cost        numeric(12,2),
  markup      numeric(8,2),
  trend       text not null default '',
  competition text not null default '',
  verdict     text not null default '',
  primary key (product_id, date)
);

create table if not exists public.competitors (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  kind       text not null check (kind in ('store', 'ad', 'video', 'listing')),
  url        text not null check (url ~ '^https://'),
  title      text not null default '',
  note       text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists competitors_product_idx on public.competitors (product_id);

create table if not exists public.ingest_runs (
  id         bigserial primary key,
  source     text not null,
  received   int not null default 0,
  inserted   int not null default 0,
  updated    int not null default 0,
  snapshots  int not null default 0,
  error      text,
  created_at timestamptz not null default now()
);

-- ───────────────────────── User workspace ─────────────────────────
create table if not exists public.saved_products (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  note       text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.calc_scenarios (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name       text not null,
  inputs     jsonb not null,
  result     jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists calc_scenarios_user_idx on public.calc_scenarios (user_id, created_at desc);

create table if not exists public.validations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  name        text not null,
  inputs      jsonb not null,
  result      jsonb not null,
  share_token text unique,
  created_at  timestamptz not null default now()
);
create index if not exists validations_user_idx on public.validations (user_id, created_at desc);

create table if not exists public.usage_events (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_idx on public.usage_events (user_id, kind, created_at desc);

-- ───────────────────────── Owner control ─────────────────────────
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

create table if not exists public.audit_log (
  id          bigserial primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  target_type text not null default '',
  target_id   text not null default '',
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- ───────────────────────── Row-level security ─────────────────────────
alter table public.plans              enable row level security;
alter table public.profiles           enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.manual_payments    enable row level security;
alter table public.webhook_events     enable row level security;
alter table public.products           enable row level security;
alter table public.product_snapshots  enable row level security;
alter table public.competitors        enable row level security;
alter table public.ingest_runs        enable row level security;
alter table public.saved_products     enable row level security;
alter table public.calc_scenarios     enable row level security;
alter table public.validations        enable row level security;
alter table public.usage_events       enable row level security;
alter table public.site_settings      enable row level security;
alter table public.audit_log          enable row level security;

-- Public, non-sensitive reads.
drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select using (active);

drop policy if exists settings_read on public.site_settings;
create policy settings_read on public.site_settings for select using (true);

-- Users see their own rows. Every write goes through server code (service role).
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select using (auth.uid() = id);

drop policy if exists subs_self on public.subscriptions;
create policy subs_self on public.subscriptions for select using (auth.uid() = user_id);

drop policy if exists manual_self on public.manual_payments;
create policy manual_self on public.manual_payments for select using (auth.uid() = user_id);

drop policy if exists saved_self on public.saved_products;
create policy saved_self on public.saved_products for select using (auth.uid() = user_id);

drop policy if exists calc_self on public.calc_scenarios;
create policy calc_self on public.calc_scenarios for select using (auth.uid() = user_id);

drop policy if exists validations_self on public.validations;
create policy validations_self on public.validations for select using (auth.uid() = user_id);

-- products, product_snapshots, competitors, webhook_events, ingest_runs,
-- usage_events, audit_log: intentionally no policies (server only).

-- ───────────────────────── Storage ─────────────────────────
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false), ('brand', 'brand', true)
on conflict (id) do nothing;

-- ───────────────────────── Seed data ─────────────────────────
insert into public.plans (id, name, description, price_usd, price_pkr, limits, features, highlighted, sort) values
('free', 'Free', 'Try the radar with today''s top products.', 0, 0,
 '{"historyDays":1,"maxProducts":10,"fullDetails":false,"trendHistory":false,"competitors":false,"export":false,"savedMax":5,"calcSave":false,"validationsPerMonth":3}',
 '["Today''s top 10 products","Profit calculator (no saving)","3 product validations / month","Save up to 5 products"]', false, 0),
('pro', 'Pro', 'Everything a solo seller needs to pick winners with confidence.', 19, 2999,
 '{"historyDays":90,"maxProducts":5000,"fullDetails":true,"trendHistory":true,"competitors":true,"export":true,"savedMax":500,"calcSave":true,"validationsPerMonth":100}',
 '["Every product, 90 days of history","Suppliers, sources, ad ideas & risks","Trend & saturation history","Competitor stores & ad research","Saved profit scenarios","100 validations / month","CSV export"]', true, 1),
('business', 'Business', 'For agencies and teams testing many products every week.', 49, 7999,
 '{"historyDays":3650,"maxProducts":100000,"fullDetails":true,"trendHistory":true,"competitors":true,"export":true,"savedMax":5000,"calcSave":true,"validationsPerMonth":1000}',
 '["Everything in Pro","Full product archive","1,000 validations / month","Priority WhatsApp support"]', false, 2)
on conflict (id) do nothing;

insert into public.site_settings (key, value) values
('brand', '{"name":"WinScout","tagline":"Winning Product Radar","logoUrl":"","supportEmail":"","whatsapp":""}'),
('theme', '{"brand":"#13201A","accent":"#E4A11B","good":"#1F7342","bad":"#A8361F","radius":12}'),
('landing', '{"heroTitle":"Find your next winning product — before you spend on ads","heroSubtitle":"Every morning our AI scores fresh products for Global and Pakistan sellers, then shows the real profit after ads, fees, courier and COD returns.","ctaLabel":"Start free","announcement":"","faq":[{"q":"Where do products come from?","a":"We scan sales data, marketplaces and trend sources every morning, then score every product on 9 criteria with a proof level."},{"q":"Do you support Pakistan COD?","a":"Yes. The profit calculator includes Daraz fees, courier rates and COD return (RTO) losses."},{"q":"How do I pay from Pakistan?","a":"Pay by card, or send JazzCash / Easypaisa / bank transfer and upload the receipt. We activate your plan after checking it."},{"q":"Can I cancel anytime?","a":"Yes. Card plans cancel from your account page. Manual plans simply expire."}]}'),
('payments', '{"jazzcash":{"enabled":true,"title":"","number":""},"easypaisa":{"enabled":true,"title":"","number":""},"bank":{"enabled":true,"bank":"","title":"","iban":""},"instructions":"Send the exact amount, then upload a screenshot with the transaction ID. Plans are activated within a few hours."}'),
('features', '{"calculator":true,"validator":true,"competitors":true,"trendHistory":true,"manualPayments":true,"lemonsqueezy":true,"paddle":false,"signups":true}')
on conflict (key) do nothing;

-- Recomputes first/last seen and days on radar from snapshots after an ingest.
create or replace function public.refresh_product_stats(ids uuid[]) returns void
language sql security definer set search_path = public as $$
  update public.products p
     set first_seen = s.first_seen, last_seen = s.last_seen, days_seen = s.days, updated_at = now()
    from (select product_id, min(date) first_seen, max(date) last_seen, count(*)::int days
            from public.product_snapshots where product_id = any(ids) group by product_id) s
   where p.id = s.product_id;
$$;
revoke all on function public.refresh_product_stats(uuid[]) from public, anon, authenticated;

-- Admin dashboard aggregates in one round trip.
create or replace function public.admin_metrics() returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'users',            (select count(*) from profiles),
    'signups7',         (select count(*) from profiles where created_at > now() - interval '7 days'),
    'signups30',        (select count(*) from profiles where created_at > now() - interval '30 days'),
    'paid',             (select count(*) from profiles where plan_id <> 'free' and role = 'user'
                           and plan_status in ('active','trialing','past_due')
                           and (plan_expires_at is null or plan_expires_at > now())),
    'paidBySource',     (select coalesce(jsonb_object_agg(plan_source, n), '{}'::jsonb) from
                           (select plan_source, count(*) n from profiles where plan_id <> 'free' and role = 'user'
                              and (plan_expires_at is null or plan_expires_at > now()) group by plan_source) x),
    'mrrUsd',           (select coalesce(sum(case when pl.interval = 'year' then pl.price_usd / 12 else pl.price_usd end), 0)
                           from profiles pr join plans pl on pl.id = pr.plan_id
                          where pr.plan_id <> 'free' and pr.role = 'user' and pr.plan_source in ('lemonsqueezy','paddle')
                            and pr.plan_status in ('active','trialing','past_due')
                            and (pr.plan_expires_at is null or pr.plan_expires_at > now())),
    'manualPkr30',      (select coalesce(sum(amount), 0) from manual_payments
                          where status = 'approved' and reviewed_at > now() - interval '30 days'),
    'churn30',          (select count(*) from subscriptions where status in ('cancelled','expired') and updated_at > now() - interval '30 days'),
    'pendingPayments',  (select count(*) from manual_payments where status = 'pending'),
    'products',         (select count(*) from products),
    'productsToday',    (select count(*) from products where last_seen = (select max(last_seen) from products)),
    'lastIngest',       (select to_jsonb(r) from (select source, received, inserted, updated, error, created_at
                           from ingest_runs order by id desc limit 1) r)
  );
$$;
revoke all on function public.admin_metrics() from public, anon, authenticated;
