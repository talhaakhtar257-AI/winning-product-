import { notFound } from 'next/navigation';
import { getSettings } from '@/lib/data/settings';

export default async function Legal({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const s = await getSettings();
  const n = s.brand.name;
  if (doc === 'terms')
    return (
      <article className="card" style={{ maxWidth: 780 }}>
        <h1>Terms of service</h1>
        <p>{n} provides product research, scoring and calculators for information only. Scores and profit estimates are not guarantees of sales or profit; always test with small budgets.</p>
        <p>Paid plans renew until cancelled (card) or expire at the end of the paid period (manual payments). You can cancel card plans any time from your account; access continues until the period ends.</p>
        <p>Do not resell, scrape or bulk-redistribute the product database. We may suspend accounts that abuse the service.</p>
        <p>Refunds: contact support within 7 days of your first payment if the service did not work for you.</p>
      </article>
    );
  if (doc === 'privacy')
    return (
      <article className="card" style={{ maxWidth: 780 }}>
        <h1>Privacy policy</h1>
        <p>We store your email, name, plan and the data you create (saved products, scenarios, validations). Payment card details are handled by our payment partner and never reach our servers.</p>
        <p>For manual payments we store the transaction ID, sender name, phone and the screenshot you upload, only to verify the payment.</p>
        <p>We use essential cookies to keep you signed in. We do not sell personal data. Ask support to export or delete your data at any time.</p>
      </article>
    );
  notFound();
}
