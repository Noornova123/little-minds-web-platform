import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Loader2, ChevronRight, Target } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import type { DiagnosticTopic, DiagnosticSkill } from '@/lib/types';
import { Card, Button, Input, Spinner, EmptyState, Badge } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/Modal';

export function AdminDiagnosticSkills({ topicId }: { topicId: string }) {
  const [topic, setTopic] = useState<DiagnosticTopic | null>(null);
  const [skills, setSkills] = useState<DiagnosticSkill[]>([]);
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DiagnosticSkill | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DiagnosticSkill | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    const [topicRes, skillRes] = await Promise.all([
      supabase.from('diagnostic_topics').select('*').eq('id', topicId).maybeSingle(),
      supabase.from('diagnostic_skills').select('*').eq('topic_id', topicId).order('display_order', { ascending: true }),
    ]);
    if (topicRes.error) { setErr(topicRes.error.message); setLoading(false); return; }
    if (skillRes.error) { setErr(skillRes.error.message); setLoading(false); return; }
    setTopic(topicRes.data as DiagnosticTopic);
    const skillRows = (skillRes.data as DiagnosticSkill[]) ?? [];
    setSkills(skillRows);

    if (skillRows.length > 0) {
      const { data: qRows } = await supabase
        .from('diagnostic_questions')
        .select('skill_id')
        .in('skill_id', skillRows.map((s) => s.id));
      const counts: Record<string, number> = {};
      (qRows ?? []).forEach((r: any) => { counts[r.skill_id] = (counts[r.skill_id] ?? 0) + 1; });
      setQuestionCounts(counts);
    } else {
      setQuestionCounts({});
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [topicId]);

  function openNew() {
    setEditing(null);
    setName('');
    setFormErr(null);
    setShowForm(true);
  }
  function openEdit(s: DiagnosticSkill) {
    setEditing(s);
    setName(s.name);
    setFormErr(null);
    setShowForm(true);
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!name.trim()) { setFormErr('Skill name is required.'); return; }
    setBusy(true); setFormErr(null);
    if (editing) {
      const { error } = await supabase.from('diagnostic_skills').update({ name: name.trim() }).eq('id', editing.id);
      setBusy(false);
      if (error) { setFormErr(error.message); return; }
    } else {
      const nextOrder = skills.length > 0 ? Math.max(...skills.map((s) => s.display_order)) + 1 : 1;
      const { error } = await supabase.from('diagnostic_skills').insert({ topic_id: topicId, name: name.trim(), display_order: nextOrder }).select();
      setBusy(false);
      if (error) { setFormErr(error.message); return; }
    }
    setShowForm(false);
    await load();
  }

  async function move(s: DiagnosticSkill, dir: -1 | 1) {
    const sorted = [...skills].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((x) => x.id === s.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    await Promise.all([
      supabase.from('diagnostic_skills').update({ display_order: other.display_order }).eq('id', s.id),
      supabase.from('diagnostic_skills').update({ display_order: s.display_order }).eq('id', other.id),
    ]);
    load();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    await supabase.from('diagnostic_skills').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    load();
  }

  return (
    <div className="space-y-5 lm-fade-up">
      <button onClick={() => navigate(`/admin/diagnostics/subjects/${topic?.subject_id ?? ''}`)} className="flex items-center gap-1.5 text-sm font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
        <ArrowLeft size={15} /> Back to topics
      </button>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Target size={20} className="text-[var(--terracotta)]" />
          <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>
            {topic?.name ?? 'Skills'}
          </h1>
          {topic && <Badge tone="neutral">{topic.grade_level}</Badge>}
        </div>
        <Button size="sm" onClick={openNew}><Plus size={16} /> Add Skill</Button>
      </div>

      <p className="text-sm text-[var(--ink-soft)]">
        Skills are the specific, individually-testable concepts within this topic (e.g. "Adding fractions with unlike denominators"). Open a skill to add its questions.
      </p>

      {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>}

      {loading ? <Spinner label="Loading skills…" /> : skills.length === 0 ? (
        <Card className="p-5">
          <EmptyState title="No skills yet" hint="Break this topic into a few specific, testable skills." />
        </Card>
      ) : (
        <div className="space-y-2">
          {skills.map((s) => (
            <Card key={s.id} className="p-4 flex items-center gap-3">
              <div className="flex flex-col shrink-0">
                <button onClick={() => move(s, -1)} className="p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)]"><ArrowUp size={13} /></button>
                <button onClick={() => move(s, 1)} className="p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)]"><ArrowDown size={13} /></button>
              </div>
              <button className="flex-1 text-left flex items-center gap-2" onClick={() => navigate(`/admin/diagnostics/skills/${s.id}`)}>
                <span className="font-extrabold text-[var(--ink)]">{s.name}</span>
                <Badge tone="neutral">{questionCounts[s.id] ?? 0} questions</Badge>
              </button>
              <button onClick={() => openEdit(s)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[var(--cream-deep)] hover:text-[var(--terracotta)]"><Pencil size={14} /></button>
              <button onClick={() => setConfirmDelete(s)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={14} /></button>
              <button onClick={() => navigate(`/admin/diagnostics/skills/${s.id}`)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)]"><ChevronRight size={16} /></button>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit skill' : 'Add skill'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => save()} disabled={busy}>{busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save'}</Button>
          </>
        }
      >
        <form onSubmit={save} className="space-y-4">
          <Input label="Skill name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Adding fractions with unlike denominators" autoFocus />
          {formErr && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{formErr}</p>}
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Delete skill?"
        message={`Delete "${confirmDelete?.name}" and all its questions? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
