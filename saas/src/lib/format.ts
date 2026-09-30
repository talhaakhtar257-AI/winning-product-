export function money(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const pkr = currency === 'PKR';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: pkr ? 'PKR' : 'USD',
    maximumFractionDigits: pkr || Math.abs(value) >= 1000 ? 0 : 2,
  }).format(value);
}

export function pct(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const date = new Date(d.length === 10 ? d + 'T00:00:00Z' : d);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export const PROOF_LABEL: Record<string, string> = { hard: 'Sales proof', popular: 'Popular', opinion: 'Opinion' };

/** Supplier photos via the same resizing proxy the original site used (fast WebP, no hotlink blocks). */
export function photo(url: string, w: number, h: number): string {
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${w}&h=${h}&fit=cover&output=webp&q=76&we`;
}
