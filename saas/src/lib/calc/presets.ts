import type { ProfitInput } from './profit';

// Starting points only — typical 2026 averages. Every value stays editable in
// the calculator, and the UI tells sellers to use their own contract rates.

export interface ChannelPreset {
  id: string;
  label: string;
  market: 'Global' | 'Pakistan';
  values: Partial<ProfitInput>;
}

export const CHANNEL_PRESETS: ChannelPreset[] = [
  {
    id: 'pk-cod-store',
    label: 'Own store / Facebook COD (Pakistan)',
    market: 'Pakistan',
    values: { commissionPct: 0, paymentFeePct: 0, codFeePct: 4, deliveryFee: 250, returnRatePct: 25, returnShippingFee: 150, packaging: 40, adCostPerOrder: 450 },
  },
  {
    id: 'pk-daraz',
    label: 'Daraz.pk marketplace',
    market: 'Pakistan',
    values: { commissionPct: 12, paymentFeePct: 2.5, codFeePct: 0, deliveryFee: 150, returnRatePct: 10, returnShippingFee: 0, packaging: 40, adCostPerOrder: 150 },
  },
  {
    id: 'shopify-global',
    label: 'Shopify store (cards, global)',
    market: 'Global',
    values: { commissionPct: 0, paymentFeePct: 2.9, fixedFeePerOrder: 0.3, deliveryFee: 0, inboundShipping: 4, returnRatePct: 3, returnShippingFee: 5, adCostPerOrder: 12 },
  },
  {
    id: 'tiktok-shop',
    label: 'TikTok Shop (US)',
    market: 'Global',
    values: { commissionPct: 8, paymentFeePct: 0, deliveryFee: 5, inboundShipping: 2, returnRatePct: 5, returnShippingFee: 5, adCostPerOrder: 8 },
  },
  {
    id: 'amazon-fba',
    label: 'Amazon FBA (US)',
    market: 'Global',
    values: { commissionPct: 15, paymentFeePct: 0, fixedFeePerOrder: 4.5, deliveryFee: 0, inboundShipping: 1.5, returnRatePct: 4, returnShippingFee: 0, adCostPerOrder: 5 },
  },
];

export interface CourierPreset {
  id: string;
  label: string;
  deliveryFee: number;
  codFeePct: number;
  returnShippingFee: number;
}

// Domestic Pakistan, ~0.5 kg parcel, PKR.
export const PK_COURIERS: CourierPreset[] = [
  { id: 'tcs', label: 'TCS', deliveryFee: 280, codFeePct: 4, returnShippingFee: 180 },
  { id: 'leopards', label: 'Leopards', deliveryFee: 230, codFeePct: 4, returnShippingFee: 150 },
  { id: 'postex', label: 'PostEx', deliveryFee: 240, codFeePct: 4.5, returnShippingFee: 150 },
  { id: 'trax', label: 'Trax', deliveryFee: 220, codFeePct: 4, returnShippingFee: 140 },
  { id: 'mnp', label: 'M&P', deliveryFee: 250, codFeePct: 4, returnShippingFee: 160 },
];

export function presetFor(id: string): ChannelPreset | undefined {
  return CHANNEL_PRESETS.find((p) => p.id === id);
}

/** Sensible calculator defaults from a radar product. */
export function inputsFromProduct(p: { market: string; cost: number | null; price: number | null }): Partial<ProfitInput> {
  const preset = p.market === 'Pakistan' ? CHANNEL_PRESETS[0] : CHANNEL_PRESETS[2];
  return { ...preset.values, sellPrice: p.price ?? 0, productCost: p.cost ?? 0 };
}
