import { useEffect, useState } from 'react';
import { ArrowLeft, Check, X, ClipboardList, CheckCircle2, RotateCw, Library } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import type { Activity, QuizQuestion, DailyCheckpoint, LibraryCompletion } from '@/lib/types';
import { Card, Button, Spinner, EmptyState, Badge } from '@/components/ui';
import { useClassContext } from '@/teacher/useClassContext';
import { ClassSelector } from '@/teacher/ClassSelector';

// Checkpoint now takes an explicit activity ID. For daily_curriculum it logs
// to daily_checkpoints and advances class_progress when the activity is the
// next sequential day. For library it logs to library_completions and does
// NOT touch progress or unlocks.
export function DailyCheckpoint({ activityId }: { activityId: string }) {
  const { school, classes, selectedClass, students, progress, loading, selectClass, refresh } = useClassContext();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [quiz, setQuiz] = useState<QuizQuestion | null>(null);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [existing, setExisting] = useState<DailyCheckpoint[] | LibraryCompletion[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [actLoading, setActLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);
  const isLibrary = activity?.content_type === 'library';
  const daysUnlocked = school?.days_unlocked_up_to ?? 0;

  useEffect(() => {
    let active = true;
    (async () => {
      setActLoading(true);
      const { data: act } = await supabase.from('activities').select('*').eq('id', activityId).maybeSingle();
      if (!active) return;
      const a = act as Activity | null;
      setActivity(a);
      if (!a) { setActLoading(false); return; }

      if (a.content_type === 'library') {
        // Load existing library completions for this class + activity + date.
        if (selectedClass) {
          const { data: lc } = await supabase.from('library_completions').select('*').eq('class_id', selectedClass.id).eq('activity_id', a.id).eq('date', today);
          if (!active) return;
          const lcs = (lc as LibraryCompletion[] | null) ?? [];
          setExisting(lcs);
          const map: Record<string, boolean> = {};
          lcs.forEach((l) => { map[l.student_id] = true; });
          setAnswers(map);
          setDone(lcs.length > 0);
        }
      } else {
        let q: QuizQuestion | null = null;
        const { data: qs } = await supabase.from('quiz_questions').select('*').eq('activity_id', a.id).limit(1).maybeSingle();
        q = (qs as QuizQuestion | null) ?? null;
        if (!active) return;
        setQuiz(q);
        const { data: cp } = await supabase.from('daily_checkpoints').select('*').eq('activity_id', a.id).eq('date', today);
        if (!active) return;
        const cps = (cp as DailyCheckpoint[] | null) ?? [];
        setExisting(cps);
        const map: Record<string, boolean> = {};
        cps.forEach((c) => { if (c.student_id) map[c.student_id] = c.answer_correct; });
        setAnswers(map);
        setDone(cps.length > 0);
      }
      setActLoading(false);
    })();
    return () => { active = false; };
  }, [activityId, selectedClass, today]);

  function setAnswer(studentId: string, correct: boolean) {
    setAnswers((p) => ({ ...p, [studentId]: correct }));
    setDone(false);
  }

  async function submit() {
    if (!selectedClass || !activity) return;
    setBusy(true);

    if (isLibrary) {
      // Log library completions: one row per student marked done.
      await supabase.from('library_completions').delete().eq('class_id', selectedClass.id).eq('activity_id', activity.id).eq('date', today);
      const rows = students.filter((s) => answers[s.id]).map((s) => ({
        class_id: selectedClass.id,
        activity_id: activity.id,
        student_id: s.id,
        date: today,
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from('library_completions').insert(rows);
        if (error) { setBusy(false); alert(error.message); return; }
      }
      setBusy(false);
      setDone(true);
      refresh();
      return;
    }

    // Daily curriculum: log daily_checkpoints.
    await supabase.from('daily_checkpoints').delete().eq('activity_id', activity.id).eq('date', today);
    const rows = students.map((s) => ({
      student_id: s.id,
      activity_id: activity.id,
      date: today,
      quiz_question_id: quiz?.id ?? null,
      answer_correct: answers[s.id] ?? false,
    }));
    const { error } = await supabase.from('daily_checkpoints').insert(rows);
    if (error) { setBusy(false); alert(error.message); return; }

    // Advance class_progress ONLY if this activity is the next sequential day.
    const currentDay = progress?.current_day ?? 0;
    const nextDay = currentDay + 1;
    if (activity.day_number === nextDay) {
      const advanced = Math.min(nextDay, daysUnlocked);
      if (progress) {
        await supabase.from('class_progress').update({ current_day: advanced }).eq('id', progress.id);
      } else {
        await supabase.from('class_progress').insert({ class_id: selectedClass.id, current_day: advanced });
      }
    }
    setBusy(false);
    setDone(true);
    refresh();
  }

  if (loading || actLoading) return <Spinner label="Loading checkpoint…" />;

  const currentDay = progress?.current_day ?? 0;
  const isNextDay = !isLibrary && activity?.day_number === currentDay + 1;

  return (
    <div className="space-y-5 lm-fade-up">
      <button onClick={() => navigate(`/dashboard/activity/${activityId}`)} className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ink-soft)] hover:text-[var(--terracotta)]">
        <ArrowLeft size={16} /> Back to activity
      </button>

      <ClassSelector classes={classes} selected={selectedClass} onSelect={selectClass} />

      {!activity ? (
        <Card><EmptyState title="Activity not found" /></Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-2">
              {isLibrary ? (
                <Badge tone="neutral"><Library size={12} /> Library</Badge>
              ) : (
                <Badge tone="brain">Day {activity.day_number}</Badge>
              )}
              <ClipboardList size={20} className="text-[#3a5d8f]" />
              <h1 className="text-xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>{isLibrary ? 'Who joined in?' : 'Daily Checkpoint'}</h1>
            </div>
            {isLibrary ? (
              <p className="text-sm text-[var(--ink-soft)] mt-2">Mark ✓ for each student who took part. This is just for fun — it doesn't affect your daily progress.</p>
            ) : quiz ? (
              <div className="mt-3 rounded-2xl bg-[#f4f4f5] p-4">
                <p className="text-xs font-extrabold uppercase tracking-wide text-[#3a5d8f] mb-1">Today's question</p>
                <p className="font-bold text-[var(--ink)]">{quiz.question_text}</p>
                {quiz.question_type === 'multiple_choice' && (
                  <p className="text-sm text-[var(--ink-soft)] mt-2">Correct answer: <span className="font-bold text-[var(--sage-deep)]">{quiz.correct_answer}</span></p>
                )}
                <p className="text-xs text-[var(--ink-soft)] mt-3">Mark ✓ if the student answered correctly, ✗ if not.</p>
              </div>
            ) : (
              <p className="text-sm text-[var(--ink-soft)] mt-2">No quiz question set. Mark each student's participation.</p>
            )}
          </Card>

          {students.length === 0 ? <Card><EmptyState title="No students" /></Card> : (
            <Card className="p-5">
              <div className="space-y-2">
                {students.map((s) => {
                  const val = answers[s.id];
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--line)]">
                      <div className="w-8 h-8 rounded-full bg-[var(--cream-deep)] flex items-center justify-center text-xs font-extrabold text-[var(--ink-soft)] shrink-0">{s.roll_number}</div>
                      <span className="font-bold text-[var(--ink)] text-sm flex-1 truncate">{s.name}</span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setAnswer(s.id, true)}
                          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${val === true ? 'bg-[var(--sage)] text-white scale-105' : 'bg-[var(--cream-deep)] text-[var(--ink-soft)] hover:bg-[#e4e4e7]'}`}
                        >
                          <Check size={20} />
                        </button>
                        {!isLibrary && (
                          <button
                            onClick={() => setAnswer(s.id, false)}
                            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${val === false ? 'bg-[#dc2626] text-white scale-105' : 'bg-[var(--cream-deep)] text-[var(--ink-soft)] hover:bg-[#e4e4e7]'}`}
                          >
                            <X size={20} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                {done ? (
                  <p className="text-sm font-bold text-[var(--sage-deep)] flex items-center gap-1.5"><CheckCircle2 size={16} /> {isLibrary ? 'Participation saved.' : `Checkpoint saved${isNextDay ? ' — class advanced to Day ' + (currentDay + 1) : '.'}`}</p>
                ) : existing.length > 0 ? (
                  <p className="text-sm font-bold text-[var(--amber)] flex items-center gap-1.5"><RotateCw size={14} /> Updating today's record</p>
                ) : <span />}
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => navigate('/dashboard/library')}>Done</Button>
                  <Button onClick={submit} disabled={busy || students.length === 0}>{busy ? 'Saving…' : isLibrary ? 'Save participation' : 'Submit checkpoint'}</Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
