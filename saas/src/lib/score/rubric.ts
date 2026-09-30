import { z } from 'zod';

// "Validate my own product": scores a seller's idea on the same 9 criteria
// the daily radar uses, from plain questions instead of gut-feel sliders.

export const validationInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  market: z.enum(['Global', 'Pakistan']),
  niche: z.string().trim().max(60).default(''),
  sellPrice: z.coerce.number().positive().max(10_000_000),
  productCost: z.coerce.number().positive().max(10_000_000),
  safety: z.enum(['ok', 'certification', 'restricted']),
  season: z.enum(['all-year', 'seasonal', 'event']),
  weightKg: z.coerce.number().min(0).max(100),
  fragile: z.coerce.boolean().default(false),
  batteryOrLiquid: z.coerce.boolean().default(false),
  rating: z.coerce.number().min(0).max(5).default(0), // 0 = unknown
  appeal: z.enum(['both', 'problem', 'wow', 'neither']),
  competitorCount: z.coerce.number().int().min(0).max(100_000),
  demand: z.enum(['rising', 'stable', 'falling', 'unknown']),
  salesProof: z.coerce.boolean().default(false),
});

export type ValidationInput = z.infer<typeof validationInputSchema>;
export type Verdict = 'Winner' | 'Promising' | 'Risky' | 'Skip';

export interface Criterion {
  key: string;
  label: string;
  weight: number;
  value: number; // 0–10
  tip: string;
}

export interface ValidationResult {
  score: number;
  verdict: Verdict;
  markup: number;
  criteria: Criterion[];
  tips: string[];
  blockers: string[];
}

const band = (x: number, steps: [number, number][], otherwise: number) => {
  for (const [limit, v] of steps) if (x >= limit) return v;
  return otherwise;
};

export function scoreProduct(raw: ValidationInput): ValidationResult {
  const i = validationInputSchema.parse(raw);
  const markup = i.sellPrice / i.productCost;
  const pk = i.market === 'Pakistan';

  const impulse = pk
    ? i.sellPrice <= 3000 ? 10 : i.sellPrice <= 6000 ? 7 : i.sellPrice <= 12000 ? 4 : 2
    : i.sellPrice <= 40 ? 10 : i.sellPrice <= 70 ? 7 : i.sellPrice <= 120 ? 4 : 2;

  let ship = i.weightKg <= 0.5 ? 10 : i.weightKg <= 1 ? 8 : i.weightKg <= 2 ? 6 : i.weightKg <= 5 ? 4 : 2;
  if (i.fragile) ship -= 3;
  if (i.batteryOrLiquid) ship -= 2;
  ship = Math.max(0, ship);

  const reviews = i.rating === 0 ? 5 : band(i.rating, [[4.5, 10], [4.2, 8], [4, 6], [3.5, 4]], 2);
  const demandBase = { rising: 9, stable: 7, falling: 2, unknown: 5 }[i.demand];

  const criteria: Criterion[] = [
    { key: 'demand', label: 'Trending / demand', weight: 15, value: Math.min(10, demandBase + (i.salesProof ? 1 : 0)),
      tip: 'Find proof of sales: order counts on AliExpress/Daraz, TikTok Shop sold numbers or Amazon BSR.' },
    { key: 'margin', label: 'Profit margin', weight: 15, value: band(markup, [[4, 10], [3, 8], [2.5, 6], [2, 4]], 1),
      tip: 'Aim for at least 3× landed cost so you can afford ads and returns — raise price with a bundle or find a cheaper supplier.' },
    { key: 'appeal', label: 'Solves a problem / wow factor', weight: 15, value: { both: 10, problem: 8, wow: 8, neither: 3 }[i.appeal],
      tip: 'Products that sell on ads either fix a clear pain or look amazing in a 5-second video.' },
    { key: 'competition', label: 'Low competition', weight: 12, value: i.competitorCount <= 10 ? 10 : i.competitorCount <= 30 ? 8 : i.competitorCount <= 80 ? 6 : i.competitorCount <= 200 ? 4 : 2,
      tip: 'Crowded product — win with a better angle, bundle, or local (Urdu) creatives rather than the same ads.' },
    { key: 'impulse', label: 'Impulse-buy price', weight: 10, value: impulse,
      tip: pk ? 'Under PKR 3,000 converts best for COD impulse buys.' : 'Under $40 converts best for impulse buys from social ads.' },
    { key: 'ship', label: 'Easy to ship', weight: 10, value: ship,
      tip: 'Light, unbreakable, no batteries or liquids = cheaper delivery and fewer damaged returns.' },
    { key: 'reviews', label: 'Happy buyers', weight: 8, value: reviews,
      tip: 'Check reviews on similar listings; ratings under 4.2 usually mean quality problems and refunds.' },
    { key: 'season', label: 'Sells all year', weight: 8, value: { 'all-year': 10, seasonal: 6, event: 2 }[i.season],
      tip: 'Seasonal products need a tight launch window — plan stock to sell out before the season ends.' },
    { key: 'safety', label: 'Safe to sell', weight: 7, value: { ok: 10, certification: 5, restricted: 0 }[i.safety],
      tip: 'Check platform and customs rules; restricted items get ad accounts and stores banned.' },
  ];

  const score = Math.round(criteria.reduce((s, c) => s + (c.weight * c.value) / 10, 0));
  const blockers: string[] = [];
  if (i.safety === 'restricted') blockers.push('Restricted product — ads and marketplaces will likely reject it.');
  if (markup < 1.5) blockers.push('Selling price is under 1.5× cost — no room for ads, fees or returns.');

  let verdict: Verdict = score >= 80 ? 'Winner' : score >= 65 ? 'Promising' : score >= 50 ? 'Risky' : 'Skip';
  if (blockers.length) verdict = 'Skip';

  const tips = criteria.filter((c) => c.value < 7).sort((a, b) => b.weight - a.weight).map((c) => c.tip);
  return { score, verdict, markup: Math.round(markup * 100) / 100, criteria, tips, blockers };
}
