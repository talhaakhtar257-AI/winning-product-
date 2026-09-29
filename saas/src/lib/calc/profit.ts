import { z } from 'zod';

// Real per-order unit economics for e-commerce, including what most
// calculators ignore: COD returns (RTO), return shipping, damaged returns
// and percentage fees that only apply to delivered orders.
// All money values are in one currency (the selling currency).

const money = z.coerce.number().min(0).max(10_000_000);
const pct = z.coerce.number().min(0).max(100);

export const profitInputSchema = z.object({
  sellPrice: money,
  productCost: money,
  inboundShipping: money.default(0),
  packaging: money.default(0),
  commissionPct: pct.default(0),
  paymentFeePct: pct.default(0),
  codFeePct: pct.default(0),
  taxPct: pct.default(0),
  fixedFeePerOrder: money.default(0),
  deliveryFee: money.default(0),
  returnRatePct: z.coerce.number().min(0).max(95).default(0),
  returnShippingFee: money.default(0),
  returnLossPct: pct.default(10),
  adCostPerOrder: money.default(0),
  otherPerOrder: money.default(0),
  ordersPerMonth: z.coerce.number().int().min(0).max(1_000_000).default(300),
  fixedMonthly: money.default(0),
});

export type ProfitInput = z.infer<typeof profitInputSchema>;
export type ProfitVerdict = 'go' | 'risky' | 'no-go';

export interface ProfitResult {
  /** Profit for every order you ship (delivered or returned). */
  profitPerShipped: number;
  /** Same profit expressed per successfully delivered order. */
  profitPerDelivered: number;
  /** Net margin on delivered revenue, 0–1 (can be negative). */
  margin: number;
  revenuePerShipped: number;
  costBreakdown: { label: string; amount: number }[];
  /** Most you can pay in ads per shipped order and still break even. */
  breakEvenCpa: number;
  /** ROAS (delivered revenue ÷ ad spend) needed to break even; null if impossible. */
  breakEvenRoas: number | null;
  currentRoas: number | null;
  /** Highest return/RTO rate (0–1) before the order loses money; null if it never does or is always loss. */
  maxReturnRate: number | null;
  profitPer100: number;
  monthlyProfit: number;
  verdict: ProfitVerdict;
  reasons: string[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function perShipped(i: ProfitInput, returnRate: number) {
  const d = 1 - returnRate;
  const pctFees = (i.commissionPct + i.paymentFeePct + i.codFeePct + i.taxPct) / 100;
  const landed = i.productCost + i.inboundShipping;
  const revenue = d * i.sellPrice;
  const parts = {
    product: d * (landed + i.packaging),
    fees: revenue * pctFees + d * i.fixedFeePerOrder,
    delivery: i.deliveryFee,
    returns: returnRate * (i.returnShippingFee + i.packaging + (i.returnLossPct / 100) * landed),
    ads: i.adCostPerOrder,
    other: i.otherPerOrder,
  };
  const cost = parts.product + parts.fees + parts.delivery + parts.returns + parts.ads + parts.other;
  return { revenue, parts, profit: revenue - cost };
}

export function calculateProfit(raw: Partial<ProfitInput> | ProfitInput): ProfitResult {
  const i = profitInputSchema.parse(raw);
  const rr = i.returnRatePct / 100;
  const d = 1 - rr;
  const { revenue, parts, profit } = perShipped(i, rr);

  const breakEvenCpa = Math.max(0, profit + i.adCostPerOrder);
  const breakEvenRoas = breakEvenCpa > 0 ? revenue / breakEvenCpa : null;
  const currentRoas = i.adCostPerOrder > 0 ? revenue / i.adCostPerOrder : null;

  // Profit is linear in the return rate → solve P(r) = 0 between 0 and 95%.
  const p0 = perShipped(i, 0).profit;
  const pMax = perShipped(i, 0.95).profit;
  let maxReturnRate: number | null = null;
  if (p0 > 0 && pMax < 0) maxReturnRate = (p0 / (p0 - pMax)) * 0.95;

  const margin = revenue > 0 ? profit / revenue : -1;
  const reasons: string[] = [];
  let verdict: ProfitVerdict;
  if (profit <= 0) {
    verdict = 'no-go';
    reasons.push('You lose money on every order at these numbers.');
  } else if (margin >= 0.2 && (i.adCostPerOrder === 0 || breakEvenCpa >= i.adCostPerOrder * 1.3)) {
    verdict = 'go';
    reasons.push(`Healthy ${Math.round(margin * 100)}% net margin after all costs.`);
  } else {
    verdict = 'risky';
    reasons.push(margin < 0.2 ? `Thin ${Math.round(margin * 100)}% margin — small cost changes can wipe profit.` : 'Little room if ad costs rise.');
  }
  if (i.sellPrice > 0 && i.productCost > 0 && i.sellPrice / (i.productCost + i.inboundShipping) < 2.5)
    reasons.push('Price is under 2.5× landed cost — hard to afford paid ads.');
  if (maxReturnRate !== null && maxReturnRate - rr < 0.1)
    reasons.push(`Returns above ${Math.round(maxReturnRate * 100)}% turn this into a loss.`);
  if (rr >= 0.25) reasons.push('High COD return rate — confirm orders by call/WhatsApp before shipping.');

  return {
    profitPerShipped: r2(profit),
    profitPerDelivered: d > 0 ? r2(profit / d) : 0,
    margin: Math.round(margin * 1000) / 1000,
    revenuePerShipped: r2(revenue),
    costBreakdown: [
      { label: 'Product & packaging', amount: r2(parts.product) },
      { label: 'Platform, payment & COD fees', amount: r2(parts.fees) },
      { label: 'Delivery', amount: r2(parts.delivery) },
      { label: 'Returns / RTO losses', amount: r2(parts.returns) },
      { label: 'Ads', amount: r2(parts.ads) },
      { label: 'Other', amount: r2(parts.other) },
    ],
    breakEvenCpa: r2(breakEvenCpa),
    breakEvenRoas: breakEvenRoas === null ? null : r2(breakEvenRoas),
    currentRoas: currentRoas === null ? null : r2(currentRoas),
    maxReturnRate: maxReturnRate === null ? null : Math.round(maxReturnRate * 1000) / 1000,
    profitPer100: r2(profit * 100),
    monthlyProfit: r2(profit * i.ordersPerMonth - i.fixedMonthly),
    verdict,
    reasons,
  };
}
