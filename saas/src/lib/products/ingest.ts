import type { SupabaseClient } from '@supabase/supabase-js';
import { groupFeed, normalizeProduct, type NormalizedProduct } from './normalize';

// Shared by POST /api/ingest (Make.com) and scripts/import-products.ts.
// No 'server-only' import so the Node script can use it too.

export interface IngestResult {
  received: number;
  valid: number;
  inserted: number;
  updated: number;
  snapshots: number;
}

const CHUNK = 200;
const chunks = <T,>(a: T[]) => Array.from({ length: Math.ceil(a.length / CHUNK) }, (_, i) => a.slice(i * CHUNK, (i + 1) * CHUNK));

function row(p: NormalizedProduct) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { date, ...rest } = p;
  return rest;
}

export async function ingestProducts(
  db: SupabaseClient,
  items: unknown[],
  source: string,
  today = new Date().toISOString().slice(0, 10),
): Promise<IngestResult> {
  const normalized = items.map((i) => normalizeProduct(i, today)).filter((p): p is NormalizedProduct => !!p);
  const { products, snapshots } = groupFeed(normalized);
  const result: IngestResult = { received: items.length, valid: normalized.length, inserted: 0, updated: 0, snapshots: 0 };

  try {
    const existing = new Map<string, { id: string; slug: string; last_seen: string }>();
    for (const part of chunks(products.map((p) => p.dedup_key))) {
      const { data, error } = await db.from('products').select('id, slug, dedup_key, last_seen').in('dedup_key', part);
      if (error) throw error;
      for (const r of data ?? []) existing.set(r.dedup_key, { id: r.id, slug: r.slug, last_seen: r.last_seen });
    }

    const toInsert = products.filter((p) => !existing.has(p.dedup_key));
    // Backfilling old history must not overwrite newer product details.
    const toUpdate = products.filter((p) => {
      const e = existing.get(p.dedup_key);
      return e && p.date >= e.last_seen;
    });

    for (const part of chunks(toInsert)) {
      const { error } = await db
        .from('products')
        .insert(part.map((p) => ({ ...row(p), first_seen: p.date, last_seen: p.date })));
      if (error) throw error;
      result.inserted += part.length;
    }
    for (const part of chunks(toUpdate)) {
      const { error } = await db.from('products').upsert(
        part.map((p) => {
          const e = existing.get(p.dedup_key)!;
          // slug stays stable once published so shared links keep working
          return { ...row(p), id: e.id, slug: e.slug, first_seen: p.date, last_seen: p.date, updated_at: new Date().toISOString() };
        }),
        { onConflict: 'id' },
      );
      if (error) throw error;
      result.updated += part.length;
    }

    // Map every key to its id (including just-inserted rows).
    const ids = new Map<string, string>();
    for (const part of chunks(products.map((p) => p.dedup_key))) {
      const { data, error } = await db.from('products').select('id, dedup_key').in('dedup_key', part);
      if (error) throw error;
      for (const r of data ?? []) ids.set(r.dedup_key, r.id);
    }

    const snapRows = snapshots
      .filter((s) => ids.has(s.dedup_key))
      .map((s) => ({
        product_id: ids.get(s.dedup_key)!,
        date: s.date,
        score: s.score,
        price: s.price,
        cost: s.cost,
        markup: s.markup,
        trend: s.trend,
        competition: s.competition,
        verdict: s.verdict,
      }));
    for (const part of chunks(snapRows)) {
      const { error } = await db.from('product_snapshots').upsert(part, { onConflict: 'product_id,date' });
      if (error) throw error;
      result.snapshots += part.length;
    }
    for (const part of chunks([...new Set(snapRows.map((s) => s.product_id))])) {
      const { error } = await db.rpc('refresh_product_stats', { ids: part });
      if (error) throw error;
    }

    await db.from('ingest_runs').insert({ source, received: result.received, inserted: result.inserted, updated: result.updated, snapshots: result.snapshots });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String(err.message) : String(err);
    await db.from('ingest_runs').insert({ source, received: result.received, error: message.slice(0, 500) });
    throw new Error(message);
  }
}

/** Accepts `{products:[…]}`, `[…]` or a single product object. */
export function extractItems(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (Array.isArray(b.products)) return b.products;
    if (typeof b.name === 'string') return [b];
  }
  return [];
}
