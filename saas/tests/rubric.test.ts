import { describe, expect, it } from 'vitest';
import { scoreProduct, type ValidationInput } from '@/lib/score/rubric';

const great: ValidationInput = {
  name: 'Pet hair remover roller', market: 'Global', niche: 'Pets', sellPrice: 29, productCost: 6,
  safety: 'ok', season: 'all-year', weightKg: 0.3, fragile: false, batteryOrLiquid: false,
  rating: 4.6, appeal: 'both', competitorCount: 8, demand: 'rising', salesProof: true,
};

describe('scoreProduct', () => {
  it('weights add up to 100', () => {
    expect(scoreProduct(great).criteria.reduce((s, c) => s + c.weight, 0)).toBe(100);
  });

  it('a strong product is a Winner with no tips', () => {
    const r = scoreProduct(great);
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.verdict).toBe('Winner');
    expect(r.tips).toHaveLength(0);
  });

  it('restricted products are always Skip', () => {
    const r = scoreProduct({ ...great, safety: 'restricted' });
    expect(r.verdict).toBe('Skip');
    expect(r.blockers.length).toBe(1);
  });

  it('low markup is a blocker', () => {
    const r = scoreProduct({ ...great, sellPrice: 8, productCost: 6 });
    expect(r.verdict).toBe('Skip');
  });

  it('crowded, heavy, fragile products score lower and get tips', () => {
    const r = scoreProduct({ ...great, competitorCount: 500, weightKg: 4, fragile: true, demand: 'falling', salesProof: false });
    expect(r.score).toBeLessThan(scoreProduct(great).score - 20);
    expect(r.tips.length).toBeGreaterThanOrEqual(3);
  });

  it('uses PKR price bands for Pakistan', () => {
    const cheap = scoreProduct({ ...great, market: 'Pakistan', sellPrice: 2500, productCost: 600 });
    const pricey = scoreProduct({ ...great, market: 'Pakistan', sellPrice: 15000, productCost: 3600 });
    const impulse = (r: ReturnType<typeof scoreProduct>) => r.criteria.find((c) => c.key === 'impulse')!.value;
    expect(impulse(cheap)).toBe(10);
    expect(impulse(pricey)).toBe(2);
  });
});
