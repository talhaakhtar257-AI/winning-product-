// Single-series line chart (one measure per chart — never dual axes).
// Server-rendered SVG; each point has an enlarged, focusable hit target with a
// native tooltip, and callers render a table view alongside for accessibility.

interface Point {
  x: string;
  y: number;
}

export function LineChart({ points, label, format = (v: number) => String(v), height = 180 }: {
  points: Point[];
  label: string;
  format?: (v: number) => string;
  height?: number;
}) {
  if (points.length === 0) return <p className="muted small">No history yet.</p>;
  const W = 600;
  const H = height;
  const pad = { l: 44, r: 12, t: 12, b: 26 };
  const ys = points.map((p) => p.y);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  min -= span * 0.1;
  max += span * 0.1;
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const ticks = [min + (max - min) * 0.1, (min + max) / 2, max - (max - min) * 0.1];
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const labelIdx = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${format(ys[0])} to ${format(ys[ys.length - 1])}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid-line" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
          <text className="axis" x={pad.l - 6} y={y(t) + 4} textAnchor="end">
            {format(t)}
          </text>
        </g>
      ))}
      {labelIdx.map((i) => (
        <text key={i} className="axis" x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>
          {points[i].x.slice(5)}
        </text>
      ))}
      <path className="series" d={d} />
      {points.map((p, i) => (
        <g key={p.x}>
          <circle className="hit" cx={x(i)} cy={y(p.y)} r={14} tabIndex={0}>
            <title>{`${p.x}: ${format(p.y)}`}</title>
          </circle>
          <circle className="pt" cx={x(i)} cy={y(p.y)} r={4} />
        </g>
      ))}
      {/* direct label on the latest value only */}
      <text className="axis" x={x(points.length - 1)} y={y(ys[ys.length - 1]) - 10} textAnchor="end" style={{ fill: 'var(--ink)', fontWeight: 700 }}>
        {format(ys[ys.length - 1])}
      </text>
    </svg>
  );
}
