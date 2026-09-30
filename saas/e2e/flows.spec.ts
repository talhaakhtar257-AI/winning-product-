/**
 * Full business flow against a running app + local Supabase (`supabase start`).
 * Needs .env.local values in the environment. Run: npm run e2e
 */
import { expect, test, type Page } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const MAILPIT = 'http://127.0.0.1:54324';
const API = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const stamp = Date.now();
const owner = `owner-${stamp}@test.dev`;
const buyer = `buyer-${stamp}@test.dev`;

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  return res.json();
}

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await expect(page.getByText('Check your inbox')).toBeVisible();
  let link = '';
  for (let i = 0; i < 30 && !link; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
    if (list.messages?.length) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json();
      link = (msg.Text.match(/https?:\/\/\S+verify\S+/) ?? [''])[0].replace(/[)\]]$/, '');
    }
    if (!link) await new Promise((r) => setTimeout(r, 500));
  }
  expect(link, 'magic link email').toBeTruthy();
  await page.goto(link.replace(/&amp;/g, '&'));
  await page.waitForURL(/\/products/);
}

test.describe.configure({ mode: 'serial' });

test('visitor sees a limited radar and locked details', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await page.goto('/products');
  const cards = page.locator('.pcard');
  expect(await cards.count()).toBeLessThanOrEqual(10);
  await expect(page.getByText(/more matching products are locked/)).toBeVisible();
  await cards.first().click();
  await expect(page.getByText('Supplier, source, ad idea, audience and risks')).toBeVisible();
  await expect(page.getByText('Will it make money for you?')).toBeVisible();
});

test('calculator computes COD profit live', async ({ page }) => {
  await page.goto('/calculator');
  await page.getByLabel('Sales channel preset').selectOption('pk-cod-store');
  await page.getByLabel(/^Selling price/).fill('2500');
  await page.getByLabel(/^Product cost/).fill('700');
  await expect(page.getByText('Profit / delivered order')).toBeVisible();
  await expect(page.locator('.badge', { hasText: /Go|Risky|No-go/ }).first()).toBeVisible();
});

test('first sign-up becomes owner; owner configures plans and design', async ({ page }) => {
  // Make this run's owner the only owner, regardless of earlier runs.
  await rest('profiles?role=eq.owner', { method: 'PATCH', body: JSON.stringify({ role: 'user' }) });
  await signIn(page, owner);
  await rest(`profiles?email=eq.${encodeURIComponent(owner)}`, { method: 'PATCH', body: JSON.stringify({ role: 'owner' }) });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Products').first()).toBeVisible();

  // Plans: connect the Pro plan to a Lemon Squeezy variant.
  await page.goto('/admin/plans');
  const pro = page.locator('details', { hasText: /^Pro/ }).first();
  await pro.locator('summary').click();
  await pro.locator('input[name=lemon_variant_id]').fill('777');
  await pro.getByRole('button', { name: 'Save plan' }).click();
  await expect(pro.getByText('Plan “Pro” saved')).toBeVisible();

  // Design: change hero title + announcement, and set JazzCash details.
  await page.goto('/admin/design');
  await page.getByLabel('Hero headline').fill(`E2E hero ${stamp}`);
  await page.getByLabel(/Top announcement bar/).fill('Launch offer: 30% off');
  await page.getByRole('button', { name: 'Save home page' }).click();
  await expect(page.getByText('Saved — live on the site now').first()).toBeVisible();
  await page.locator('#s-jazzcash\\.number').fill('03001234567');
  await page.locator('#s-jazzcash\\.title').fill('WinScout Owner');
  await page.getByRole('button', { name: 'Save payment details' }).click();
  await expect(page.getByText('Saved — live on the site now').first()).toBeVisible();
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText(`E2E hero ${stamp}`);
  await expect(page.getByText('Launch offer: 30% off')).toBeVisible();
});

test('buyer: free limits → card webhook unlocks Pro → manual payment approved → Business', async ({ page, browser, request }) => {
  await signIn(page, buyer);
  await page.goto('/account');
  await expect(page.locator('.kpi').first()).toHaveText('Free');
  const [{ id: buyerId }] = await rest(`profiles?email=eq.${encodeURIComponent(buyer)}&select=id`);

  // Validation report (uses monthly quota)
  await page.goto('/validate');
  await page.getByLabel('Product name').fill('Magnetic phone holder');
  await page.getByLabel('Planned selling price').fill('25');
  await page.getByLabel('Product cost (landed)').fill('5');
  await page.getByRole('button', { name: 'Score my product' }).click();
  await page.waitForURL(/\/validate\/[0-9a-f-]{36}/);
  await expect(page.getByText('Score breakdown')).toBeVisible();

  // Signed Lemon Squeezy webhook → Pro.
  const body = JSON.stringify({
    meta: { event_name: 'subscription_created', custom_data: { user_id: buyerId, plan_id: 'pro' } },
    data: { id: `sub_${stamp}`, type: 'subscriptions', attributes: { status: 'active', variant_id: 777, customer_id: 1, renews_at: new Date(Date.now() + 30 * 864e5).toISOString(), ends_at: null, cancelled: false, user_email: buyer, urls: { customer_portal: 'https://example.com/portal' } } },
  });
  const sig = createHmac('sha256', process.env.LEMONSQUEEZY_WEBHOOK_SECRET!).update(body).digest('hex');
  const bad = await request.post('/api/webhooks/lemonsqueezy', { data: body, headers: { 'x-signature': 'deadbeef', 'content-type': 'application/json' } });
  expect(bad.status()).toBe(401);
  const ok = await request.post('/api/webhooks/lemonsqueezy', { data: body, headers: { 'x-signature': sig, 'content-type': 'application/json' } });
  expect((await ok.json()).outcome).toBe('applied');
  const dup = await request.post('/api/webhooks/lemonsqueezy', { data: body, headers: { 'x-signature': sig, 'content-type': 'application/json' } });
  expect((await dup.json()).outcome).toBe('duplicate');

  await page.goto('/account');
  await expect(page.locator('.kpi').first()).toHaveText('Pro');
  await page.goto('/products?day=all');
  expect(await page.locator('.pcard').count()).toBeGreaterThan(10);
  await expect(page.getByRole('link', { name: 'Export CSV' })).toBeVisible();
  const csv = await page.request.get('/api/export?day=all');
  expect(csv.headers()['content-type']).toContain('text/csv');
  expect((await csv.text()).split('\n').length).toBeGreaterThan(20);
  await page.locator('.pcard').first().click();
  await expect(page.getByText('Competitor & ad research')).toBeVisible();
  await expect(page.getByRole('link', { name: /Facebook Ad Library/ })).toBeVisible();
  await page.getByRole('button', { name: '☆ Save' }).click();
  await expect(page.getByRole('button', { name: '★ Saved' })).toBeVisible();

  // Manual JazzCash payment for Business.
  await page.goto('/account');
  await expect(page.getByText('03001234567')).toBeVisible();
  await page.getByLabel('Plan', { exact: true }).selectOption('business');
  await page.getByLabel('Transaction ID').fill(`TX${stamp}`);
  await page.getByLabel('Sender name').fill('Test Buyer');
  await page.getByLabel('Sender phone').fill('03001112222');
  const png = `/tmp/proof-${stamp}.png`;
  writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'));
  await page.getByLabel('Payment screenshot').setInputFiles(png);
  await page.getByRole('button', { name: 'Submit payment' }).click();
  await expect(page.getByText('Payment submitted!')).toBeVisible();

  // Owner approves it.
  const ownerCtx = await browser.newContext();
  const op = await ownerCtx.newPage();
  await signIn(op, owner);
  await op.goto('/admin/payments');
  const card = op.locator('.card', { hasText: buyer }).first();
  const proof = await op.request.get(await card.getByRole('link', { name: /View screenshot/ }).getAttribute('href') as string, { maxRedirects: 0 });
  expect(proof.status()).toBe(307);
  await card.getByRole('button', { name: 'Approve & activate' }).click();
  await expect(op.getByText('Approved — plan activated for the customer.')).toBeVisible();
  // Buyer is now on Business via manual payment.
  const [prof] = await rest(`profiles?id=eq.${buyerId}&select=plan_id,plan_source,plan_expires_at`);
  expect(prof.plan_id).toBe('business');
  expect(prof.plan_source).toBe('manual');
  // Non-staff cannot open admin.
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/app|\/products|\/login|\/$/);
  await ownerCtx.close();
});

test('ingest API and cron are secret-protected and work', async ({ request }) => {
  const payload = { products: [{ name: `E2E Gadget ${stamp}`, market: 'Global', niche: 'Gadgets', score: 88, price: 30, cost: 7, verdict: 'Winner', date: new Date().toISOString().slice(0, 10) }] };
  expect((await request.post('/api/ingest', { data: payload })).status()).toBe(401);
  const r = await request.post('/api/ingest', { data: payload, headers: { authorization: `Bearer ${process.env.INGEST_SECRET}` } });
  expect(await r.json()).toMatchObject({ ok: true, inserted: 1 });
  expect((await request.get('/api/cron/expire')).status()).toBe(401);
  const c = await request.get('/api/cron/expire', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect((await c.json()).ok).toBe(true);
});
