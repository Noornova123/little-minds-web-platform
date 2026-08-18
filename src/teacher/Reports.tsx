import { useEffect, useState } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Printer, ArrowRight, Users, Library, Heart, Wrench, Brain, Target, ClipboardList, FileDown, Loader2, Layers, type LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import type { Activity, AttendanceRow, DailyCheckpoint, MonthlyCheck, Student, LibraryCompletion, ChecklistStatement, ChecklistResponse, ChecklistDomainRow, AnecdotalNote, ExamMark, Achievement, TeacherFeedback } from '@/lib/types';
import { renderDomainIcon } from '@/lib/domainIcons';
import { Card, Spinner, EmptyState, Badge } from '@/components/ui';
import { LineChart, BarChart } from '@/components/Charts';
import { useClassContext } from '@/teacher/useClassContext';
import { ClassSelector } from '@/teacher/ClassSelector';
import { QuickNoteButton, NotesList } from '@/teacher/QuickNote';
import { AchievementsSection } from '@/teacher/Achievements';
import { BulkReportGenerator } from '@/teacher/BulkReportGenerator';
import { loadReportData, groupFeedbackBySubject } from '@/lib/reportData';
import { generatePdfFromElement, reportFileName } from '@/lib/pdfGenerator';
import { PdfReportTemplate } from '@/components/PdfReportTemplate';

export function ClassReport() {
  const { school, classes, selectedClass, students, progress, loading, selectClass } = useClassContext();
  const [showBulk, setShowBulk] = useState(false);
  const [data, setData] = useState<{
    attendance: AttendanceRow[];
    checkpoints: DailyCheckpoint[];
    monthly: MonthlyCheck[];
    activities: Activity[];
    libraryCompletions: LibraryCompletion[];
    checklistResp: ChecklistResponse[];
    statements: ChecklistStatement[];
    domains: ChecklistDomainRow[];
  } | null>(null);

  const daysUnlocked = school?.days_unlocked_up_to ?? 0;
  const currentDay = progress?.current_day ?? 0;

  useEffect(() => {
    if (!selectedClass) return;
    let active = true;
    (async () => {
      const studentIds = students.map((s) => s.id);
      if (studentIds.length === 0) {
        setData({ attendance: [], checkpoints: [], monthly: [], activities: [], libraryCompletions: [], checklistResp: [], statements: [], domains: [] });
        return;
      }
      const [att, cp, mc, acts, lc, cr, stmts, doms] = await Promise.all([
        supabase.from('attendance').select('*').in('student_id', studentIds),
        supabase.from('daily_checkpoints').select('*').in('student_id', studentIds),
        supabase.from('monthly_checks').select('*').in('student_id', studentIds),
        supabase.from('activities').select('*').order('day_number'),
        selectedClass ? supabase.from('library_completions').select('*').eq('class_id', selectedClass.id) : Promise.resolve({ data: [], error: null }),
        supabase.from('checklist_responses').select('*').in('student_id', studentIds),
        supabase.from('checklist_statements').select('*'),
        supabase.from('checklist_domains').select('*').order('display_order'),
      ]);
      if (!active) return;
      setData({
        attendance: (att.data as AttendanceRow[]) ?? [],
        checkpoints: (cp.data as DailyCheckpoint[]) ?? [],
        monthly: (mc.data as MonthlyCheck[]) ?? [],
        activities: (acts.data as Activity[]) ?? [],
        libraryCompletions: (lc.data as LibraryCompletion[]) ?? [],
        checklistResp: (cr.data as ChecklistResponse[]) ?? [],
        statements: (stmts.data as ChecklistStatement[]) ?? [],
        domains: (doms.data as ChecklistDomainRow[]) ?? [],
      });
    })();
    return () => { active = false; };
  }, [selectedClass, students]);

  if (loading || !data) return <Spinner label="Loading reports…" />;

  const completionPct = daysUnlocked > 0 ? Math.round((currentDay / daysUnlocked) * 100) : 0;
  const attPct = data.attendance.length > 0
    ? Math.round((data.attendance.filter((a) => a.status === 'present').length / data.attendance.length) * 100)
    : 0;

  const validScores = data.monthly.filter((m) => m.focus_score != null || m.brain_score != null);
  const avgAcademic = (() => {
    const vals: number[] = [];
    for (const m of validScores) {
      if (m.focus_score != null) vals.push(m.focus_score);
      if (m.brain_score != null) vals.push(m.brain_score);
    }
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  })();

  const studentIds = students.map((s) => s.id);
  const domainScores = data.domains.map((d) => {
    const stmtIds = data.statements.filter((s) => s.domain_id === d.id).map((s) => s.id);
    const studentAvgs: number[] = [];
    for (const sid of studentIds) {
      const vals = data.checklistResp
        .filter((r) => r.student_id === sid && stmtIds.includes(r.statement_id))
        .map((r) => r.value);
      if (vals.length > 0) studentAvgs.push(Math.round((vals.reduce<number>((a, b) => a + b, 0) / vals.length / 2) * 100));
    }
    return { domain: d, avg: studentAvgs.length > 0 ? Math.round(studentAvgs.reduce((a, b) => a + b, 0) / studentAvgs.length) : null };
  });

  return (
    <div className="space-y-5 lm-fade-up">
      <ClassSelector classes={classes} selected={selectedClass} onSelect={selectClass} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Class Report</h1>
        {students.length > 0 && (
          <button onClick={() => setShowBulk(true)} className="lm-btn lm-btn-primary px-3 sm:px-4 py-2 text-sm">
            <Layers size={16} /> <span className="hidden sm:inline">Generate All</span><span className="sm:hidden">All Reports</span>
          </button>
        )}
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-extrabold text-[var(--ink)]">{selectedClass?.name}</h2>
          <Badge tone="neutral">{students.length} students</Badge>
        </div>
        <div className={`grid gap-4 ${data.domains.length <= 2 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
          <SummaryStat label="Academic Focus" value={avgAcademic === null ? '—' : String(avgAcademic)} sub="avg score" tone="var(--terracotta)" icon={<Target size={15} />} />
          {domainScores.map(({ domain, avg }) => (
            <SummaryStat key={domain.id} label={domain.name} value={avg === null ? '—' : String(avg)} sub="avg score" tone={domain.color} icon={renderDomainIcon(domain.icon, 15)} />
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <SummaryStat label="Completion" value={`${completionPct}%`} sub={`${currentDay}/${daysUnlocked} days`} tone="var(--terracotta)" />
          <SummaryStat label="Attendance" value={`${attPct}%`} sub={`${data.attendance.length} records`} tone="var(--sage-deep)" />
        </div>
        {validScores.length === 0 && data.checklistResp.length === 0 && (
          <p className="text-sm text-[var(--ink-soft)] mt-4">No monthly data yet — averages will appear here once you run a monthly checklist or enter monthly scores.</p>
        )}
      </Card>

      <LibraryEngagement completions={data.libraryCompletions} activities={data.activities.filter((a) => a.content_type === 'library')} />

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users size={18} className="text-[var(--ink-soft)]" />
          <h3 className="font-extrabold text-[var(--ink)]">Per-student reports</h3>
        </div>
        {students.length === 0 ? <EmptyState title="No students" /> : (
          <div className="divide-y divide-[var(--line)]">
            {students.map((s) => {
              const sAtt = data.attendance.filter((a) => a.student_id === s.id);
              const sCp = data.checkpoints.filter((c) => c.student_id === s.id);
              const sResp = data.checklistResp.filter((r) => r.student_id === s.id);
              const studentAttPct = sAtt.length > 0 ? Math.round((sAtt.filter((a) => a.status === 'present').length / sAtt.length) * 100) : null;
              const studentCpAcc = sCp.length > 0 ? Math.round((sCp.filter((c) => c.answer_correct).length / sCp.length) * 100) : null;
              const sDomainScores = data.domains.map((d) => {
                const stmtIds = data.statements.filter((st) => st.domain_id === d.id).map((st) => st.id);
                const vals = sResp.filter((r) => stmtIds.includes(r.statement_id)).map((r) => r.value);
                if (vals.length === 0) return { domain: d, score: null };
                return { domain: d, score: Math.round((vals.reduce<number>((a, b) => a + b, 0) / vals.length / 2) * 100) };
              });
              return (
                <button key={s.id} onClick={() => navigate(`/dashboard/reports/${s.id}`)} className="w-full flex items-center gap-3 py-3 text-left hover:bg-[var(--cream-deep)] -mx-2 px-2 rounded-xl transition-colors">
                  <div className="w-9 h-9 rounded-full bg-[var(--cream-deep)] flex items-center justify-center text-xs font-extrabold text-[var(--ink-soft)] shrink-0">{s.roll_number}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[var(--ink)] truncate">{s.name}</p>
                    <p className="text-xs text-[var(--ink-soft)]">
                      {studentAttPct !== null ? `Attendance ${studentAttPct}%` : 'No attendance'} · {studentCpAcc !== null ? `Accuracy ${studentCpAcc}%` : 'No checkpoints'}
                      {sDomainScores.map((ds) => ds.score !== null && ` · ${ds.domain.name.slice(0, 2)} ${ds.score}`).filter(Boolean).join('')}
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-[var(--ink-soft)]" />
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {showBulk && (
        <BulkReportGenerator students={students} school={school} classRow={selectedClass} onClose={() => setShowBulk(false)} />
      )}
    </div>
  );
}

// Compute a domain score for a single student from responses + statements.
function scoreDomainForStudent(
  domain: ChecklistDomainRow,
  statements: ChecklistStatement[],
  responses: ChecklistResponse[],
  monthFilter: string | null,
): number | null {
  const stmtIds = statements.filter((s) => s.domain_id === domain.id).map((s) => s.id);
  const vals = responses
    .filter((r) => (monthFilter ? r.month === monthFilter : true) && stmtIds.includes(r.statement_id))
    .map((r) => r.value);
  if (vals.length === 0) return null;
  const avg = vals.reduce<number>((a, b) => a + b, 0) / vals.length;
  return Math.round((avg / 2) * 100);
}

// ──────────────── Per-student report ────────────────

export function StudentReport({ studentId }: { studentId: string }) {
  const { school, selectedClass, classes, selectClass, loading } = useClassContext();
  const [student, setStudent] = useState<Student | null>(null);
  const [att, setAtt] = useState<AttendanceRow[]>([]);
  const [cp, setCp] = useState<DailyCheckpoint[]>([]);
  const [mc, setMc] = useState<MonthlyCheck[]>([]);
  const [statements, setStatements] = useState<ChecklistStatement[]>([]);
  const [responses, setResponses] = useState<ChecklistResponse[]>([]);
  const [domains, setDomains] = useState<ChecklistDomainRow[]>([]);
  const [notes, setNotes] = useState<AnecdotalNote[]>([]);
  const [marks, setMarks] = useState<ExamMark[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [teacherFeedback, setTeacherFeedback] = useState<TeacherFeedback[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  async function loadNotes() {
    const { data } = await supabase.from('anecdotal_notes').select('*').eq('student_id', studentId).order('date', { ascending: false });
    setNotes((data as AnecdotalNote[]) ?? []);
  }

  async function loadAchievements() {
    const { data } = await supabase.from('achievements').select('*').eq('student_id', studentId).order('achievement_date', { ascending: false });
    setAchievements((data as Achievement[]) ?? []);
  }

  async function generatePdf() {
    setPdfLoading(true);
    try {
      const reportData = await loadReportData(studentId);
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.zIndex = '-1';
      document.body.appendChild(container);

      const { createRoot } = await import('react-dom/client');
      const root = createRoot(container);
      const { createElement } = await import('react');
      root.render(createElement(PdfReportTemplate, { data: reportData }));

      await new Promise((r) => setTimeout(r, 600));
      const el = container.querySelector('#pdf-report-root') as HTMLElement;
      if (!el) throw new Error('Template render failed');
      await generatePdfFromElement(el, reportFileName(reportData));

      root.unmount();
      document.body.removeChild(container);
    } catch (e) {
      console.error('PDF generation failed:', e);
      alert('Could not generate the PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      setDataLoading(true);
      const { data: st } = await supabase.from('students').select('*').eq('id', studentId).maybeSingle();
      if (!active) return;
      setStudent(st as Student | null);
      if (!st) { setDataLoading(false); return; }
      const [a, c, m, stmts, resp, nts, doms, mk, ach, fb] = await Promise.all([
        supabase.from('attendance').select('*').eq('student_id', studentId).order('date'),
        supabase.from('daily_checkpoints').select('*').eq('student_id', studentId).order('date'),
        supabase.from('monthly_checks').select('*').eq('student_id', studentId).order('month'),
        supabase.from('checklist_statements').select('*'),
        supabase.from('checklist_responses').select('*').eq('student_id', studentId).order('month'),
        supabase.from('anecdotal_notes').select('*').eq('student_id', studentId).order('date', { ascending: false }),
        supabase.from('checklist_domains').select('*').order('display_order'),
        supabase.from('exam_marks').select('*').eq('student_id', studentId).order('academic_year', { ascending: false }),
        supabase.from('achievements').select('*').eq('student_id', studentId).order('achievement_date', { ascending: false }),
        supabase.from('teacher_feedback').select('*, teacher:teachers(name)').eq('student_id', studentId).order('month', { ascending: true }),
      ]);
      if (!active) return;
      setAtt((a.data as AttendanceRow[]) ?? []);
      setCp((c.data as DailyCheckpoint[]) ?? []);
      setMc((m.data as MonthlyCheck[]) ?? []);
      setStatements((stmts.data as ChecklistStatement[]) ?? []);
      setResponses((resp.data as ChecklistResponse[]) ?? []);
      setNotes((nts.data as AnecdotalNote[]) ?? []);
      setDomains((doms.data as ChecklistDomainRow[]) ?? []);
      setMarks((mk.data as ExamMark[]) ?? []);
      setAchievements((ach.data as Achievement[]) ?? []);
      setTeacherFeedback((fb.data as TeacherFeedback[]) ?? []);
      setDataLoading(false);
    })();
    return () => { active = false; };
  }, [studentId]);

  if (loading || dataLoading) return <Spinner label="Loading student report…" />;
  if (!student) return <Card><EmptyState title="Student not found" /></Card>;

  const last30 = cp.slice(-30);
  const cpLabels = last30.map((c) => c.date.slice(5));
  const cpSeries = [{ label: 'Accuracy', color: 'var(--terracotta)', values: last30.map((c) => (c.answer_correct ? 100 : 0)) }];

  const mcSorted = [...mc].sort((a, b) => a.month.localeCompare(b.month));
  const mcLabels = mcSorted.map((m) => m.month.slice(5, 7) + '/' + m.month.slice(2, 4));
  const mcSeries = [
    { label: 'Focus', color: 'var(--terracotta)', values: mcSorted.map((m) => m.focus_score) },
    { label: 'Brain', color: 'var(--sky)', values: mcSorted.map((m) => m.brain_score) },
  ];

  const monthsWithResp = [...new Set(responses.map((r) => r.month))].sort();
  const domainLabels = monthsWithResp.map((m) => m.slice(5, 7) + '/' + m.slice(2, 4));

  const domainSeries = domains.map((d) => ({
    label: d.name,
    color: d.color,
    values: monthsWithResp.map((m) => scoreDomainForStudent(d, statements, responses, m)),
  }));

  const attPct = att.length > 0 ? Math.round((att.filter((a) => a.status === 'present').length / att.length) * 100) : null;
  const cpAcc = cp.length > 0 ? Math.round((cp.filter((c) => c.answer_correct).length / cp.length) * 100) : null;

  const acNotes = notes.filter((n) => n.tagged_domain === 'academic');

  const latestMonth = monthsWithResp[monthsWithResp.length - 1];

  return (
    <div className="space-y-5 lm-fade-up">
      <div className="flex items-center justify-between no-print flex-wrap gap-2">
        <button onClick={() => navigate('/dashboard/reports')} className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ink-soft)] hover:text-[var(--terracotta)]">
          <ArrowLeft size={16} /> Class report
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => window.print()} className="lm-btn lm-btn-ghost px-3 sm:px-4 py-2 text-sm"><Printer size={16} /> <span className="hidden sm:inline">Print / PDF</span></button>
          <button onClick={generatePdf} disabled={pdfLoading} className="lm-btn lm-btn-primary px-3 sm:px-4 py-2 text-sm" style={{ opacity: pdfLoading ? 0.7 : 1 }}>
            {pdfLoading ? <><Loader2 size={16} className="animate-spin" /> Generating…</> : <><FileDown size={16} /> Generate Report</>}
          </button>
        </div>
      </div>

      <ClassSelector classes={classes} selected={selectedClass} onSelect={selectClass} />

      <Card className="p-6 sm:p-8 print-page">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-6 border-b border-[var(--line)] flex-wrap gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>{student.name}</h1>
              <QuickNoteButton studentId={student.id} studentName={student.name} />
            </div>
            <p className="text-sm text-[var(--ink-soft)] mt-1">Roll no. {student.roll_number} · {selectedClass?.name} · {school?.name}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1.5 text-[var(--terracotta)] font-extrabold text-sm justify-end">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--terracotta)]" /> Little Minds
            </div>
            <p className="text-xs text-[var(--ink-soft)] mt-1">{new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
          <StatBox label="Attendance" value={attPct === null ? '—' : `${attPct}%`} tone="var(--sage-deep)" />
          <StatBox label="Checkpoint accuracy" value={cpAcc === null ? '—' : `${cpAcc}%`} tone="var(--terracotta)" />
          <StatBox label="Activities done" value={String(cp.length)} tone="var(--sky)" />
          <StatBox label="Achievements" value={String(achievements.length)} tone="var(--amber)" />
        </div>

        {/* Academic section */}
        <DomainSection
          title="Academic Focus"
          icon={<Target size={18} />}
          tone="var(--terracotta)"
          bgTone="var(--coral-soft)"
          score={cpAcc}
          scoreLabel="Checkpoint accuracy"
          insight={academicInsight(cp)}
          notes={acNotes}
          chart={last30.length > 0 ? <LineChart labels={cpLabels} series={cpSeries} yMax={100} formatY={(v) => `${v}%`} /> : null}
          chartTitle={last30.length > 0 ? `Daily checkpoint accuracy (last ${last30.length} sessions)` : null}
          showNotesDelete
          onNotesChange={loadNotes}
        />

        {mcSorted.length > 0 && (
          <div className="mb-6">
            <h3 className="font-extrabold text-[var(--ink)] mb-2">Monthly focus &amp; brain scores</h3>
            <LineChart labels={mcLabels} series={mcSeries} yMax={100} formatY={(v) => `${Math.round(v)}`} />
          </div>
        )}

        {/* Dynamic domain sections */}
        {domains.map((d, i) => {
          const perMonth = monthsWithResp.map((m) => scoreDomainForStudent(d, statements, responses, m));
          const latestScore = latestMonth ? scoreDomainForStudent(d, statements, responses, latestMonth) : null;
          const dNotes = notes.filter((n) => {
            const legacy = d.name === 'Social-Emotional' ? 'social_emotional' : d.name === 'Life Skills' ? 'life_skills' : null;
            return legacy && n.tagged_domain === legacy;
          });
          return (
            <DomainSection
              key={d.id}
              title={d.name}
              icon={renderDomainIcon(d.icon, 18)}
              tone={d.color}
              bgTone={`${d.color}1f`}
              score={latestScore}
              scoreLabel="This month's score"
              insight={domainInsight(d.name, perMonth)}
              notes={dNotes}
              chart={domainLabels.length > 0 ? <LineChart labels={domainLabels} series={[domainSeries[i]]} yMax={100} formatY={(v) => `${Math.round(v)}`} /> : null}
              chartTitle={domainLabels.length > 0 ? `${d.name} score over time` : null}
              showNotesDelete
              onNotesChange={loadNotes}
            />
          );
        })}

        {/* Attendance bars */}
        {att.length > 0 && (
          <div className="mb-6">
            <h3 className="font-extrabold text-[var(--ink)] mb-2">Recent attendance (present = 100, absent = 0)</h3>
            <BarChart
              bars={att.slice(-14).map((a) => ({ label: a.date.slice(5), value: a.status === 'present' ? 100 : 0, color: a.status === 'present' ? 'var(--sage)' : '#dc2626' }))}
              yMax={100}
              formatY={(v) => `${v}`}
            />
          </div>
        )}

        {/* Academic marks summary */}
        {marks.length > 0 && <MarksSummary marks={marks} />}

        {/* Achievements */}
        <div className="mb-6 no-print">
          <AchievementsSection studentId={student.id} studentName={student.name} achievements={achievements} onReload={loadAchievements} />
        </div>

        {/* Subject teacher feedback */}
        {teacherFeedback.length > 0 && (
          <div className="mb-6">
            <h3 className="font-extrabold text-[var(--ink)] mb-3">Subject teacher feedback</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groupFeedbackBySubject(teacherFeedback).map(({ subject, entries }) => (
                <div key={subject} className="rounded-xl bg-[var(--cream-deep)] p-3">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--terracotta)] mb-2">{subject}</p>
                  <div className="space-y-2">
                    {entries.map((f) => (
                      <div key={f.id}>
                        <p className="text-[11px] font-bold text-[var(--ink-soft)]">
                          {new Date(f.month + '-01').toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} · {f.teacher?.name ?? 'Teacher'}
                        </p>
                        <p className="text-sm font-semibold text-[var(--ink)]">{f.feedback_text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {cp.length === 0 && att.length === 0 && mcSorted.length === 0 && responses.length === 0 && marks.length === 0 && (
          <EmptyState title="No data yet" hint="This student's growth charts will appear once attendance, checkpoints, or the monthly checklist are recorded." />
        )}

        <p className="text-xs text-[var(--ink-soft)] text-center mt-8 pt-4 border-t border-[var(--line)]">
          This report supports your child's growth across academic focus, social-emotional wellbeing, and life skills. It is observational and supportive — not a clinical assessment.
        </p>
      </Card>
    </div>
  );
}

function DomainSection({ title, icon, tone, bgTone, score, scoreLabel, insight, notes, chart, chartTitle, showNotesDelete, onNotesChange }: {
  title: string;
  icon: React.ReactNode;
  tone: string;
  bgTone: string;
  score: number | null;
  scoreLabel: string;
  insight: string;
  notes: AnecdotalNote[];
  chart: React.ReactNode;
  chartTitle: string | null;
  showNotesDelete?: boolean;
  onNotesChange?: () => void;
}) {
  return (
    <div className="rounded-2xl p-4 mb-6" style={{ background: bgTone }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: tone }}>{icon}</span>
        <h3 className="font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>{title}</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
        <div className="rounded-xl bg-white/60 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">{scoreLabel}</p>
          <p className="text-2xl font-extrabold mt-1" style={{ color: tone }}>{score === null ? '—' : score}</p>
        </div>
        <div className="rounded-xl bg-white/60 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">Observation</p>
          <p className="text-sm font-semibold text-[var(--ink)] mt-1 leading-relaxed">{insight}</p>
        </div>
      </div>

      {chartTitle && chart && (
        <div className="mb-3">
          <h4 className="text-sm font-bold text-[var(--ink)] mb-2">{chartTitle}</h4>
          {chart}
        </div>
      )}

      {notes.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-[var(--ink)] mb-2">Teacher observations</h4>
          <NotesList notes={notes} onDelete={showNotesDelete ? onNotesChange : undefined} />
        </div>
      )}
    </div>
  );
}

// ──────────────── Helper functions ────────────────

function SummaryStat({ label, value, sub, tone, icon }: { label: string; value: string; sub: string; tone: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[var(--cream-deep)] p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)] flex items-center gap-1.5">{icon}{label}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <p className="text-2xl font-extrabold" style={{ color: tone }}>{value}</p>
        <p className="text-xs text-[var(--ink-soft)]">{sub}</p>
      </div>
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl bg-[var(--cream-deep)] p-3 text-center">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">{label}</p>
      <p className="text-xl font-extrabold mt-1" style={{ color: tone }}>{value}</p>
    </div>
  );
}

function LibraryEngagement({ completions, activities }: { completions: LibraryCompletion[]; activities: Activity[] }) {
  const now = new Date();
  const monthStart = now.toISOString().slice(0, 7);
  const thisMonth = completions.filter((c) => c.date.startsWith(monthStart));
  const activityIdsThisMonth = new Set(thisMonth.map((c) => c.activity_id));
  const byCat: Record<string, { count: number; title: string }> = {};
  activities.forEach((a) => {
    if (activityIdsThisMonth.has(a.id)) {
      const cat = a.category || 'Other';
      if (!byCat[cat]) byCat[cat] = { count: 0, title: a.title };
      byCat[cat].count += 1;
    }
  });
  const cats = Object.entries(byCat);
  const totalSessions = new Set(thisMonth.map((c) => c.activity_id)).size;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Library size={18} className="text-[var(--terracotta)]" />
        <h3 className="font-extrabold text-[var(--ink)]">Library engagement this month</h3>
      </div>
      {totalSessions === 0 ? (
        <p className="text-sm text-[var(--ink-soft)]">No library activities run yet this month. Extra activities from the Content Library show up here.</p>
      ) : (
        <>
          <p className="text-sm text-[var(--ink-soft)] mb-3">{totalSessions} library {totalSessions === 1 ? 'activity' : 'activities'} run this month.</p>
          <div className="flex flex-wrap gap-2">
            {cats.map(([cat, info]) => (
              <div key={cat} className="rounded-xl bg-[var(--cream-deep)] px-3 py-2">
                <p className="text-xs font-bold text-[var(--ink-soft)]">{cat}</p>
                <p className="font-extrabold text-[var(--ink)] text-sm">{info.count} done</p>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function academicInsight(cp: DailyCheckpoint[]): string {
  if (cp.length === 0) return 'Just getting started — daily activities will show progress here soon.';
  const acc = Math.round((cp.filter((c) => c.answer_correct).length / cp.length) * 100);
  if (acc >= 80) return `Engaging confidently with daily activities (${acc}% accuracy).`;
  if (acc >= 50) return `Engaging well with daily activities (${acc}% accuracy) — steady progress.`;
  return `Building engagement with daily activities (${acc}% accuracy).`;
}

function domainInsight(domainName: string, perMonth: (number | null)[]): string {
  const vals = perMonth.filter((v): v is number => v !== null);
  if (vals.length === 0) return `No ${domainName.toLowerCase()} checklist completed yet — the monthly checklist will fill this in.`;
  if (vals.length === 1) return `First ${domainName.toLowerCase()} check-in recorded at ${vals[0]}.`;
  const latest = vals[vals.length - 1];
  const prev = vals[vals.length - 2];
  const diff = latest - prev;
  if (diff >= 5) return `Showing nice growth in ${domainName.toLowerCase()} this month (+${diff}).`;
  if (diff <= -5) return `${domainName} is an area to keep nurturing gently (−${Math.abs(diff)}).`;
  return `${domainName} holding steady at ${latest}.`;
}

function markBadge(pct: number): { label: string; bg: string; color: string } {
  if (pct >= 75) return { label: 'Excellent', bg: '#f0fdf4', color: 'var(--sage-deep)' };
  if (pct >= 40) return { label: 'Good', bg: 'var(--sunny-soft)', color: 'var(--amber)' };
  return { label: 'Pass', bg: '#eff6ff', color: 'var(--sky)' };
}

function MarksSummary({ marks }: { marks: ExamMark[] }) {
  const byExamYear: Record<string, ExamMark[]> = {};
  for (const m of marks) {
    const key = `${m.exam_name} · ${m.academic_year}`;
    if (!byExamYear[key]) byExamYear[key] = [];
    byExamYear[key].push(m);
  }
  const groups = Object.entries(byExamYear).sort(([a], [b]) => b.localeCompare(a));

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList size={18} className="text-[var(--terracotta)]" />
        <h3 className="font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Academic Marks</h3>
      </div>
      <div className="space-y-4">
        {groups.map(([label, rows]) => {
          const totalObtained = rows.reduce<number>((a, m) => a + Number(m.marks_obtained), 0);
          const totalMax = rows.reduce<number>((a, m) => a + Number(m.total_marks), 0);
          const overallPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
          const badge = markBadge(overallPct);
          return (
            <div key={label} className="rounded-2xl border border-[var(--line)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--cream-deep)]">
                <p className="font-extrabold text-[var(--ink)] text-sm">{label}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--ink-soft)]">{totalObtained} / {totalMax}</span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>{badge.label} · {overallPct}%</span>
                </div>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {rows.map((m) => {
                    const pct = Number(m.total_marks) > 0 ? Math.round((Number(m.marks_obtained) / Number(m.total_marks)) * 100) : 0;
                    const b = markBadge(pct);
                    return (
                      <tr key={m.id} className="border-t border-[var(--line)]">
                        <td className="px-4 py-2 font-bold text-[var(--ink)]">{m.subject}</td>
                        <td className="px-4 py-2 text-right font-bold text-[var(--ink-soft)] tabular-nums">{Number(m.marks_obtained)} / {Number(m.total_marks)}</td>
                        <td className="px-4 py-2 text-right w-24">
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: b.bg, color: b.color }}>{b.label}</span>
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
    </div>
  );
}
