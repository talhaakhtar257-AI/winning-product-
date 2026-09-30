import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getSettings } from '@/lib/data/settings';
import { CHANNEL_PRESETS } from '@/lib/calc/presets';
import { ProfitCalculator } from '@/components/ProfitCalculator';

export const metadata: Metadata = { title: 'Profit calculator' };

export default async function CalculatorPage() {
  const [s, settings] = await Promise.all([getSession(), getSettings()]);
  if (!settings.features.calculator) notFound();
  const pk = s.profile?.market_pref === 'Pakistan';
  const preset = pk ? CHANNEL_PRESETS[0] : CHANNEL_PRESETS[2];
  return (
    <div className="stack">
      <div>
        <h1>True profit calculator</h1>
        <p className="muted" style={{ maxWidth: '70ch' }}>
          Most sellers lose money because they only subtract product cost. This counts marketplace and payment fees,
          delivery, COD returns (RTO), damaged stock and ad cost — and tells you the highest ad cost and return rate you can survive.
        </p>
      </div>
      <ProfitCalculator
        initial={{ ...preset.values, sellPrice: pk ? 2500 : 34.95, productCost: pk ? 700 : 9 }}
        currency={pk ? 'PKR' : 'USD'}
        canSave={s.ent.limits.calcSave}
        signedIn={!!s.user}
      />
    </div>
  );
}
