import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, HelpCircle, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import type { DiagnosticSkill, DiagnosticQuestion, DiagnosticQuestionType, DiagnosticDifficulty } from '@/lib/types';
import { Card, Button, Input, Spinner, EmptyState, Badge } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/Modal';

const DIFFICULTY_COLOR: Record<DiagnosticDifficulty, string> = {
  easy: '#059669',
  medium: '#d97706',
  hard: '#dc2626',
};

export function AdminDiagnosticQuestions({ skillId }: { skillId: string }) {
  const [skill, setSkill] = useState<DiagnosticSkill | null>(null);
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DiagnosticQuestion | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<DiagnosticQuestionType>('mcq');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [difficulty, setDifficulty] = useState<DiagnosticDifficulty>('medium');
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DiagnosticQuestion | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    const [skillRes, qRes] = await Promise.all([
      supabase.from('diagnostic_skills').select('*').eq('id', skillId).maybeSingle(),
      supabase.from('diagnostic_questions').select('*').eq('skill_id', skillId).order('created_at', { ascending: true }),
    ]);
    if (skillRes.error) { setErr(skillRes.error.message); setLoading(false); return; }
    if (qRes.error) { setErr(qRes.error.message); setLoading(false); return; }
    setSkill(skillRes.data as DiagnosticSkill);
    setQuestions((qRes.data as DiagnosticQuestion[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [skillId]);

  function openNew() {
    setEditing(null);
    setQuestionText('');
    setQuestionType('mcq');
    setOptions(['', '']);
    setCorrectAnswer('');
    setDifficulty('medium');
    setFormErr(null);
    setShowForm(true);
  }

  function openEdit(q: DiagnosticQuestion) {
    setEditing(q);
    setQuestionText(q.question_text);
    setQuestionType(q.question_type);
    setOptions(q.options.length > 0 ? q.options : ['', '']);
    setCorrectAnswer(q.correct_answer);
    setDifficulty(q.difficulty);
    setFormErr(null);
    setShowForm(true);
  }

  function updateOption(idx: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  }
  function addOption() {
    setOptions((prev) => [...prev, '']);
  }
  function removeOption(idx: number) {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!questionText.trim()) { setFormErr('Question text is required.'); return; }
    if (!correctAnswer.trim()) { setFormErr('Correct answer is required.'); return; }
    const cleanOptions = questionType === 'mcq' ? options.map((o) => o.trim()).filter(Boolean) : [];
    if (questionType === 'mcq' && cleanOptions.length < 2) { setFormErr('Add at least 2 options for a multiple choice question.'); return; }
    if (questionType === 'mcq' && !cleanOptions.includes(correctAnswer.trim())) { setFormErr('Correct answer must match one of the options exactly.'); return; }

    setBusy(true); setFormErr(null);
    const payload = {
      skill_id: skillId,
      question_text: questionText.trim(),
      question_type: questionType,
      options: cleanOptions,
      correct_answer: correctAnswer.trim(),
      difficulty,
    };
    if (editing) {
      const { error } = await supabase.from('diagnostic_questions').update(payload).eq('id', editing.id);
      setBusy(false);
      if (error) { setFormErr(error.message); return; }
    } else {
      const { error } = await supabase.from('diagnostic_questions').insert(payload).select();
      setBusy(false);
      if (error) { setFormErr(error.message); return; }
    }
    setShowForm(false);
    await load();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    await supabase.from('diagnostic_questions').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    load();
  }

  return (
    <div className="space-y-5 lm-fade-up">
      <button onClick={() => navigate(`/admin/diagnostics/topics/${skill?.topic_id ?? ''}`)} className="flex items-center gap-1.5 text-sm font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
        <ArrowLeft size={15} /> Back to skills
      </button>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <HelpCircle size={20} className="text-[var(--terracotta)]" />
          <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>
            {skill?.name ?? 'Questions'}
          </h1>
        </div>
        <Button size="sm" onClick={openNew}><Plus size={16} /> Add Question</Button>
      </div>

      <p className="text-sm text-[var(--ink-soft)]">
        These are the questions a student answers during a diagnostic screening for this skill. Mix easy/medium/hard difficulty so the screening reads a genuine range of ability.
      </p>

      {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>}

      {loading ? <Spinner label="Loading questions…" /> : questions.length === 0 ? (
        <Card className="p-5">
          <EmptyState title="No questions yet" hint="Add a question to start screening this skill." />
        </Card>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => (
            <Card key={q.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className="text-xs font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide"
                      style={{ background: `${DIFFICULTY_COLOR[q.difficulty]}1f`, color: DIFFICULTY_COLOR[q.difficulty] }}
                    >
                      {q.difficulty}
                    </span>
                    <Badge tone="neutral">{q.question_type === 'mcq' ? 'Multiple choice' : q.question_type === 'true_false' ? 'True / False' : 'Short answer'}</Badge>
                  </div>
                  <p className="font-bold text-[var(--ink)]">{q.question_text}</p>
                  {q.question_type === 'mcq' && (
                    <ul className="mt-2 space-y-1">
                      {q.options.map((o, i) => (
                        <li key={i} className={`text-sm px-2 py-1 rounded-lg ${o === q.correct_answer ? 'bg-[#ecfdf5] text-[#059669] font-bold' : 'text-[var(--ink-soft)]'}`}>
                          {o}{o === q.correct_answer ? ' ✓' : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.question_type !== 'mcq' && (
                    <p className="mt-1 text-sm text-[#059669] font-bold">Correct: {q.correct_answer}</p>
                  )}
                </div>
                <button onClick={() => openEdit(q)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[var(--cream-deep)] hover:text-[var(--terracotta)]"><Pencil size={14} /></button>
                <button onClick={() => setConfirmDelete(q)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={14} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit question' : 'Add question'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => save()} disabled={busy}>{busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save'}</Button>
          </>
        }
      >
        <form onSubmit={save} className="space-y-4">
          <Input label="Question text" value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="e.g. What is 1/2 + 1/4?" autoFocus />

          <label className="block">
            <span className="lm-label block mb-1.5">Question type</span>
            <select
              className="lm-input"
              value={questionType}
              onChange={(e) => {
                const val = e.target.value as DiagnosticQuestionType;
                setQuestionType(val);
                setCorrectAnswer('');
                if (val === 'true_false') setOptions(['True', 'False']);
                else if (val === 'mcq') setOptions(['', '']);
              }}
            >
              <option value="mcq">Multiple choice</option>
              <option value="true_false">True / False</option>
              <option value="short_answer">Short answer</option>
            </select>
          </label>

          {questionType === 'mcq' && (
            <div>
              <span className="lm-label block mb-1.5">Options</span>
              <div className="space-y-2">
                {options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="lm-input flex-1"
                      value={o}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                    />
                    {options.length > 2 && (
                      <button type="button" onClick={() => removeOption(i)} className="p-1.5 text-[var(--ink-soft)] hover:text-[#dc2626]"><X size={16} /></button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addOption} className="mt-2 text-sm font-bold text-[var(--terracotta)] hover:underline">+ Add option</button>
            </div>
          )}

          {questionType === 'true_false' ? (
            <label className="block">
              <span className="lm-label block mb-1.5">Correct answer</span>
              <select className="lm-input" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)}>
                <option value="">Select…</option>
                <option value="True">True</option>
                <option value="False">False</option>
              </select>
            </label>
          ) : questionType === 'mcq' ? (
            <label className="block">
              <span className="lm-label block mb-1.5">Correct answer</span>
              <select className="lm-input" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)}>
                <option value="">Select the correct option…</option>
                {options.filter((o) => o.trim()).map((o, i) => <option key={i} value={o}>{o}</option>)}
              </select>
            </label>
          ) : (
            <Input label="Correct answer" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} placeholder="Expected answer" />
          )}

          <label className="block">
            <span className="lm-label block mb-1.5">Difficulty</span>
            <select className="lm-input" value={difficulty} onChange={(e) => setDifficulty(e.target.value as DiagnosticDifficulty)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>

          {formErr && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{formErr}</p>}
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Delete question?"
        message="Delete this question? Past responses to it will also be removed."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
