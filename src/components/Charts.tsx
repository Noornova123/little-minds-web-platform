import { useId } from 'react';

interface Series {
  label: string;
  color: string;
  values: (number | null)[]; // null = gap
}

interface LineChartProps {
  labels: string[];
  series: Series[];
  height?: number;
  yMax?: number;
  yMin?: number;
  formatY?: (v: number) => string;
}

// Responsive SVG line chart. Values may be null to create gaps.
export function LineChart({ labels, series, height = 220, yMax, yMin = 0, formatY = (v) => String(v) }: LineChartProps) {
  const gid = useId();
  const width = 640;
  const padL = 38, padR = 16, padT = 14, padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const allVals = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const maxV = yMax ?? (allVals.length ? Math.max(...allVals) : 100);
  const minV = yMin;
  const range = maxV - minV || 1;

  const x = (i: number) => padL + (labels.length > 1 ? (i / (labels.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => padT + plotH - ((v - minV) / range) * plotH;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minV + (range * i) / ticks);

  return (
    <div className="w-full overflow-x-auto lm-chart-scroll">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ minWidth: 320 }} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={`grad-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--terracotta-soft)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--terracotta-soft)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={y(t)} x2={width - padR} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="var(--ink-soft)">{formatY(t)}</text>
          </g>
        ))}

        {labels.map((l, i) => (
          <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="9" fill="var(--ink-soft)">
            {l}
          </text>
        ))}

        {series.map((s, si) => {
          const pts = s.values.map((v, i) => (v === null ? null : { x: x(i), y: y(v) }));
          const path = pts.map((p, i) => (p === null ? '' : `${i === 0 || pts[i - 1] === null ? 'M' : 'L'}${p.x},${p.y}`)).filter(Boolean).join(' ');
          const areaPath = pts.length > 1 && pts[0] && pts[pts.length - 1]
            ? `${path} L${pts[pts.length - 1]!.x},${padT + plotH} L${pts[0]!.x},${padT + plotH} Z`
            : '';
          return (
            <g key={si}>
              {si === 0 && areaPath && <path d={areaPath} fill={`url(#grad-${gid})`} />}
              <path d={path} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {pts.map((p, i) => p === null ? null : (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke={s.color} strokeWidth="2" />
              ))}
            </g>
          );
        })}
      </svg>

      {series.length > 1 && (
        <div className="flex flex-wrap gap-3 justify-center mt-1">
          {series.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-soft)]">
              <span className="w-3 h-3 rounded-full" style={{ background: s.color }} />
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Bar {
  label: string;
  value: number;
  color?: string;
}

export function BarChart({ bars, height = 220, yMax = 100, formatY = (v) => String(v) }: { bars: Bar[]; height?: number; yMax?: number; formatY?: (v: number) => string }) {
  const width = 640;
  const padL = 38, padR = 16, padT = 14, padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const bw = bars.length ? Math.min(48, (plotW / bars.length) - 8) : 0;

  const y = (v: number) => padT + plotH - (v / yMax) * plotH;
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => (yMax * i) / ticks);

  return (
    <div className="w-full overflow-x-auto lm-chart-scroll">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ minWidth: 320 }} preserveAspectRatio="xMidYMid meet">
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={y(t)} x2={width - padR} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="var(--ink-soft)">{formatY(t)}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const cx = padL + ((i + 0.5) / bars.length) * plotW;
          const top = y(b.value);
          return (
            <g key={i}>
              <rect x={cx - bw / 2} y={top} width={bw} height={padT + plotH - top} rx="6" fill={b.color ?? 'var(--sage)'} />
              <text x={cx} y={height - 8} textAnchor="middle" fontSize="9" fill="var(--ink-soft)">{b.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
