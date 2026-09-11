import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import type { DiagnosticAttempt, DiagnosticQuestion, DiagnosticSkill, DiagnosticMasteryLevel } from '@/lib/types';
import { Card, Button, Spinner } from '@/components/ui';

interface AnsweredQuestion {
  question: DiagnosticQuestion;
  studentAnswer: string;
  isCorrect: boolean;
}

export function DiagnosticRun({ studentId, attemptId }: { studentId: string; attemptId: string }) {
  const [attempt, setAttempt] = useState<DiagnosticAttempt | null>(null);
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [skillsById, setSkillsById] = useState<Record<string, DiagnosticSkill>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState('');
  const [answered, setAnswered] = useState<AnsweredQuestion[]>([]);
  const [finishing, setFinishing] = useState(false);

  async function load() {
    setLoading(true); setErr(null);
    const attemptRes = await supabase.from('diagnostic_attempts').select('*').eq('id', attemptId).maybeSingle();
    if (attemptRes.error || !attemptRes.data) { setErr(attemptRes.error?.message ?? 'Screening not found'); setLoading(false); return; }
    const a = attemptRes.data as DiagnosticAttempt;
    setAttempt(a);

    const topicRes = await supabase
      .from('diagnostic_topics')
      .select('id')
      .eq('subject_id', a.subject_id)
      .eq('grade_level', a.grade_level)
      .eq('board', a.board);
    const topicIds = (topicRes.data ?? []).map((t: any) => t.id);

    const skillRes = topicIds.length > 0
      ? await supabase.from('diagnostic_skills').select('*').in('topic_id', topicIds)
      : { data: [] as any[] };
    const skillRows = (skillRes.data as DiagnosticSkill[]) ?? [];
    const skillMap: Record<string, DiagnosticSkill> = {};
    skillRows.forEach((s) => { skillMap[s.id] = s; });
    setSkillsById(skillMap);

    const questionRes = skillRows.length > 0
      ? await supabase.from('diagnostic_questions').select('*').in('skill_id', skillRows.map((s) => s.id))
      : { data: [] as any[] };
    const questionRows = (questionRes.data as DiagnosticQuestion[]) ?? [];
    // Light shuffle so repeated screenings don't always show the same order.
    setQuestions([...questionRows].sort(() => Math.random() - 0.5));
    setLoading(false);
  }

  useEffect(() => { load(); }, [attemptId]);

  const current = questions[index];
  const isLast = index === questions.length - 1;

  function submitAnswer() {
    if (!current || !selected) return;
    const isCorrect = selected.trim() === current.correct_answer.trim();
    const updated = [...answered, { question: current, studentAnswer: selected, isCorrect }];
    setAnswered(updated);
    setSelected('');
    if (isLast) {
      finish(updated);
    } else {
      setIndex((i) => i + 1);
    }
  }

  async function finish(all: AnsweredQuestion[]) {
    if (!attempt) return;
    setFinishing(true);

    // 1. Save every response for this attempt.
    const responseRows = all.map((a) => ({
      attempt_id: attemptId,
      question_id: a.question.id,
      skill_id: a.question.skill_id,
      student_answer: a.studentAnswer,
      is_correct: a.isCorrect,
    }));
    if (responseRows.length > 0) {
      await supabase.from('diagnostic_responses').insert(responseRows);
    }

    // 2. Mark the attempt completed.
    await supabase.from('diagnostic_attempts').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', attemptId);

    // 3. Aggregate a per-skill score from this attempt's responses.
    const bySkill: Record<string, { correct: number; total: number }> = {};
    for (const a of all) {
      const key = a.question.skill_id;
      if (!bySkill[key]) bySkill[key] = { correct: 0, total: 0 };
      bySkill[key].total += 1;
      if (a.isCorrect) bySkill[key].correct += 1;
    }

    const masteryRows = Object.entries(bySkill).map(([skillId, { correct, total }]) => {
      const percent = total > 0 ? (correct / total) * 100 : 0;
      const level: DiagnosticMasteryLevel = percent < 50 ? 'needs_support' : percent < 80 ? 'developing' : 'strong';
      return { student_id: studentId, skill_id: skillId, mastery_level: level, score_percent: percent, last_updated: new Date().toISOString() };
    });

    if (masteryRows.length > 0) {
      await supabase.from('diagnostic_skill_mastery').upsert(masteryRows, { onConflict: 'student_id,skill_id' });
    }

    // 4. Rebuild the roadmap for the skills covered in this attempt: clear old
    // entries for these skills, then re-add the ones still needing support,
    // weakest skill first.
    const skillIds = Object.keys(bySkill);
    if (skillIds.length > 0) {
      await supabase.from('diagnostic_roadmap_items').delete().eq('student_id', studentId).in('skill_id', skillIds);
      const needsWork = masteryRows
        .filter((m) => m.mastery_level !== 'strong')
        .sort((a, b) => a.score_percent - b.score_percent)
        .map((m, i) => ({ student_id: studentId, skill_id: m.skill_id, priority: i + 1, status: 'pending' as const }));
      if (needsWork.length > 0) {
        await supabase.from('diagnostic_roadmap_items').insert(needsWork);
      }
    }

    setFinishing(false);
    navigate(`/dashboard/diagnostics/${studentId}/report/${attemptId}`);
  }

  if (loading) return <Spinner label="Loading screening…" />;
  if (err) return <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>;
  if (finishing) return <Spinner label="Scoring the screening…" />;
  if (questions.length === 0) return <p className="text-sm text-[var(--ink-soft)]">No questions found for this screening.</p>;

  return (
    <div className="space-y-5 lm-fade-up max-w-xl mx-auto">
      <div className="flex items-center justify-between text-xs font-bold text-[var(--ink-soft)]">
        <span>Question {index + 1} of {questions.length}</span>
        <span>{skillsById[current.skill_id]?.name}</span>
      </div>

      <div className="w-full h-2 rounded-full bg-[var(--cream-deep)] overflow-hidden">
        <div className="h-full bg-[var(--terracotta)] transition-all" style={{ width: `${(index / questions.length) * 100}%` }} />
      </div>

      <Card className="p-6">
        <p className="text-lg font-extrabold text-[var(--ink)] mb-5">{current.question_text}</p>

        {current.question_type === 'mcq' && (
          <div className="space-y-2">
            {current.options.map((o, i) => (
              <button
                key={i}
                onClick={() => setSelected(o)}
                className={`w-full text-left px-4 py-3 rounded-2xl border-2 font-bold transition-colors ${selected === o ? 'border-[var(--terracotta)] bg-[var(--coral-soft)] text-[var(--ink)]' : 'border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--terracotta-soft)]'}`}
              >
                {o}
              </button>
            ))}
          </div>
        )}

        {current.question_type === 'true_false' && (
          <div className="grid grid-cols-2 gap-3">
            {['True', 'False'].map((o) => (
              <button
                key={o}
                onClick={() => setSelected(o)}
                className={`px-4 py-3 rounded-2xl border-2 font-bold transition-colors ${selected === o ? 'border-[var(--terracotta)] bg-[var(--coral-soft)] text-[var(--ink)]' : 'border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--terracotta-soft)]'}`}
              >
                {o}
              </button>
            ))}
          </div>
        )}

        {current.question_type === 'short_answer' && (
          <input
            className="lm-input"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            placeholder="Type the student's answer"
            autoFocus
          />
        )}

        <div className="mt-6">
          <Button onClick={submitAnswer} disabled={!selected.trim()}>
            {isLast ? 'Finish screening' : 'Next question'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
