import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Loader2, ChevronRight, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import type { DiagnosticSubject, DiagnosticTopic, GradeLevel } from '@/lib/types';
import { Card, Button, Input, Spinner, EmptyState, Badge } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/Modal';

export function AdminDiagnosticTopics({ subjectId }: { subjectId: string }) {
  const [subject, setSubject] = useState<DiagnosticSubject | null>(null);
  const [topics, setTopics] = useState<DiagnosticTopic[]>([]);
  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [skillCounts, setSkillCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DiagnosticTopic | null>(null);
  const [name, setName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DiagnosticTopic | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    const [subRes, topicRes, gradeRes] = await Promise.all([
      supabase.from('diagnostic_subjects').select('*').eq('id', subjectId).maybeSingle(),
      supabase.from('diagnostic_topics').select('*').eq('subject_id', subjectId).order('display_order', { ascending: true }),
      supabase.from('grade_levels').select('*').order('sort_order', { ascending: true }),
    ]);
    if (subRes.error) { setErr(subRes.error.message); setLoading(false); return; }
    if (topicRes.error) { setErr(topicRes.error.message); setLoading(false); return; }
    setSubject(subRes.data as DiagnosticSubject);
    const topicRows = (topicRes.data as DiagnosticTopic[]) ?? [];
    setTopics(topicRows);
    setGrades((gradeRes.data as GradeLevel[]) ?? []);

    if (topicRows.length > 0) {
      const { data: skillRows } = await supabase
        .from('diagnostic_skills')
        .select('topic_id')
        .in('topic_id', topicRows.map((t) => t.id));
      const counts: Record<string, number> = {};
      (skillRows ?? []).forEach((r: any) => { counts[r.topic_id] = (counts[r.topic_id] ?? 0) + 1; });
      setSkillCounts(counts);
    } else {
      setSkillCounts({});
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [subjectId]);

  function openNew() {
    setEditing(null);
    setName('');
    setGradeLevel(grades[0]?.name ?? '');
    setFormErr(null);
    setShowForm(true);
  }

  function openEdit(t: DiagnosticTopic) {
    setEditing(t);
    setName(t.name);
    setGradeLevel(t.grade_level);
    setFormErr(null);
    setShowForm(true);
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!name.trim()) { setFormErr('Topic name is required.'); return; }
    if (!gradeLevel) { setFormErr('Please select a grade level.'); return; }
    setBusy(true); setFormErr(null);
    if (editing) {
      const { error } = await supabase.from('diagnostic_topics').update({ name: name.trim(), grade_level: gradeLevel }).eq('id', editing.id);
      setBusy(false);
      if (error) { setFormErr(error.message); return; }
    } else {
      const nextOrder = topics.length > 0 ? Math.max(...topics.map((t) => t.display_order)) + 1 : 1;
      const { error } = await supabase.from('diagnostic_topics').insert({ subject_id: subjectId, name: name.trim(), grade_level: gradeLevel, display_order: nextOrder }).select();
      setBusy(false);
      if (error) { setFormErr(error.message); return; }
    }
    setShowForm(false);
    await load();
  }

  async function move(t: DiagnosticTopic, dir: -1 | 1) {
    const sorted = [...topics].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((x) => x.id === t.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    await Promise.all([
      supabase.from('diagnostic_topics').update({ display_order: other.display_order }).eq('id', t.id),
      supabase.from('diagnostic_topics').update({ display_order: t.display_order }).eq('id', other.id),
    ]);
    load();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    await supabase.from('diagnostic_topics').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    load();
  }

  return (
    <div className="space-y-5 lm-fade-up">
      <button onClick={() => navigate('/admin/diagnostics')} className="flex items-center gap-1.5 text-sm font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
        <ArrowLeft size={15} /> Back to subjects
      </button>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Layers size={20} className="text-[var(--terracotta)]" />
          <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>
            {subject?.name ?? 'Topics'}
          </h1>
        </div>
        <Button size="sm" onClick={openNew} disabled={grades.length === 0}><Plus size={16} /> Add Topic</Button>
      </div>

      <p className="text-sm text-[var(--ink-soft)]">
        Topics are chapters within {subject?.name ?? 'this subject'}, tagged to a class/grade level. Open a topic to add the skills it covers.
      </p>

      {grades.length === 0 && (
        <p className="text-sm font-semibold text-[#92400e] bg-[#fffbeb] rounded-lg px-3 py-2">
          No grade levels found — add them first under Admin → Grade Levels.
        </p>
      )}

      {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>}

      {loading ? <Spinner label="Loading topics…" /> : topics.length === 0 ? (
        <Card className="p-5">
          <EmptyState title="No topics yet" hint="Add a topic like 'Fractions' and tag it to a grade level." />
        </Card>
      ) : (
        <div className="space-y-2">
          {topics.map((t) => (
            <Card key={t.id} className="p-4 flex items-center gap-3">
              <div className="flex flex-col shrink-0">
                <button onClick={() => move(t, -1)} className="p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)]"><ArrowUp size={13} /></button>
                <button onClick={() => move(t, 1)} className="p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)]"><ArrowDown size={13} /></button>
              </div>
              <button className="flex-1 text-left flex items-center gap-2 flex-wrap" onClick={() => navigate(`/admin/diagnostics/topics/${t.id}`)}>
                <span className="font-extrabold text-[var(--ink)]">{t.name}</span>
                <Badge tone="neutral">{t.grade_level}</Badge>
                <Badge tone="neutral">{skillCounts[t.id] ?? 0} skills</Badge>
              </button>
              <button onClick={() => openEdit(t)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[var(--cream-deep)] hover:text-[var(--terracotta)]"><Pencil size={14} /></button>
              <button onClick={() => setConfirmDelete(t)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={14} /></button>
              <button onClick={() => navigate(`/admin/diagnostics/topics/${t.id}`)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)]"><ChevronRight size={16} /></button>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit topic' : 'Add topic'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => save()} disabled={busy}>{busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save'}</Button>
          </>
        }
      >
        <form onSubmit={save} className="space-y-4">
          <Input label="Topic name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fractions" autoFocus />
          <label className="block">
            <span className="lm-label block mb-1.5">Grade level</span>
            <select className="lm-input" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}>
              {grades.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
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
        title="Delete topic?"
        message={`Delete "${confirmDelete?.name}" and all its skills and questions? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
