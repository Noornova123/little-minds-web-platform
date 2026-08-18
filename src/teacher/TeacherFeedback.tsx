import { useEffect, useMemo, useState } from 'react';
import { MessageSquarePlus, Loader2, Trash2, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { AcademicSubject, Student, TeacherFeedback as Feedback } from '@/lib/types';
import { Card, Button, Spinner, EmptyState, Badge } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/Modal';
import { useClassContext } from '@/teacher/useClassContext';
import { ClassSelector } from '@/teacher/ClassSelector';

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

// Last 12 months, most recent first, for the month picker.
function lastMonths(n = 12): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 7));
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

export function TeacherFeedback() {
  const { teacher } = useAuth();
  const { classes, selectedClass, students, loading, selectClass } = useClassContext();
  const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
  const [feedbackByStudent, setFeedbackByStudent] = useState<Record<string, Feedback[]>>({});
  const [fbLoading, setFbLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [openFor, setOpenFor] = useState<Student | null>(null);
  const [editing, setEditing] = useState<Feedback | null>(null);
  const [subject, setSubject] = useState('');
  const [month, setMonth] = useState(currentMonth());
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Feedback | null>(null);

  useEffect(() => {
    if (!teacher) return;
    supabase.from('academic_subjects').select('*').eq('school_id', teacher.school_id).order('display_order').then(({ data }) => {
      setSubjects((data as AcademicSubject[]) ?? []);
    });
  }, [teacher]);

  async function loadFeedback() {
    if (students.length === 0) { setFeedbackByStudent({}); setFbLoading(false); return; }
    setFbLoading(true);
    const { data } = await supabase
      .from('teacher_feedback')
      .select('*, teacher:teachers(name)')
      .in('student_id', students.map((s) => s.id))
      .order('month', { ascending: false });
    const map: Record<string, Feedback[]> = {};
    for (const row of (data as Feedback[]) ?? []) {
      (map[row.student_id] ??= []).push(row);
    }
    setFeedbackByStudent(map);
    setFbLoading(false);
  }

  useEffect(() => { loadFeedback(); }, [students]);

  function openAdd(student: Student) {
    setOpenFor(student);
    setEditing(null);
    setSubject(subjects[0]?.name ?? '');
    setMonth(currentMonth());
    setText('');
    setErr(null);
  }

  function openEdit(student: Student, fb: Feedback) {
    setOpenFor(student);
    setEditing(fb);
    setSubject(fb.subject);
    setMonth(fb.month);
    setText(fb.feedback_text);
    setErr(null);
  }

  async function save() {
    if (!openFor || !teacher || !subject || !text.trim()) return;
    setBusy(true); setErr(null);
    if (editing) {
      const { error } = await supabase.from('teacher_feedback')
        .update({ subject, month, feedback_text: text.trim() })
        .eq('id', editing.id);
      setBusy(false);
      if (error) { setErr(error.message); return; }
    } else {
      const { error } = await supabase.from('teacher_feedback').insert({
        student_id: openFor.id,
        teacher_id: teacher.id,
        subject,
        month,
        feedback_text: text.trim(),
      });
      setBusy(false);
      if (error) { setErr(error.message); return; }
    }
    setOpenFor(null);
    loadFeedback();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    await supabase.from('teacher_feedback').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    loadFeedback();
  }

  const months = useMemo(() => lastMonths(), []);

  if (loading) return <Spinner label="Loading class…" />;

  return (
    <div className="space-y-5 lm-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Feedback</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-0.5">Leave your subject's monthly notes for each student — they roll into the yearly report.</p>
        </div>
        <ClassSelector classes={classes} selected={selectedClass} onSelect={selectClass} />
      </div>

      {students.length === 0 ? (
        <Card><EmptyState icon={<MessageSquarePlus size={36} />} title="No students in this class yet" /></Card>
      ) : subjects.length === 0 ? (
        <Card className="p-5"><EmptyState title="No subjects set up yet" hint="Ask your admin to add subjects under Academic Marks so you can tag your feedback." /></Card>
      ) : (
        <div className="space-y-3">
          {students.map((s) => {
            const fbs = feedbackByStudent[s.id] ?? [];
            const isOpen = expanded === s.id;
            return (
              <Card key={s.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[var(--ink)]">{s.roll_number}. {s.name}</p>
                    <p className="text-xs text-[var(--ink-soft)]">{fbs.length} feedback entr{fbs.length === 1 ? 'y' : 'ies'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" onClick={() => openAdd(s)}><MessageSquarePlus size={14} /> <span className="hidden sm:inline">Add feedback</span></Button>
                    {fbs.length > 0 && (
                      <button onClick={() => setExpanded(isOpen ? null : s.id)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[var(--cream-deep)]">
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-[var(--line)] space-y-2">
                    {fbLoading ? <Spinner label="Loading…" /> : fbs.map((fb) => (
                      <div key={fb.id} className="flex items-start gap-2 rounded-xl bg-[var(--cream-deep)] p-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <Badge tone="focus">{fb.subject}</Badge>
                            <span className="text-xs font-bold text-[var(--ink-soft)]">{monthLabel(fb.month)}</span>
                            <span className="text-xs text-[var(--ink-soft)]">· {fb.teacher?.name ?? 'Teacher'}</span>
                          </div>
                          <p className="text-sm font-semibold text-[var(--ink)]">{fb.feedback_text}</p>
                        </div>
                        {fb.teacher_id === teacher?.id && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => openEdit(s, fb)} className="p-1.5 text-[var(--ink-soft)] hover:text-[var(--terracotta)]"><Pencil size={14} /></button>
                            <button onClick={() => setConfirmDelete(fb)} className="p-1.5 text-[var(--ink-soft)] hover:text-[#dc2626]"><Trash2 size={14} /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={!!openFor}
        onClose={() => setOpenFor(null)}
        title={editing ? `Edit feedback · ${openFor?.name}` : `Add feedback · ${openFor?.name}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpenFor(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !subject || !text.trim()}>
              {busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : editing ? 'Save changes' : 'Save feedback'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="lm-label block mb-1.5">Subject</span>
            <select className="lm-input" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {subjects.map((sub) => <option key={sub.id} value={sub.name}>{sub.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="lm-label block mb-1.5">Month</span>
            <select className="lm-input" value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="lm-label block mb-1.5">Your insight for this month</span>
            <textarea
              className="lm-input h-28"
              placeholder="e.g. Doing well with fractions, needs more practice with word problems…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
            />
            <span className="text-xs text-[var(--ink-soft)] mt-1 block">{text.length}/500</span>
          </label>
          {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Delete feedback?"
        message={confirmDelete ? `Delete your ${confirmDelete.subject} feedback for ${monthLabel(confirmDelete.month)}? This cannot be undone.` : ''}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
