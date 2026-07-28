import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, ClipboardList, Save, CheckCircle2, GraduationCap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import { useAuth } from '@/lib/auth';
import type { AcademicSubject, ExamName, ExamMark } from '@/lib/types';
import { Card, Button, Spinner, EmptyState } from '@/components/ui';
import { useClassContext } from '@/teacher/useClassContext';
import { ClassSelector } from '@/teacher/ClassSelector';

interface MarkCell {
  id?: string;
  obtained: string;
  total: string;
}

export function MarksEntry() {
  const { school, classes, selectedClass, students, loading, selectClass } = useClassContext();
  const { teacher } = useAuth();
  const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
  const [exams, setExams] = useState<ExamName[]>([]);
  const [examName, setExamName] = useState('');
  const [academicYear, setAcademicYear] = useState(() => {
    const y = new Date().getFullYear();
    return `${y}-${y + 1}`;
  });
  const [cells, setCells] = useState<Record<string, MarkCell>>({});
  const [existing, setExisting] = useState<Record<string, ExamMark>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [optsLoading, setOptsLoading] = useState(true);

  // Load subjects + exam names for the teacher's school.
  useEffect(() => {
    if (!teacher) return;
    let active = true;
    (async () => {
      setOptsLoading(true);
      const [s, e] = await Promise.all([
        supabase.from('academic_subjects').select('*').eq('school_id', teacher.school_id).order('display_order', { ascending: true }),
        supabase.from('exam_names').select('*').eq('school_id', teacher.school_id).order('display_order', { ascending: true }),
      ]);
      if (!active) return;
      setSubjects((s.data as AcademicSubject[]) ?? []);
      setExams((e.data as ExamName[]) ?? []);
      setOptsLoading(false);
    })();
    return () => { active = false; };
  }, [teacher]);

  // Load existing marks when class/exam/year changes.
  const loadMarks = useCallback(async () => {
    if (!selectedClass || students.length === 0 || !examName) { setDataLoading(false); return; }
    setDataLoading(true);
    const { data } = await supabase
      .from('exam_marks')
      .select('*')
      .in('student_id', students.map((s) => s.id))
      .eq('exam_name', examName)
      .eq('academic_year', academicYear);
    const map: Record<string, ExamMark> = {};
    (data as ExamMark[] | null)?.forEach((m) => {
      map[`${m.student_id}:${m.subject}`] = m;
    });
    setExisting(map);
    // Pre-fill cells from existing marks.
    const cellMap: Record<string, MarkCell> = {};
    for (const s of students) {
      for (const sub of subjects) {
        const key = `${s.id}:${sub.name}`;
        const ex = map[key];
        cellMap[key] = ex
          ? { id: ex.id, obtained: String(ex.marks_obtained), total: String(ex.total_marks) }
          : { obtained: '', total: '' };
      }
    }
    setCells(cellMap);
    setDataLoading(false);
  }, [selectedClass, students, examName, academicYear, subjects]);

  useEffect(() => { if (examName) loadMarks(); }, [loadMarks]);

  function setCell(studentId: string, subjectName: string, field: 'obtained' | 'total', value: string) {
    const key = `${studentId}:${subjectName}`;
    setCells((p) => ({ ...p, [key]: { ...p[key], [field]: value } }));
    setSaved(false);
  }

  // Quick-fill: set total for all empty cells to a given value.
  function fillAllTotals(value: string) {
    setCells((p) => {
      const copy = { ...p };
      for (const s of students) {
        for (const sub of subjects) {
          const key = `${s.id}:${sub.name}`;
          if (!copy[key] || copy[key].total === '') copy[key] = { ...copy[key], total: value };
        }
      }
      return copy;
    });
    setSaved(false);
  }

  async function save() {
    if (!selectedClass || !examName) return;
    setBusy(true);
    const toUpsert: { id?: string; student_id: string; exam_name: string; subject: string; marks_obtained: number; total_marks: number; academic_year: string }[] = [];
    for (const s of students) {
      for (const sub of subjects) {
        const key = `${s.id}:${sub.name}`;
        const cell = cells[key];
        if (!cell || cell.obtained === '') continue;
        const obtained = parseFloat(cell.obtained);
        const total = parseFloat(cell.total) || 100;
        if (isNaN(obtained) || obtained < 0 || obtained > total) continue;
        toUpsert.push({ id: cell.id, student_id: s.id, exam_name: examName, subject: sub.name, marks_obtained: obtained, total_marks: total, academic_year: academicYear });
      }
    }
    for (const r of toUpsert) {
      if (r.id) {
        await supabase.from('exam_marks').update({ marks_obtained: r.marks_obtained, total_marks: r.total_marks }).eq('id', r.id);
      } else {
        await supabase.from('exam_marks').insert({ student_id: r.student_id, exam_name: r.exam_name, subject: r.subject, marks_obtained: r.marks_obtained, total_marks: r.total_marks, academic_year: r.academic_year });
      }
    }
    setBusy(false);
    setSaved(true);
    loadMarks();
  }

  if (loading || optsLoading) return <Spinner label="Loading…" />;

  return (
    <div className="space-y-5 lm-fade-up">
      <button onClick={() => navigate('/dashboard')} className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ink-soft)] hover:text-[var(--terracotta)]">
        <ArrowLeft size={16} /> Class home
      </button>

      <ClassSelector classes={classes} selected={selectedClass} onSelect={selectClass} />

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList size={20} className="text-[var(--terracotta)]" />
          <h1 className="text-xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Marks Entry</h1>
        </div>
        <p className="text-sm text-[var(--ink-soft)] mb-4">Select an exam, then enter marks for each student across all subjects. Leave a cell blank to skip it.</p>

        {/* Exam config row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <label className="block">
            <span className="lm-label block mb-1.5">Exam</span>
            <select className="lm-input" value={examName} onChange={(e) => { setExamName(e.target.value); setSaved(false); }}>
              <option value="">— Select exam —</option>
              {exams.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="lm-label block mb-1.5">Academic year</span>
            <input className="lm-input" value={academicYear} onChange={(e) => { setAcademicYear(e.target.value); setSaved(false); }} placeholder="e.g. 2025-2026" />
          </label>
        </div>

        {exams.length === 0 || subjects.length === 0 ? (
          <EmptyState
            title={subjects.length === 0 && exams.length === 0 ? 'Subjects and exams not set up yet' : subjects.length === 0 ? 'No subjects yet' : 'No exam names yet'}
            hint={`Your admin needs to add ${subjects.length === 0 ? 'subjects' : 'exam names'} for ${school?.name ?? 'your school'} before you can enter marks. Let them know from the admin Academic Marks page.`}
          />
        ) : !examName ? (
          <EmptyState title="Select an exam to begin" hint="Choose an exam name above to load the marks grid." />
        ) : !selectedClass ? (
          <EmptyState title="Select a class" />
        ) : students.length === 0 ? (
          <EmptyState title="No students in this class" />
        ) : dataLoading ? <Spinner label="Loading marks…" /> : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-[var(--ink-soft)]">{students.length} students · {subjects.length} subjects</p>
              <button onClick={() => fillAllTotals('100')} className="text-xs font-bold text-[var(--terracotta)] hover:underline">Set all totals to 100</button>
            </div>

            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left px-2 py-2 w-36 shrink-0 text-[11px] font-extrabold uppercase text-[var(--ink-soft)] sticky left-0 bg-white">Student</th>
                    {subjects.map((sub) => (
                      <th key={sub.id} className="px-1 py-2 text-[11px] font-extrabold uppercase text-[var(--ink-soft)] text-center min-w-[110px] align-bottom">
                        <span className="leading-tight block">{sub.name}</span>
                        <span className="text-[9px] font-bold text-[var(--ink-soft)] opacity-70">obtained / total</span>
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
                          <span className="font-bold text-[var(--ink)] text-xs truncate max-w-[100px]">{s.name}</span>
                        </div>
                      </td>
                      {subjects.map((sub) => {
                        const key = `${s.id}:${sub.name}`;
                        const cell = cells[key] ?? { obtained: '', total: '' };
                        const ex = existing[key];
                        return (
                          <td key={sub.id} className="px-1 py-1.5">
                            <div className={`flex items-center gap-0.5 rounded-lg border-2 overflow-hidden ${cell.obtained !== '' ? 'border-[var(--terracotta-soft)] bg-[var(--coral-soft)]' : 'border-[var(--line)] bg-white'}`}>
                              <input
                                type="number"
                                inputMode="decimal"
                                value={cell.obtained}
                                onChange={(e) => setCell(s.id, sub.name, 'obtained', e.target.value)}
                                placeholder="—"
                                className="w-10 text-center text-xs font-bold py-1.5 bg-transparent outline-none text-[var(--ink)]"
                              />
                              <span className="text-[10px] text-[var(--ink-soft)]">/</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                value={cell.total}
                                onChange={(e) => setCell(s.id, sub.name, 'total', e.target.value)}
                                placeholder="100"
                                className="w-10 text-center text-xs font-bold py-1.5 bg-transparent outline-none text-[var(--ink-soft)]"
                              />
                            </div>
                            {ex && cell.obtained === '' && (
                              <p className="text-[9px] text-[var(--ink-soft)] mt-0.5 text-center">saved</p>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              {saved ? (
                <p className="text-sm font-bold text-[var(--sage-deep)] flex items-center gap-1.5"><CheckCircle2 size={16} /> Saved.</p>
              ) : (
                <p className="text-xs text-[var(--ink-soft)]">Cells turn coral when you've entered a value. Blank cells are skipped.</p>
              )}
              <Button onClick={save} disabled={busy}><Save size={16} /> {busy ? 'Saving…' : 'Save marks'}</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
