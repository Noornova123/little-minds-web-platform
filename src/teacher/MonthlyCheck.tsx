import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, CalendarDays, Save, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import type { ChecklistStatement, ChecklistResponse, ChecklistDomainRow } from '@/lib/types';
import { renderDomainIcon } from '@/lib/domainIcons';
import { Card, Button, Spinner, EmptyState } from '@/components/ui';
import { useClassContext } from '@/teacher/useClassContext';
import { ClassSelector } from '@/teacher/ClassSelector';

type CellValue = 0 | 1 | 2;

const RESPONSE_LABELS: Record<CellValue, string> = { 0: 'Rarely', 1: 'Sometimes', 2: 'Yes' };
const RESPONSE_COLORS: Record<CellValue, string> = {
  0: 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]',
  1: 'bg-[var(--sunny-soft)] text-[var(--amber)] border-[#fde68a]',
  2: 'bg-[#f0fdf4] text-[var(--sage-deep)] border-[#bbf7d0]',
};
// Cycle: blank → Yes → Sometimes → Rarely → blank.
// undefined = blank, 2 = Yes, 1 = Sometimes, 0 = Rarely.
function nextValue(current: CellValue | undefined): CellValue | undefined {
  if (current === undefined) return 2; // blank → Yes
  if (current === 2) return 1;         // Yes → Sometimes
  if (current === 1) return 0;         // Sometimes → Rarely
  return undefined;                    // Rarely → blank
}

export function MonthlyCheck() {
  const { classes, selectedClass, students, loading, selectClass } = useClassContext();
  const [domains, setDomains] = useState<ChecklistDomainRow[]>([]);
  const [statements, setStatements] = useState<ChecklistStatement[]>([]);
  const [responses, setResponses] = useState<Record<string, CellValue | undefined>>({});
  const [existingIds, setExistingIds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const month = new Date().toISOString().slice(0, 7) + '-01';
  const monthLabel = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const load = useCallback(async () => {
    if (!selectedClass) return;
    setDataLoading(true);
    const [domRes, stmtRes, respRes] = await Promise.all([
      supabase.from('checklist_domains').select('*').order('display_order', { ascending: true }),
      supabase.from('checklist_statements').select('*').order('display_order', { ascending: true }),
      students.length > 0
        ? supabase.from('checklist_responses').select('*').in('student_id', students.map((s) => s.id)).eq('month', month)
        : Promise.resolve({ data: [], error: null }),
    ]);
    setDomains((domRes.data as ChecklistDomainRow[]) ?? []);
    setStatements((stmtRes.data as ChecklistStatement[]) ?? []);
    const respMap: Record<string, CellValue | undefined> = {};
    const idMap: Record<string, string> = {};
    (respRes.data as ChecklistResponse[] | null)?.forEach((r) => {
      const key = `${r.student_id}:${r.statement_id}`;
      respMap[key] = r.value as CellValue;
      idMap[key] = r.id;
    });
    setResponses(respMap);
    setExistingIds(idMap);
    setDataLoading(false);
  }, [selectedClass, students, month]);

  useEffect(() => { if (selectedClass) load(); }, [load]);

  function tap(studentId: string, statementId: string) {
    const key = `${studentId}:${statementId}`;
    setResponses((p) => {
      const next = nextValue(p[key]);
      const copy = { ...p };
      if (next === undefined) delete copy[key];
      else copy[key] = next;
      return copy;
    });
    setSaved(false);
  }

  async function save() {
    if (!selectedClass) return;
    setBusy(true);
    const toUpsert: { student_id: string; statement_id: string; month: string; value: number; id?: string }[] = [];
    for (const [key, value] of Object.entries(responses)) {
      if (value === undefined) continue;
      const [studentId, statementId] = key.split(':');
      toUpsert.push({ student_id: studentId, statement_id: statementId, month, value, id: existingIds[key] });
    }
    for (const r of toUpsert) {
      if (r.id) {
        await supabase.from('checklist_responses').update({ value: r.value }).eq('id', r.id);
      } else {
        await supabase.from('checklist_responses').insert({ student_id: r.student_id, statement_id: r.statement_id, month: r.month, value: r.value });
      }
    }
    setBusy(false);
    setSaved(true);
    load();
  }

  if (loading) return <Spinner label="Loading…" />;

  function completionPct(): number {
    if (students.length === 0 || statements.length === 0) return 0;
    const total = students.length * statements.length;
    const filled = Object.values(responses).filter((v) => v !== undefined).length;
    return Math.round((filled / total) * 100);
  }

  return (
    <div className="space-y-5 lm-fade-up">
      <button onClick={() => navigate('/dashboard')} className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ink-soft)] hover:text-[var(--terracotta)]">
        <ArrowLeft size={16} /> Class home
      </button>

      <ClassSelector classes={classes} selected={selectedClass} onSelect={selectClass} />

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays size={20} className="text-[var(--amber)]" />
          <h1 className="text-xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Monthly Checklist</h1>
        </div>
        <p className="text-sm text-[var(--ink-soft)] mb-4">{monthLabel} · Tap each cell to cycle through Yes → Sometimes → Rarely → blank. Scores calculate automatically.</p>
        <p className="text-xs font-bold text-[var(--ink-soft)] mb-3"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#bbf7d0] align-middle mr-1" />Yes · <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#fde68a] align-middle mr-1" />Sometimes · <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#fecaca] align-middle mr-1" />Rarely</p>

        {dataLoading ? <Spinner label="Loading checklist…" /> : students.length === 0 ? (
          <EmptyState title="No students" />
        ) : statements.length === 0 ? (
          <EmptyState title="No checklist statements" hint="Your admin needs to add statements first. Let them know!" />
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-2 rounded-full bg-[var(--cream-deep)] overflow-hidden">
                <div className="h-full bg-[var(--sage)] transition-all" style={{ width: `${completionPct()}%` }} />
              </div>
              <span className="text-xs font-extrabold text-[var(--ink-soft)]">{completionPct()}%</span>
            </div>

            {domains.map((d) => {
              const domainStmts = statements.filter((s) => s.domain_id === d.id);
              if (domainStmts.length === 0) return null;
              return (
                <DomainSection
                  key={d.id}
                  title={d.name}
                  icon={renderDomainIcon(d.icon)}
                  tone={d.color}
                  statements={domainStmts}
                  students={students}
                  responses={responses}
                  onTap={tap}
                />
              );
            })}
          </>
        )}

        {students.length > 0 && statements.length > 0 && (
          <div className="mt-5 flex items-center justify-between gap-3">
            {saved && <p className="text-sm font-bold text-[var(--sage-deep)] flex items-center gap-1.5"><CheckCircle2 size={16} /> Saved.</p>}
            <div className="flex gap-2 ml-auto">
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>Done</Button>
              <Button onClick={save} disabled={busy}><Save size={16} /> {busy ? 'Saving…' : 'Save checklist'}</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function DomainSection({ title, icon, tone, statements, students, responses, onTap }: {
  title: string;
  icon: React.ReactNode;
  tone: string;
  statements: ChecklistStatement[];
  students: { id: string; name: string; roll_number: string }[];
  responses: Record<string, CellValue | undefined>;
  onTap: (studentId: string, statementId: string) => void;
}) {
  if (statements.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: `${tone}1f`, color: tone }}>{icon}</span>
        <h3 className="font-extrabold text-[var(--ink)] text-sm">{title}</h3>
      </div>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left px-2 py-2 w-32 shrink-0 text-[11px] font-extrabold uppercase text-[var(--ink-soft)] sticky left-0 bg-white">Student</th>
              {statements.map((st) => (
                <th key={st.id} className="px-1 py-2 text-[11px] font-extrabold uppercase text-[var(--ink-soft)] text-center min-w-[90px] align-bottom">
                  <span className="leading-tight block">{st.statement_text}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-t border-[var(--line)]">
                <td className="px-2 py-2 sticky left-0 bg-white">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[var(--cream-deep)] flex items-center justify-center text-[10px] font-extrabold text-[var(--ink-soft)] shrink-0">{s.roll_number}</div>
                    <span className="font-bold text-[var(--ink)] text-xs truncate max-w-[80px]">{s.name}</span>
                  </div>
                </td>
                {statements.map((st) => {
                  const key = `${s.id}:${st.id}`;
                  const val = responses[key];
                  return (
                    <td key={st.id} className="px-1 py-1.5 text-center">
                      <button
                        onClick={() => onTap(s.id, st.id)}
                        className={`w-full min-h-[36px] rounded-lg border-2 text-xs font-extrabold transition-all ${val === undefined ? 'border-[var(--line)] bg-white text-[var(--ink-soft)] hover:border-[var(--terracotta)]' : RESPONSE_COLORS[val]}`}
                      >
                        {val === undefined ? '—' : RESPONSE_LABELS[val]}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
