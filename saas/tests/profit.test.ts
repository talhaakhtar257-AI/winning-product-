import { describe, expect, it } from 'vitest';
import { calculateProfit } from '@/lib/calc/profit';
import { CHANNEL_PRESETS, inputsFromProduct } from '@/lib/calc/presets';

describe('calculateProfit', () => {
  it('simple no-fee order: profit = price - cost', () => {
    const r = calculateProfit({ sellPrice: 100, productCost: 40, returnLossPct: 0 });
    expect(r.profitPerShipped).toBe(60);
    expect(r.profitPerDelivered).toBe(60);
    expect(r.margin).toBe(0.6);
    expect(r.verdict).toBe('go');
    expect(r.maxReturnRate).toBeNull(); // returns cost nothing here, so they can never cause a loss
    expect(calculateProfit({ sellPrice: 100, productCost: 40 }).maxReturnRate).toBeGreaterThan(0.9); // 10% stock loss default
  });

  it('Pakistan COD: returns, delivery and COD fee reduce profit correctly', () => {
    const r = calculateProfit({
      sellPrice: 2500, productCost: 700, packaging: 40, deliveryFee: 250, codFeePct: 4,
      returnRatePct: 25, returnShippingFee: 150, returnLossPct: 10, adCostPerOrder: 450,
    });
    // delivered share 0.75 → revenue 1875
    // product+packaging on delivered: 0.75*(700+40)=555
    // fees: 1875*4% = 75
    // delivery 250 (every shipped order)
    // returns: 0.25*(150 + 40 + 0.1*700) = 65
    // ads 450 → total cost 1395 → profit 480
    expect(r.revenuePerShipped).toBe(1875);
    expect(r.profitPerShipped).toBe(480);
    expect(r.profitPerDelivered).toBe(640);
    expect(r.breakEvenCpa).toBe(930);
    expect(r.breakEvenRoas).toBeCloseTo(1875 / 930, 2);
    expect(r.currentRoas).toBeCloseTo(1875 / 450, 2);
    expect(r.maxReturnRate).not.toBeNull();
    expect(r.maxReturnRate!).toBeGreaterThan(0.25);
    expect(r.maxReturnRate!).toBeLessThan(0.95);
    expect(r.reasons.some((x) => /COD return/.test(x))).toBe(true);
  });

  it('the max return rate is exactly where profit hits zero', () => {
    const base = { sellPrice: 2500, productCost: 700, deliveryFee: 250, returnShippingFee: 150, adCostPerOrder: 450 };
    const r = calculateProfit({ ...base, returnRatePct: 10 });
    const atMax = calculateProfit({ ...base, returnRatePct: r.maxReturnRate! * 100 });
    // maxReturnRate is rounded to 0.1%, so allow the profit swing of that rounding step.
    expect(Math.abs(atMax.profitPerShipped)).toBeLessThan(3);
    expect(calculateProfit({ ...base, returnRatePct: r.maxReturnRate! * 100 + 1 }).profitPerShipped).toBeLessThan(0);
  });

  it('flags a loss-making product as no-go', () => {
    const r = calculateProfit({ sellPrice: 20, productCost: 12, adCostPerOrder: 15 });
    expect(r.profitPerShipped).toBeLessThan(0);
    expect(r.verdict).toBe('no-go');
    expect(r.breakEvenCpa).toBe(8);
  });

  it('thin margin is risky', () => {
    const r = calculateProfit({ sellPrice: 100, productCost: 70, adCostPerOrder: 15 });
    expect(r.verdict).toBe('risky');
  });

  it('monthly profit subtracts fixed costs', () => {
    const r = calculateProfit({ sellPrice: 50, productCost: 10, ordersPerMonth: 100, fixedMonthly: 500 });
    expect(r.monthlyProfit).toBe(40 * 100 - 500);
  });

  it('rejects out-of-range input', () => {
    expect(() => calculateProfit({ sellPrice: -5, productCost: 1 })).toThrow();
    expect(() => calculateProfit({ sellPrice: 10, productCost: 1, returnRatePct: 99 })).toThrow();
  });

  it('presets produce valid calculations', () => {
    for (const p of CHANNEL_PRESETS) {
      const r = calculateProfit({ sellPrice: p.market === 'Pakistan' ? 2500 : 35, productCost: p.market === 'Pakistan' ? 600 : 8, ...p.values });
      expect(Number.isFinite(r.profitPerShipped)).toBe(true);
    }
    expect(inputsFromProduct({ market: 'Pakistan', cost: 100, price: 400 }).codFeePct).toBeGreaterThan(0);
  });
});
