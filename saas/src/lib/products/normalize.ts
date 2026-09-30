// Turns one raw item from the Make.com feed / products.json into a clean,
// bounded product row. Mirrors the parsing rules of the original app.v3.js.

export type Market = 'Global' | 'Pakistan';
export type ProofLevel = 'hard' | 'popular' | 'opinion' | '';

export interface ScorePart {
  label: string;
  value: number;
}

export interface NormalizedProduct {
  dedup_key: string;
  slug: string;
  name: string;
  keyword: string;
  market: Market;
  niche: string;
  currency: 'USD' | 'PKR';
  cost: number | null;
  price: number | null;
  markup: number | null;
  score: number;
  verdict: string;
  trend: string;
  competition: string;
  proof_level: ProofLevel;
  score_details: string;
  score_parts: ScorePart[];
  why: string;
  risk: string;
  ad_idea: string;
  audience: string;
  where_to_sell: string;
  image: string | null;
  source: string | null;
  supplier: string | null;
  date: string;
}

export function text(value: unknown, max = 300): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const n = parseFloat(String(value ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function safeUrl(value: unknown, allowHttp = false): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const u = new URL(value.trim());
    if (u.protocol === 'https:') return u.href;
    // Old feed items sometimes carry http images; upgrade rather than drop.
    if (allowHttp && u.protocol === 'http:') return 'https:' + u.href.slice(5);
    return null;
  } catch {
    return null;
  }
}

function pick(value: unknown, options: string[]): string {
  const first = text(value, 40).split(/[\s,/]/)[0]?.toLowerCase() ?? '';
  return options.find((o) => o.toLowerCase() === first) ?? '';
}

const CRITERIA: [RegExp, string][] = [
  [/safe/i, 'Safe to sell'],
  [/year|season|sells/i, 'Sells all year'],
  [/impulse|price/i, 'Impulse-buy price'],
  [/ship/i, 'Easy to ship'],
  [/happy|buyer|review/i, 'Happy buyers'],
  [/problem|wow|solv/i, 'Solves a problem'],
  [/comp/i, 'Low competition'],
  [/margin|profit/i, 'Profit margin'],
  [/trend|demand/i, 'Trending / demand'],
];

/** Parses "Proof: sales numbers · Safe to sell 10, Sells all year 9, …". */
export function parseScoreDetails(input: unknown): { level: ProofLevel; parts: ScorePart[] } {
  let s = text(input, 700);
  let level: ProofLevel = '';
  const head = s.match(/^Proof:\s*([^·|]+)[·|]\s*/i);
  if (head) {
    const h = head[1].toLowerCase();
    level = /sales/.test(h) ? 'hard' : /popular/.test(h) ? 'popular' : /opinion/.test(h) ? 'opinion' : '';
    s = s.slice(head[0].length);
  }
  const parts: ScorePart[] = [];
  const seen = new Set<string>();
  for (const chunk of s.split(/[,;]/)) {
    const m = chunk.trim().match(/^([A-Za-z][A-Za-z &'\-/()]{1,38}?)\s*[:=]?\s*(\d{1,2}(?:\.\d)?)(?:\s*\/\s*10)?$/);
    if (!m) continue;
    const value = parseFloat(m[2]);
    if (value < 0 || value > 10) continue;
    const known = CRITERIA.find(([re]) => re.test(m[1]));
    const label = known ? known[1] : m[1].trim();
    if (seen.has(label)) continue;
    seen.add(label);
    parts.push({ label, value });
  }
  return { level, parts: parts.slice(0, 10) };
}

export function dedupKey(name: string, keyword: string, market: Market): string {
  const base = (keyword || name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\b(the|a|an|for|with|and)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `${market.toLowerCase()}:${base}`;
}

export function slugify(name: string, market: Market): string {
  const s = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return `${s || 'product'}-${market === 'Pakistan' ? 'pk' : 'gl'}`;
}

/** Short, stable hash (FNV-1a) so slugs stay unique per dedup key. */
export function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(6, '0').slice(0, 6);
}

export function normalizeProduct(raw: unknown, fallbackDate: string): NormalizedProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = text(r.name, 120);
  if (name.length < 2) return null;
  const market: Market = text(r.market, 20) === 'Pakistan' ? 'Pakistan' : 'Global';
  const keyword = text(r.keyword, 80);
  const cost = num(r.cost);
  const price = num(r.price);
  let markup = num(r.markup);
  if (!(markup && markup > 0) && cost && cost > 0 && price && price > 0) markup = price / cost;
  const dateRaw = text(r.date, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : fallbackDate;
  const details = parseScoreDetails(r.scoreDetails);
  const key = dedupKey(name, keyword, market);
  return {
    dedup_key: key,
    slug: `${slugify(name, market)}-${shortHash(key)}`,
    name,
    keyword,
    market,
    niche: text(r.niche, 60) || 'Other',
    currency: market === 'Pakistan' ? 'PKR' : 'USD',
    cost: cost && cost > 0 ? round2(cost) : null,
    price: price && price > 0 ? round2(price) : null,
    markup: markup && markup > 0 && markup < 1000 ? round2(markup) : null,
    score: Math.max(0, Math.min(100, Math.round(num(r.score) ?? 0))),
    verdict: pick(r.verdict, ['Winner', 'Promising', 'Risky', 'Skip']),
    trend: pick(r.trend, ['Hot', 'Rising', 'Stable', 'Falling']),
    competition: pick(r.competition, ['Low', 'Medium', 'High']),
    proof_level: details.level,
    score_details: text(r.scoreDetails, 700),
    score_parts: details.parts,
    why: text(r.why, 600),
    risk: text(r.risk, 400),
    ad_idea: text(r.adIdea, 400),
    audience: text(r.audience, 200),
    where_to_sell: text(r.whereToSell, 200),
    image: safeUrl(r.image, true),
    source: safeUrl(r.source),
    supplier: safeUrl(r.supplier),
    date,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Dedupes a feed batch: the same product can appear on several days.
 * Returns one entry per dedup key (latest date wins for the product fields)
 * plus every (key, date) appearance for snapshots.
 */
export function groupFeed(items: NormalizedProduct[]) {
  const latest = new Map<string, NormalizedProduct>();
  const appearances = new Map<string, NormalizedProduct>();
  for (const p of items) {
    const cur = latest.get(p.dedup_key);
    if (!cur || p.date > cur.date || (p.date === cur.date && p.score > cur.score)) latest.set(p.dedup_key, p);
    const ak = `${p.dedup_key}|${p.date}`;
    const ca = appearances.get(ak);
    if (!ca || p.score > ca.score) appearances.set(ak, p);
  }
  return { products: [...latest.values()], snapshots: [...appearances.values()] };
}
