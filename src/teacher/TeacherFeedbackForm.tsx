import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Pencil, Trash2, Check, X as XIcon, MessageSquareText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { navigate } from '@/lib/router';
import type { AcademicSubject, Student, ClassRow, TeacherFeedback as Feedback } from '@/lib/types';
import { Card, Button, Spinner, EmptyState, Badge } from '@/components/ui';
import { ConfirmDialog } from '@/components/Modal';

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function monthLabelShort(m: string) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

// Last 12 months, most recent first.
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

export function TeacherFeedbackForm({ studentId }: { studentId: string }) {
  const { teacher } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [classRow, setClassRow] = useState<ClassRow | null>(null);
  const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(currentMonth());

  // draft text per subject for the currently selected month, keyed by subject name
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingSubject, setSavingSubject] = useState<string | null>(null);
  const [rowErr, setRowErr] = useState<Record<string, string>>({});

  // history row inline-edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [historyBusy, setHistoryBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Feedback | null>(null);

  async function load() {
    setLoading(true);
    const { data: st } = await supabase.from('students').select('*').eq('id', studentId).maybeSingle();
    setStudent(st as Student | null);
    if (st) {
      const { data: cls } = await supabase.from('classes').select('*').eq('id', (st as Student).class_id).maybeSingle();
      setClassRow(cls as ClassRow | null);
      if (cls && teacher) {
        const { data: subs } = await supabase.from('academic_subjects').select('*').eq('school_id', (cls as ClassRow).school_id).order('display_order');
        setSubjects((subs as AcademicSubject[]) ?? []);
      }
    }
    const { data: fb } = await supabase
      .from('teacher_feedback')
      .select('*, teacher:teachers(name)')
      .eq('student_id', studentId)
      .order('month', { ascending: false });
    setFeedback((fb as Feedback[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [studentId]);

  // Whenever the month changes, seed the draft textboxes from existing entries for that month.
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const f of feedback) {
      if (f.month === month && f.teacher_id === teacher?.id) next[f.subject] = f.feedback_text;
    }
    setDrafts(next);
    setRowErr({});
  }, [month, feedback, teacher?.id]);

  const months = useMemo(() => {
    const set = new Set(lastMonths());
    for (const f of feedback) set.add(f.month);
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [feedback]);

  // Existing entry (any teacher) for a given subject in the selected month.
  function entryFor(subject: string): Feedback | undefined {
    return feedback.find((f) => f.subject === subject && f.month === month);
  }

  async function saveRow(subject: string) {
    if (!teacher || !student) return;
    const text = (drafts[subject] ?? '').trim();
    if (!text) return;
    setSavingSubject(subject);
    setRowErr((p) => ({ ...p, [subject]: '' }));
    const existing = feedback.find((f) => f.subject === subject && f.month === month && f.teacher_id === teacher.id);
    const { error } = existing
      ? await supabase.from('teacher_feedback').update({ feedback_text: text }).eq('id', existing.id)
      : await supabase.from('teacher_feedback').insert({ student_id: student.id, teacher_id: teacher.id, subject, month, feedback_text: text });
    setSavingSubject(null);
    if (error) { setRowErr((p) => ({ ...p, [subject]: error.message })); return; }
    load();
  }

  function startEditHistory(f: Feedback) {
    setEditingId(f.id);
    setEditText(f.feedback_text);
  }

  async function saveHistoryEdit() {
    if (!editingId || !editText.trim()) return;
    setHistoryBusy(true);
    await supabase.from('teacher_feedback').update({ feedback_text: editText.trim() }).eq('id', editingId);
    setHistoryBusy(false);
    setEditingId(null);
    load();
  }

  async function doDeleteHistory() {
    if (!confirmDelete) return;
    await supabase.from('teacher_feedback').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    load();
  }

  if (loading) return <Spinner label="Loading student…" />;
  if (!student) return <Card><EmptyState title="Student not found" /></Card>;

  const history = [...feedback].sort((a, b) => b.month.localeCompare(a.month) || b.created_at.localeCompare(a.created_at));

  return (
    <div className="space-y-6 lm-fade-up max-w-4xl mx-auto">
      <button onClick={() => navigate('/dashboard/feedback')} className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ink-soft)] hover:text-[var(--terracotta)]">
        <ArrowLeft size={16} /> Back to class
      </button>

      <Card className="p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>{student.name}</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-0.5">Roll no. {student.roll_number}{classRow ? ` · ${classRow.name}` : ''} · {feedback.length} feedback entr{feedback.length === 1 ? 'y' : 'ies'} total</p>
        </div>
        <Badge tone="focus"><MessageSquareText size={12} className="inline mr-1" />Subject feedback</Badge>
      </Card>

      {subjects.length === 0 ? (
        <Card className="p-5"><EmptyState title="No subjects set up yet" hint="Ask your admin to add subjects under Academic Marks so you can tag your feedback." /></Card>
      ) : (
        <Card className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h2 className="font-extrabold text-[var(--ink)]">This month's feedback</h2>
            <label className="flex items-center gap-2">
              <span className="lm-label">Month</span>
              <select className="lm-input w-auto" value={month} onChange={(e) => setMonth(e.target.value)}>
                {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </label>
          </div>

          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-xs font-extrabold uppercase tracking-wide text-[var(--ink-soft)] border-b border-[var(--line)]">
                  <th className="py-2 pr-3 w-32">Subject</th>
                  <th className="py-2 pr-3">Feedback for {monthLabelShort(month)}</th>
                  <th className="py-2 pl-3 w-24 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {subjects.map((sub) => {
                  const existing = entryFor(sub.name);
                  const isOther = existing && existing.teacher_id !== teacher?.id;
                  return (
                    <tr key={sub.id} className="align-top">
                      <td className="py-3 pr-3 font-bold text-[var(--ink)]">{sub.name}</td>
                      <td className="py-3 pr-3">
                        {isOther ? (
                          <div className="rounded-lg bg-[var(--cream-deep)] px-3 py-2">
                            <p className="text-sm text-[var(--ink)]">{existing!.feedback_text}</p>
                            <p className="text-xs text-[var(--ink-soft)] mt-1">— {existing!.teacher?.name ?? 'Another teacher'}, already filled</p>
                          </div>
                        ) : (
                          <>
                            <textarea
                              className="lm-input h-20 text-sm"
                              placeholder={`e.g. Doing well in ${sub.name}, needs more practice with…`}
                              value={drafts[sub.name] ?? ''}
                              onChange={(e) => setDrafts((p) => ({ ...p, [sub.name]: e.target.value }))}
                              maxLength={500}
                            />
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[11px] text-[var(--ink-soft)]">{(drafts[sub.name] ?? '').length}/500</span>
                              {rowErr[sub.name] && <span className="text-[11px] font-semibold text-[#dc2626]">{rowErr[sub.name]}</span>}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        {!isOther && (
                          <Button
                            size="sm"
                            onClick={() => saveRow(sub.name)}
                            disabled={savingSubject === sub.name || !(drafts[sub.name] ?? '').trim()}
                          >
                            {savingSubject === sub.name ? <Loader2 size={14} className="animate-spin" /> : existing ? 'Update' : 'Save'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="font-extrabold text-[var(--ink)] mb-4">Full feedback history</h2>
        {history.length === 0 ? (
          <EmptyState title="No feedback yet" hint="Once you save feedback above, it'll show up here month by month." />
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-xs font-extrabold uppercase tracking-wide text-[var(--ink-soft)] border-b border-[var(--line)]">
                  <th className="py-2 pr-3 w-28">Month</th>
                  <th className="py-2 pr-3 w-28">Subject</th>
                  <th className="py-2 pr-3">Feedback</th>
                  <th className="py-2 pr-3 w-32">Teacher</th>
                  <th className="py-2 pl-3 w-20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {history.map((f) => {
                  const mine = f.teacher_id === teacher?.id;
                  const isEditing = editingId === f.id;
                  return (
                    <tr key={f.id} className="align-top">
                      <td className="py-3 pr-3 font-bold text-[var(--ink)] whitespace-nowrap">{monthLabelShort(f.month)}</td>
                      <td className="py-3 pr-3"><Badge tone="focus">{f.subject}</Badge></td>
                      <td className="py-3 pr-3">
                        {isEditing ? (
                          <textarea className="lm-input h-20 text-sm" value={editText} onChange={(e) => setEditText(e.target.value)} maxLength={500} autoFocus />
                        ) : (
                          <p className="text-[var(--ink)]">{f.feedback_text}</p>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-[var(--ink-soft)] whitespace-nowrap">{f.teacher?.name ?? 'Teacher'}</td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        {mine && (
                          isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={saveHistoryEdit} disabled={historyBusy} className="p-1.5 text-[var(--terracotta)] hover:opacity-70"><Check size={16} /></button>
                              <button onClick={() => setEditingId(null)} className="p-1.5 text-[var(--ink-soft)] hover:opacity-70"><XIcon size={16} /></button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => startEditHistory(f)} className="p-1.5 text-[var(--ink-soft)] hover:text-[var(--terracotta)]"><Pencil size={14} /></button>
                              <button onClick={() => setConfirmDelete(f)} className="p-1.5 text-[var(--ink-soft)] hover:text-[#dc2626]"><Trash2 size={14} /></button>
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDeleteHistory}
        title="Delete feedback?"
        message={confirmDelete ? `Delete your ${confirmDelete.subject} feedback for ${monthLabel(confirmDelete.month)}? This cannot be undone.` : ''}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
