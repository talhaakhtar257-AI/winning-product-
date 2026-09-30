/**
 * Imports the daily feed into Supabase.
 *
 *   npm run import:products                  # ../products.json (latest feed)
 *   npm run import:products -- --git-history # every committed version → full trend history
 *   npm run import:products -- --file path/to/products.json
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { extractItems, ingestProducts } from '../src/lib/products/ingest';

const args = process.argv.slice(2);
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
const repoRoot = resolve(import.meta.dirname, '..', '..');
const feedPath = resolve(fileArg ?? resolve(repoRoot, 'products.json'));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

function gitVersions(): { sha: string; json: string }[] {
  const shas = execFileSync('git', ['log', '--reverse', '--format=%H', '--', 'products.json'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  return shas.flatMap((sha) => {
    try {
      return [{ sha, json: execFileSync('git', ['show', `${sha}:products.json`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }) }];
    } catch {
      return [];
    }
  });
}

async function main() {
  const sources = args.includes('--git-history')
    ? gitVersions().map((v) => ({ label: `git ${v.sha.slice(0, 7)}`, json: v.json }))
    : [{ label: feedPath, json: readFileSync(feedPath, 'utf8') }];

  const totals = { received: 0, inserted: 0, updated: 0, snapshots: 0 };
  for (const s of sources) {
    let body: unknown;
    try {
      body = JSON.parse(s.json);
    } catch {
      console.warn(`skip ${s.label}: invalid JSON`);
      continue;
    }
    const fallback = (body as { updated?: string })?.updated?.slice(0, 10);
    const r = await ingestProducts(db, extractItems(body), args.includes('--git-history') ? 'git-backfill' : 'github', fallback);
    console.log(`${s.label}: ${r.valid}/${r.received} valid, +${r.inserted} new, ${r.updated} updated, ${r.snapshots} snapshots`);
    totals.received += r.received;
    totals.inserted += r.inserted;
    totals.updated += r.updated;
    totals.snapshots += r.snapshots;
  }
  console.log('Done:', totals);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
