// Trend & saturation analysis from daily snapshots.

export interface Snapshot {
  date: string;
  score: number;
  price: number | null;
  competition: string;
  trend: string;
}

export type Saturation = 'fresh' | 'building' | 'saturating' | 'saturated';

export interface HistoryInsight {
  daysOnRadar: number;
  firstSeen: string | null;
  lastSeen: string | null;
  scoreChange: number;
  priceChangePct: number | null;
  saturation: Saturation;
  notes: string[];
}

const COMP = { Low: 0, Medium: 1, High: 2 } as Record<string, number>;

export function analyseHistory(raw: Snapshot[]): HistoryInsight {
  const s = [...raw].sort((a, b) => a.date.localeCompare(b.date));
  if (!s.length)
    return { daysOnRadar: 0, firstSeen: null, lastSeen: null, scoreChange: 0, priceChangePct: null, saturation: 'fresh', notes: [] };

  const first = s[0];
  const last = s[s.length - 1];
  const spanDays = Math.round((Date.parse(last.date) - Date.parse(first.date)) / 86_400_000) + 1;
  const scoreChange = last.score - first.score;
  const priceChangePct =
    first.price && last.price ? Math.round(((last.price - first.price) / first.price) * 1000) / 10 : null;
  const compRising = (COMP[last.competition] ?? 0) > (COMP[first.competition] ?? 0);

  const notes: string[] = [];
  let points = 0;
  if (spanDays >= 30) { points += 2; notes.push(`On the radar for ${spanDays} days — many sellers have seen it.`); }
  else if (spanDays >= 10) points += 1;
  if (compRising) { points += 2; notes.push(`Competition rose from ${first.competition || '?'} to ${last.competition}.`); }
  if (last.competition === 'High') points += 1;
  if (priceChangePct !== null && priceChangePct <= -15) { points += 1; notes.push(`Selling price fell ${Math.abs(priceChangePct)}% — a sign of a price war.`); }
  if (scoreChange <= -8) { points += 1; notes.push(`Score dropped ${Math.abs(scoreChange)} points.`); }
  if (last.trend === 'Falling') { points += 1; notes.push('Demand trend is falling.'); }
  if (scoreChange >= 5) notes.push(`Score up ${scoreChange} points — momentum is building.`);
  if (spanDays <= 3) notes.push('New on the radar — early-mover window.');

  const saturation: Saturation = points >= 4 ? 'saturated' : points >= 2 ? 'saturating' : spanDays <= 7 ? 'fresh' : 'building';
  return { daysOnRadar: s.length, firstSeen: first.date, lastSeen: last.date, scoreChange, priceChangePct, saturation, notes };
}
