import { type ReactNode } from 'react';
import { Star, Award, TrendingUp, Heart, Target, Sparkles, Calendar, GraduationCap } from 'lucide-react';
import type { ReportData } from '@/lib/reportData';
import { computeDomainTrends, computeMonthlyTrend, attendancePct, checkpointAcc, markBadge, generateNarrative, generateSuggestions } from '@/lib/reportData';
import { renderDomainIcon } from '@/lib/domainIcons';

// A4 dimensions at 96 DPI: 794px x 1123px. We render at 2x scale for PDF clarity.
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

interface TemplateProps {
  data: ReportData;
}

export function PdfReportTemplate({ data }: TemplateProps) {
  const { student, school, classRow, marks, notes, achievements, academicYear } = data;
  const brand = school.brand_color || '#c66b3d';
  const firstName = student.name.split(' ')[0];

  const domainTrends = computeDomainTrends(data);
  const monthlyTrend = computeMonthlyTrend(data);
  const attPct = attendancePct(data);
  const cpAcc = checkpointAcc(data);
  const narrative = generateNarrative(data);
  const suggestions = generateSuggestions(data);

  // Group marks by exam+year
  const marksByExam: Record<string, typeof marks> = {};
  for (const m of marks) {
    const key = `${m.exam_name} · ${m.academic_year}`;
    if (!marksByExam[key]) marksByExam[key] = [];
    marksByExam[key].push(m);
  }
  const examGroups = Object.entries(marksByExam).sort(([a], [b]) => b.localeCompare(a));

  return (
    <div id="pdf-report-root" style={{ width: A4_WIDTH, background: '#fff', fontFamily: 'Inter, system-ui, sans-serif', color: '#18181b', margin: '0 auto' }}>
      {/* ──────────── 1. COVER PAGE ──────────── */}
      <div style={{ width: A4_WIDTH, height: A4_HEIGHT, position: 'relative', overflow: 'hidden', background: '#faf8f5' }}>
        {/* Decorative top band */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 220, background: `linear-gradient(135deg, ${brand}, ${brand}dd)`, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -60, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', top: 40, right: 80, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ position: 'absolute', top: 80, right: 200, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        </div>

        {/* Logo */}
        {school.logo_url && (
          <div style={{ position: 'absolute', top: 40, left: 48, display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={school.logo_url} alt="logo" style={{ height: 56, width: 'auto', objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 4 }} />
            <span style={{ color: '#fff', fontSize: 18, fontWeight: 800, fontFamily: 'Fraunces, serif' }}>{school.name}</span>
          </div>
        )}
        {!school.logo_url && (
          <div style={{ position: 'absolute', top: 48, left: 48, color: '#fff', fontSize: 22, fontWeight: 800, fontFamily: 'Fraunces, serif' }}>{school.name}</div>
        )}

        {/* Cover content */}
        <div style={{ position: 'absolute', top: 300, left: 48, right: 48, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 20, background: `${brand}15`, marginBottom: 24 }}>
            <Sparkles size={36} color={brand} />
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 800, fontFamily: 'Fraunces, serif', color: '#18181b', margin: '0 0 8px', lineHeight: 1.1 }}>Yearly Growth Report</h1>
          <p style={{ fontSize: 16, color: '#71717a', margin: '0 0 40px' }}>Academic Year {academicYear}</p>

          {/* Student card */}
          <div style={{ display: 'inline-block', padding: '32px 48px', borderRadius: 24, background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #e4e4e7' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', background: `${brand}15`, marginBottom: 16 }}>
              <GraduationCap size={28} color={brand} />
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#18181b', margin: '0 0 8px', fontFamily: 'Fraunces, serif' }}>{student.name}</h2>
            <p style={{ fontSize: 15, color: '#71717a', margin: '0 0 4px' }}>Roll No. {student.roll_number} · {classRow?.name ?? '—'}</p>
            <p style={{ fontSize: 14, color: '#71717a', margin: 0 }}>{school.name}</p>
          </div>
        </div>

        {/* Decorative bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: `linear-gradient(135deg, ${brand}10, ${brand}05)` }}>
          <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center', fontSize: 12, color: '#a1a1aa' }}>
            Generated on {new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}
          </div>
        </div>
      </div>

      {/* ──────────── 2. ACADEMIC PERFORMANCE ──────────── */}
      <PdfPage brand={brand}>
        <SectionHeader number="1" title="Academic Performance" brand={brand} icon={<Target size={20} color={brand} />} />
        {examGroups.length === 0 ? (
          <EmptyBox text="No exam marks recorded this year." />
        ) : (
          <div style={{ marginTop: 24 }}>
            {examGroups.map(([label, rows]) => {
              const totalObtained = rows.reduce<number>((a, m) => a + Number(m.marks_obtained), 0);
              const totalMax = rows.reduce<number>((a, m) => a + Number(m.total_marks), 0);
              const overallPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
              const badge = markBadge(overallPct);
              return (
                <div key={label} style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f4f4f5', borderRadius: '12px 12px 0 0' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#18181b' }}>{label}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#71717a' }}>{totalObtained} / {totalMax}</span>
                      <BadgePill label={badge.label} bg={badge.bg} color={badge.color} />
                    </span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <tbody>
                      {rows.map((m, i) => {
                        const pct = Number(m.total_marks) > 0 ? Math.round((Number(m.marks_obtained) / Number(m.total_marks)) * 100) : 0;
                        const b = markBadge(pct);
                        return (
                          <tr key={m.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #e4e4e7' }}>
                            <td style={{ padding: '10px 16px', fontWeight: 600, color: '#18181b' }}>{m.subject}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#71717a', fontVariantNumeric: 'tabular-nums' }}>{Number(m.marks_obtained)} / {Number(m.total_marks)}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', width: 100 }}>
                              <BadgePill label={b.label} bg={b.bg} color={b.color} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick stats row */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <StatCard label="Attendance" value={attPct === null ? '—' : `${attPct}%`} brand={brand} />
          <StatCard label="Activity Accuracy" value={cpAcc === null ? '—' : `${cpAcc}%`} brand={brand} />
          <StatCard label="Activities Done" value={String(data.checkpoints.length)} brand={brand} />
          <StatCard label="Achievements" value={String(achievements.length)} brand={brand} />
        </div>
      </PdfPage>

      {/* ──────────── 3. YOUR YEAR IN FOCUS ──────────── */}
      <PdfPage brand={brand}>
        <SectionHeader number="2" title="Your Year in Focus" brand={brand} icon={<Heart size={20} color={brand} />} />
        <div style={{ marginTop: 24, padding: 24, background: '#faf8f5', borderRadius: 16, border: `1px solid ${brand}20` }}>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#3f3f46', margin: 0 }}>{narrative}</p>
        </div>

        {notes.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#18181b', margin: '0 0 12px' }}>Teacher Observations</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {notes.slice(0, 6).map((n) => (
                <div key={n.id} style={{ display: 'flex', gap: 10, padding: '12px 16px', background: '#f4f4f5', borderRadius: 12 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: brand, marginTop: 7, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 13, color: '#3f3f46', margin: 0, lineHeight: 1.5 }}>{n.note_text}</p>
                    <p style={{ fontSize: 11, color: '#a1a1aa', margin: '4px 0 0' }}>{new Date(n.date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </PdfPage>

      {/* ──────────── 4. GROWTH CHARTS ──────────── */}
      <PdfPage brand={brand}>
        <SectionHeader number="3" title="Growth Charts" brand={brand} icon={<TrendingUp size={20} color={brand} />} />

        {monthlyTrend.labels.length > 0 ? (
          <ChartBox title="Focus & Brain Score Trends" brand={brand}>
            <SimpleLineChart
              labels={monthlyTrend.labels}
              series={[
                { label: 'Focus', color: '#c66b3d', values: monthlyTrend.focus },
                { label: 'Brain', color: '#6ba8c9', values: monthlyTrend.brain },
              ]}
            />
          </ChartBox>
        ) : (
          <EmptyBox text="No monthly focus/brain scores recorded this year." />
        )}

        {domainTrends.filter((t) => t.labels.length > 0).map((t) => (
          <ChartBox key={t.domain.id} title={t.domain.name + ' Score Trend'} brand={brand}>
            <SimpleLineChart
              labels={t.labels}
              series={[{ label: t.domain.name, color: t.domain.color, values: t.values }]}
            />
          </ChartBox>
        ))}

        {domainTrends.filter((t) => t.labels.length > 0).length === 0 && monthlyTrend.labels.length === 0 && (
          <EmptyBox text="Growth charts will appear once monthly checklist data is recorded." />
        )}
      </PdfPage>

      {/* ──────────── 5. ACHIEVEMENTS ──────────── */}
      <PdfPage brand={brand}>
        <SectionHeader number="4" title="Achievements" brand={brand} icon={<Award size={20} color={brand} />} />
        {achievements.length === 0 ? (
          <EmptyBox text="No achievements recorded this year yet." />
        ) : (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {achievements.map((a) => (
              <div key={a.id} style={{ display: 'flex', gap: 16, padding: 20, background: '#fff', borderRadius: 16, border: '1px solid #e4e4e7', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 14, background: `${brand}15`, flexShrink: 0 }}>
                  <Star size={24} color={brand} fill={brand} fillOpacity={0.2} />
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: '#18181b', margin: '0 0 4px' }}>{a.title}</h4>
                  {a.description && <p style={{ fontSize: 13, color: '#71717a', margin: '0 0 6px', lineHeight: 1.5 }}>{a.description}</p>}
                  <p style={{ fontSize: 11, color: '#a1a1aa', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={11} /> {new Date(a.achievement_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </PdfPage>

      {/* ──────────── 6. WHERE TO FOCUS NEXT ──────────── */}
      <PdfPage brand={brand}>
        <SectionHeader number="5" title="Where to Focus Next" brand={brand} icon={<Sparkles size={20} color={brand} />} />
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {suggestions.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, padding: 20, background: '#faf8f5', borderRadius: 16, border: `1px solid ${brand}20` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 12, background: brand, flexShrink: 0 }}>
                <span style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>{i + 1}</span>
              </div>
              <p style={{ fontSize: 14, color: '#3f3f46', margin: 0, lineHeight: 1.6, paddingTop: 8 }}>{s}</p>
            </div>
          ))}
        </div>

        {/* Closing footer */}
        <div style={{ marginTop: 48, padding: 24, background: `linear-gradient(135deg, ${brand}10, ${brand}05)`, borderRadius: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: '#71717a', margin: 0, lineHeight: 1.6 }}>
            This report celebrates {firstName}'s growth across academics, social-emotional wellbeing, and life skills.
            It is observational and supportive — a snapshot of a wonderful year of learning.
          </p>
        </div>
      </PdfPage>
    </div>
  );
}

// ──────────── Template helper components ────────────

function PdfPage({ children, brand }: { children: ReactNode; brand: string }) {
  return (
    <div style={{ width: A4_WIDTH, minHeight: A4_HEIGHT, padding: '48px 48px 64px', position: 'relative', pageBreakAfter: 'always', background: '#fff' }}>
      {children}
      {/* Footer line */}
      <div style={{ position: 'absolute', bottom: 28, left: 48, right: 48, borderTop: '1px solid #e4e4e7', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#a1a1aa' }}>
        <span>Little Minds · Yearly Growth Report</span>
        <span style={{ color: brand, fontWeight: 600 }}>www.littleminds.app</span>
      </div>
    </div>
  );
}

function SectionHeader({ number, title, brand, icon }: { number: string; title: string; brand: string; icon: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 16, borderBottom: `2px solid ${brand}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 12, background: brand, flexShrink: 0 }}>
        {icon && <span style={{ color: '#fff' }}>{icon}</span>}
      </div>
      <div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: 1 }}>Section {number}</span>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#18181b', margin: 0, fontFamily: 'Fraunces, serif', lineHeight: 1.2 }}>{title}</h2>
      </div>
    </div>
  );
}

function BadgePill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: bg, color }}>{label}</span>
  );
}

function StatCard({ label, value, brand }: { label: string; value: string; brand: string }) {
  return (
    <div style={{ flex: 1, padding: 16, borderRadius: 14, background: '#f4f4f5', textAlign: 'center' }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color: brand, margin: 0 }}>{value}</p>
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div style={{ marginTop: 24, padding: 40, background: '#f4f4f5', borderRadius: 16, textAlign: 'center' }}>
      <p style={{ fontSize: 13, color: '#a1a1aa', margin: 0 }}>{text}</p>
    </div>
  );
}

function ChartBox({ title, children, brand }: { title: string; children: ReactNode; brand: string }) {
  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#18181b', margin: '0 0 12px' }}>{title}</h3>
      <div style={{ padding: 16, background: '#faf8f5', borderRadius: 14, border: `1px solid ${brand}15` }}>
        {children}
      </div>
    </div>
  );
}

// ──────────── Static SVG chart for PDF ────────────

interface SimpleLineChartProps {
  labels: string[];
  series: { label: string; color: string; values: (number | null)[] }[];
}

function SimpleLineChart({ labels, series }: SimpleLineChartProps) {
  const width = 680;
  const height = 200;
  const padL = 40, padR = 16, padT = 14, padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const allVals = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const maxV = 100;
  const minV = 0;
  const range = maxV - minV || 1;

  const x = (i: number) => padL + (labels.length > 1 ? (i / (labels.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => padT + plotH - ((v - minV) / range) * plotH;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minV + (range * i) / ticks);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }} preserveAspectRatio="xMidYMid meet">
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={y(t)} x2={width - padR} y2={y(t)} stroke="#e4e4e7" strokeWidth="1" />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#71717a">{t}</text>
        </g>
      ))}
      {labels.map((l, i) => (
        <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="9" fill="#71717a">{l}</text>
      ))}
      {series.map((s, si) => {
        const pts = s.values.map((v, i) => (v === null ? null : { x: x(i), y: y(v) }));
        const path = pts.map((p, i) => (p === null ? '' : `${i === 0 || pts[i - 1] === null ? 'M' : 'L'}${p.x},${p.y}`)).filter(Boolean).join(' ');
        return (
          <g key={si}>
            <path d={path} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((p, i) => p === null ? null : (
              <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke={s.color} strokeWidth="2" />
            ))}
          </g>
        );
      })}
      {series.length > 1 && (
        <g>
          {series.map((s, i) => (
            <g key={i} transform={`translate(${width / 2 - (series.length * 60) / 2 + i * 60}, ${height - 2})`}>
              <rect x={0} y={-8} width={10} height={10} rx={2} fill={s.color} />
              <text x={14} y={0} fontSize="10" fill="#71717a" fontWeight="600">{s.label}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

// Re-export the domain icon renderer for potential external use
export { renderDomainIcon };
