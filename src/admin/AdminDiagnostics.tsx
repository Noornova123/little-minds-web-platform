import { useEffect, useState } from 'react';
import { Stethoscope, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Loader2, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import type { DiagnosticSubject } from '@/lib/types';
import { Card, Button, Input, Spinner, EmptyState, Badge } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/Modal';

export function AdminDiagnostics() {
  const [subjects, setSubjects] = useState<DiagnosticSubject[]>([]);
  const [topicCounts, setTopicCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DiagnosticSubject | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DiagnosticSubject | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    const [subRes, topicRes] = await Promise.all([
      supabase.from('diagnostic_subjects').select('*').order('display_order', { ascending: true }),
      supabase.from('diagnostic_topics').select('subject_id'),
    ]);
    if (subRes.error) { setErr(subRes.error.message); setLoading(false); return; }
    setSubjects((subRes.data as DiagnosticSubject[]) ?? []);
    const counts: Record<string, number> = {};
    (topicRes.data ?? []).forEach((t: any) => { counts[t.subject_id] = (counts[t.subject_id] ?? 0) + 1; });
    setTopicCounts(counts);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setName('');
    setFormErr(null);
    setShowForm(true);
  }
  function openEdit(s: DiagnosticSubject) {
    setEditing(s);
    setName(s.name);
    setFormErr(null);
    setShowForm(true);
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!name.trim()) { setFormErr('Subject name is required.'); return; }
    setBusy(true); setFormErr(null);
    if (editing) {
      const { error } = await supabase.from('diagnostic_subjects').update({ name: name.trim() }).eq('id', editing.id);
      setBusy(false);
      if (error) { setFormErr(error.message); return; }
    } else {
      const nextOrder = subjects.length > 0 ? Math.max(...subjects.map((s) => s.display_order)) + 1 : 1;
      const { error } = await supabase.from('diagnostic_subjects').insert({ name: name.trim(), display_order: nextOrder }).select();
      setBusy(false);
      if (error) { setFormErr(error.message); return; }
    }
    setShowForm(false);
    await load();
  }

  async function move(s: DiagnosticSubject, dir: -1 | 1) {
    const sorted = [...subjects].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((x) => x.id === s.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    await Promise.all([
      supabase.from('diagnostic_subjects').update({ display_order: other.display_order }).eq('id', s.id),
      supabase.from('diagnostic_subjects').update({ display_order: s.display_order }).eq('id', other.id),
    ]);
    load();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    await supabase.from('diagnostic_subjects').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    load();
  }

  return (
    <div className="space-y-5 lm-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Stethoscope size={20} className="text-[var(--terracotta)]" />
          <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Diagnostic Subjects</h1>
        </div>
        <Button size="sm" onClick={openNew}><Plus size={16} /> Add Subject</Button>
      </div>

      <p className="text-sm text-[var(--ink-soft)]">
        This is the top level of the diagnostic question bank. Open a subject to add class-wise topics, then skills and questions inside each topic. A teacher screens a student against this bank, and the app auto-generates a weakness report and roadmap.
      </p>

      {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>}

      {loading ? <Spinner label="Loading subjects…" /> : subjects.length === 0 ? (
        <Card className="p-5">
          <EmptyState title="No subjects yet" hint="Add a subject like Math or English to start building the diagnostic question bank." />
        </Card>
      ) : (
        <div className="space-y-2">
          {subjects.map((s) => (
            <Card key={s.id} className="p-4 flex items-center gap-3">
              <div className="flex flex-col shrink-0">
                <button onClick={() => move(s, -1)} className="p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)]"><ArrowUp size={13} /></button>
                <button onClick={() => move(s, 1)} className="p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)]"><ArrowDown size={13} /></button>
              </div>
              <button className="flex-1 text-left flex items-center gap-2" onClick={() => navigate(`/admin/diagnostics/subjects/${s.id}`)}>
                <span className="font-extrabold text-[var(--ink)]">{s.name}</span>
                <Badge tone="neutral">{topicCounts[s.id] ?? 0} topics</Badge>
              </button>
              <button onClick={() => openEdit(s)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[var(--cream-deep)] hover:text-[var(--terracotta)]"><Pencil size={14} /></button>
              <button onClick={() => setConfirmDelete(s)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={14} /></button>
              <button onClick={() => navigate(`/admin/diagnostics/subjects/${s.id}`)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)]"><ChevronRight size={16} /></button>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit subject' : 'Add subject'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => save()} disabled={busy}>{busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save'}</Button>
          </>
        }
      >
        <form onSubmit={save} className="space-y-4">
          <Input label="Subject name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mathematics" autoFocus />
          {formErr && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{formErr}</p>}
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Delete subject?"
        message={`Delete "${confirmDelete?.name}" and all its topics, skills, and questions? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
