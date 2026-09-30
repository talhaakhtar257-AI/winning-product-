import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dedupKey, groupFeed, normalizeProduct, parseScoreDetails, safeUrl } from '@/lib/products/normalize';
import { extractItems } from '@/lib/products/ingest';
import { analyseHistory } from '@/lib/products/history';
import { researchLinks } from '@/lib/research/links';
import { toCsv } from '@/lib/csv';
import { parseSettings, settingsSchemas, themeCss } from '@/lib/settings';

describe('normalizeProduct', () => {
  it('parses every item in the real products.json feed', () => {
    const feed = JSON.parse(readFileSync(resolve(__dirname, '../../products.json'), 'utf8'));
    const items = extractItems(feed);
    expect(items.length).toBeGreaterThan(0);
    const out = items.map((i) => normalizeProduct(i, '2026-01-01'));
    expect(out.every(Boolean)).toBe(true);
    for (const p of out) {
      expect(p!.score).toBeGreaterThanOrEqual(0);
      expect(p!.score).toBeLessThanOrEqual(100);
      expect(['USD', 'PKR']).toContain(p!.currency);
      expect(p!.slug).toMatch(/^[a-z0-9-]+$/);
    }
    // Most feed items carry a 9-part score breakdown with a proof level.
    expect(out.filter((p) => p!.score_parts.length >= 5).length).toBeGreaterThan(out.length / 2);
  });

  it('drops unsafe URLs and upgrades http images', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('http://x.com/a.jpg')).toBeNull();
    expect(safeUrl('http://x.com/a.jpg', true)).toBe('https://x.com/a.jpg');
    const p = normalizeProduct({ name: 'Test item', supplier: 'javascript:alert(1)', image: 'http://img.com/x.png' }, '2026-01-01')!;
    expect(p.supplier).toBeNull();
    expect(p.image).toBe('https://img.com/x.png');
  });

  it('computes markup and clamps score', () => {
    const p = normalizeProduct({ name: 'Widget', cost: '10', price: '$35', score: 180, market: 'Pakistan' }, '2026-01-01')!;
    expect(p.markup).toBe(3.5);
    expect(p.score).toBe(100);
    expect(p.currency).toBe('PKR');
    expect(normalizeProduct({ name: 'x' }, '2026-01-01')).toBeNull();
    expect(normalizeProduct(null, '2026-01-01')).toBeNull();
  });

  it('parses score details', () => {
    const r = parseScoreDetails('Proof: sales numbers · Safe to sell 10, Sells all year 9, Low competition 7/10');
    expect(r.level).toBe('hard');
    expect(r.parts).toEqual([{ label: 'Safe to sell', value: 10 }, { label: 'Sells all year', value: 9 }, { label: 'Low competition', value: 7 }]);
  });
});

describe('groupFeed', () => {
  it('dedupes products and keeps one snapshot per day', () => {
    const a1 = normalizeProduct({ name: 'Cat Fountain', keyword: 'Cat water fountain', market: 'Global', score: 90, date: '2026-09-25' }, '')!;
    const a2 = normalizeProduct({ name: 'Automatic Cat Water Fountain', keyword: 'cat water fountain', market: 'Global', score: 94, date: '2026-09-29' }, '')!;
    const a2dup = normalizeProduct({ name: 'Automatic Cat Water Fountain', keyword: 'cat water fountain', market: 'Global', score: 80, date: '2026-09-29' }, '')!;
    const pk = normalizeProduct({ name: 'Cat Fountain', keyword: 'Cat water fountain', market: 'Pakistan', score: 70, date: '2026-09-29' }, '')!;
    const { products, snapshots } = groupFeed([a1, a2, a2dup, pk]);
    expect(products).toHaveLength(2); // Global + Pakistan are different products
    expect(products.find((p) => p.market === 'Global')!.name).toBe('Automatic Cat Water Fountain'); // latest wins
    expect(snapshots).toHaveLength(3);
    expect(snapshots.find((s) => s.market === 'Global' && s.date === '2026-09-29')!.score).toBe(94);
    expect(dedupKey('A', 'The Cat Fountain', 'Global')).toBe(dedupKey('B', 'cat fountain', 'Global'));
  });
});

describe('extractItems', () => {
  it('accepts the three payload shapes', () => {
    expect(extractItems({ products: [1, 2] })).toHaveLength(2);
    expect(extractItems([1])).toHaveLength(1);
    expect(extractItems({ name: 'x' })).toHaveLength(1);
    expect(extractItems('nope')).toHaveLength(0);
  });
});

describe('analyseHistory', () => {
  it('detects saturation', () => {
    const days = Array.from({ length: 40 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10),
      score: 90 - Math.floor(i / 4), price: 40 - i * 0.3, competition: i < 20 ? 'Low' : 'High', trend: i < 30 ? 'Hot' : 'Falling',
    }));
    const r = analyseHistory(days);
    expect(r.saturation).toBe('saturated');
    expect(r.daysOnRadar).toBe(40);
    expect(r.notes.length).toBeGreaterThan(2);
  });
  it('new products are fresh', () => {
    expect(analyseHistory([{ date: '2026-09-29', score: 90, price: 20, competition: 'Low', trend: 'Hot' }]).saturation).toBe('fresh');
    expect(analyseHistory([]).daysOnRadar).toBe(0);
  });
});

describe('misc', () => {
  it('research links are https and encoded', () => {
    const links = researchLinks('cat & dog "toy"', 'Pakistan');
    expect(links.every((l) => l.url.startsWith('https://'))).toBe(true);
    expect(links.some((l) => l.label === 'Daraz.pk')).toBe(true);
    expect(links[0].url).toContain('cat%20%26%20dog');
  });
  it('csv escapes quotes and blocks formula injection', () => {
    const csv = toCsv([{ a: '=HYPERLINK("x")', b: 'x,y' }], ['a', 'b']);
    expect(csv).toBe('a,b\r\n"\'=HYPERLINK(""x"")","x,y"');
  });
  it('settings fall back to safe defaults and reject CSS injection', () => {
    const s = parseSettings([{ key: 'theme', value: { brand: 'red;}body{display:none', accent: '#FFAA00' } }]);
    expect(s.theme.brand).toBe('#13201A');
    expect(themeCss(s.theme)).not.toContain('display');
    expect(settingsSchemas.theme.safeParse({ brand: '#123456' }).success).toBe(true);
    expect(parseSettings([]).brand.name).toBe('WinScout');
  });
});
