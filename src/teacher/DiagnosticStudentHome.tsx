import { useEffect, useState } from 'react';
import { ArrowLeft, Stethoscope, Play, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import type { Student, ClassRow, DiagnosticSubject, EducationBoard, DiagnosticAttempt } from '@/lib/types';
import { Card, Button, Spinner, EmptyState, Badge } from '@/components/ui';

export function DiagnosticStudentHome({ studentId }: { studentId: string }) {
  const [student, setStudent] = useState<Student | null>(null);
  const [classRow, setClassRow] = useState<ClassRow | null>(null);
  const [subjects, setSubjects] = useState<DiagnosticSubject[]>([]);
  const [boards, setBoards] = useState<EducationBoard[]>([]);
  const [attempts, setAttempts] = useState<(DiagnosticAttempt & { subject_name: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [subjectId, setSubjectId] = useState('');
  const [board, setBoard] = useState('');
  const [starting, setStarting] = useState(false);
  const [startErr, setStartErr] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    const studentRes = await supabase.from('students').select('*').eq('id', studentId).maybeSingle();
    if (studentRes.error || !studentRes.data) { setErr(studentRes.error?.message ?? 'Student not found'); setLoading(false); return; }
    const s = studentRes.data as Student;
    setStudent(s);

    const [classRes, subRes, boardRes] = await Promise.all([
      supabase.from('classes').select('*').eq('id', s.class_id).maybeSingle(),
      supabase.from('diagnostic_subjects').select('*').order('display_order', { ascending: true }),
      supabase.from('education_boards').select('*').order('sort_order', { ascending: true }),
    ]);
    setClassRow(classRes.data as ClassRow | null);
    const subjectRows = (subRes.data as DiagnosticSubject[]) ?? [];
    setSubjects(subjectRows);
    const boardRows = (boardRes.data as EducationBoard[]) ?? [];
    setBoards(boardRows);
    setSubjectId((prev) => prev || subjectRows[0]?.id || '');
    setBoard((prev) => prev || boardRows[0]?.name || '');

    const attemptRes = await supabase
      .from('diagnostic_attempts')
      .select('*')
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });
    const attemptRows = (attemptRes.data as DiagnosticAttempt[]) ?? [];
    const subjectMap: Record<string, string> = {};
    subjectRows.forEach((sub) => { subjectMap[sub.id] = sub.name; });
    setAttempts(attemptRows.map((a) => ({ ...a, subject_name: subjectMap[a.subject_id] ?? 'Subject' })));

    setLoading(false);
  }

  useEffect(() => { load(); }, [studentId]);

  async function startScreening() {
    if (!classRow?.grade_level) { setStartErr('This class has no grade level set. Ask your admin to set it under Admin → Schools/Classes.'); return; }
    if (!subjectId) { setStartErr('Please select a subject.'); return; }
    if (!board) { setStartErr('Please select a board.'); return; }
    setStarting(true); setStartErr(null);

    // Verify there's actually content for this combination before creating the attempt.
    const topicRes = await supabase
      .from('diagnostic_topics')
      .select('id')
      .eq('subject_id', subjectId)
      .eq('grade_level', classRow.grade_level)
      .eq('board', board);
    const topicIds = (topicRes.data ?? []).map((t: any) => t.id);
    if (topicIds.length === 0) {
      setStarting(false);
      setStartErr(`No diagnostic content found for this subject, ${classRow.grade_level}, ${board}. Ask your admin to add topics under Admin → Diagnostics first.`);
      return;
    }
    const skillRes = await supabase.from('diagnostic_skills').select('id').in('topic_id', topicIds);
    const skillIds = (skillRes.data ?? []).map((s: any) => s.id);
    if (skillIds.length === 0) {
      setStarting(false);
      setStartErr('These topics have no skills added yet. Ask your admin to add skills first.');
      return;
    }
    const questionRes = await supabase.from('diagnostic_questions').select('id').in('skill_id', skillIds);
    if ((questionRes.data ?? []).length === 0) {
      setStarting(false);
      setStartErr('These skills have no questions added yet. Ask your admin to add questions first.');
      return;
    }

    const { data: attempt, error } = await supabase
      .from('diagnostic_attempts')
      .insert({ student_id: studentId, subject_id: subjectId, grade_level: classRow.grade_level, board, status: 'in_progress' })
      .select()
      .maybeSingle();
    setStarting(false);
    if (error || !attempt) { setStartErr(error?.message ?? 'Could not start screening.'); return; }
    navigate(`/dashboard/diagnostics/${studentId}/run/${attempt.id}`);
  }

  if (loading) return <Spinner label="Loading…" />;
  if (err) return <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>;

  return (
    <div className="space-y-5 lm-fade-up">
      <button onClick={() => navigate('/dashboard/diagnostics')} className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ink-soft)] hover:text-[var(--terracotta)]">
        <ArrowLeft size={16} /> All students
      </button>

      <div className="flex items-center gap-2 flex-wrap">
        <Stethoscope size={20} className="text-[var(--terracotta)]" />
        <h1 className="text-xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>{student?.name}</h1>
        {classRow?.grade_level && <Badge tone="neutral">{classRow.grade_level}</Badge>}
      </div>

      <Card className="p-5">
        <h2 className="font-extrabold text-[var(--ink)] mb-3">Start a new screening</h2>
        {subjects.length === 0 ? (
          <EmptyState title="No diagnostic subjects yet" hint="Ask your admin to add subjects under Admin → Diagnostics." />
        ) : boards.length === 0 ? (
          <EmptyState title="No boards set up yet" hint="Ask your admin to add boards under Admin → Boards." />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="lm-label block mb-1.5">Subject</span>
                <select className="lm-input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="lm-label block mb-1.5">Board</span>
                <select className="lm-input" value={board} onChange={(e) => setBoard(e.target.value)}>
                  {boards.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              </label>
            </div>
            {startErr && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{startErr}</p>}
            <Button onClick={startScreening} disabled={starting}>
              {starting ? <><Loader2 size={16} className="animate-spin" /> Preparing…</> : <><Play size={16} /> Start screening</>}
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-extrabold text-[var(--ink)] mb-3">Past screenings</h2>
        {attempts.length === 0 ? (
          <EmptyState title="No screenings yet" hint="Once completed, reports will show up here." />
        ) : (
          <div className="space-y-2">
            {attempts.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/dashboard/diagnostics/${studentId}/report/${a.id}`)}
                className="w-full flex items-center gap-3 rounded-2xl border border-[var(--line)] p-3 text-left hover:border-[var(--terracotta-soft)] hover:bg-[var(--coral-soft)] transition-colors"
              >
                <FileText size={16} className="text-[var(--terracotta)]" />
                <span className="flex-1 font-bold text-[var(--ink)]">{a.subject_name}</span>
                <span className="text-xs text-[var(--ink-soft)]">{a.completed_at ? new Date(a.completed_at).toLocaleDateString() : ''}</span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
