import { useEffect, useState } from 'react';
import { Landmark, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { EducationBoard } from '@/lib/types';
import { Card, Button, Input, Spinner, EmptyState } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/Modal';

export function AdminBoards() {
  const [boards, setBoards] = useState<EducationBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EducationBoard | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EducationBoard | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    const { data, error } = await supabase.from('education_boards').select('*').order('sort_order', { ascending: true });
    if (error) { setErr(error.message); setLoading(false); return; }
    setBoards((data as EducationBoard[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setName('');
    setFormErr(null);
    setShowForm(true);
  }
  function openEdit(b: EducationBoard) {
    setEditing(b);
    setName(b.name);
    setFormErr(null);
    setShowForm(true);
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!name.trim()) { setFormErr('Board name is required.'); return; }
    setBusy(true); setFormErr(null);
    if (editing) {
      const { error } = await supabase.from('education_boards').update({ name: name.trim() }).eq('id', editing.id);
      setBusy(false);
      if (error) { setFormErr(error.message); return; }
    } else {
      const nextOrder = boards.length > 0 ? Math.max(...boards.map((b) => b.sort_order)) + 1 : 1;
      const { error } = await supabase.from('education_boards').insert({ name: name.trim(), sort_order: nextOrder }).select();
      setBusy(false);
      if (error) { setFormErr(error.message); return; }
    }
    setShowForm(false);
    await load();
  }

  async function move(b: EducationBoard, dir: -1 | 1) {
    const sorted = [...boards].sort((a, b2) => a.sort_order - b2.sort_order);
    const idx = sorted.findIndex((x) => x.id === b.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    await Promise.all([
      supabase.from('education_boards').update({ sort_order: other.sort_order }).eq('id', b.id),
      supabase.from('education_boards').update({ sort_order: b.sort_order }).eq('id', other.id),
    ]);
    load();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    await supabase.from('education_boards').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    load();
  }

  return (
    <div className="space-y-5 lm-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Landmark size={20} className="text-[var(--terracotta)]" />
          <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Education Boards</h1>
        </div>
        <Button size="sm" onClick={openNew}><Plus size={16} /> Add Board</Button>
      </div>

      <p className="text-sm text-[var(--ink-soft)]">
        Boards used to tag diagnostic topics (e.g. CBSE, ICSE, State Board), since the same grade's syllabus differs by board. Add or rename boards here — changes are reflected everywhere they're used.
      </p>

      {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>}

      {loading ? <Spinner label="Loading boards…" /> : boards.length === 0 ? (
        <Card className="p-5">
          <EmptyState title="No boards yet" hint="Add CBSE, ICSE, or your state board to get started." />
        </Card>
      ) : (
        <div className="space-y-2">
          {boards.map((b) => (
            <Card key={b.id} className="p-4 flex items-center gap-3">
              <div className="flex flex-col shrink-0">
                <button onClick={() => move(b, -1)} className="p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)]"><ArrowUp size={13} /></button>
                <button onClick={() => move(b, 1)} className="p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)]"><ArrowDown size={13} /></button>
              </div>
              <span className="flex-1 font-extrabold text-[var(--ink)]">{b.name}</span>
              <button onClick={() => openEdit(b)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[var(--cream-deep)] hover:text-[var(--terracotta)]"><Pencil size={14} /></button>
              <button onClick={() => setConfirmDelete(b)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={14} /></button>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit board' : 'Add board'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => save()} disabled={busy}>{busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save'}</Button>
          </>
        }
      >
        <form onSubmit={save} className="space-y-4">
          <Input label="Board name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CBSE" autoFocus />
          {formErr && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{formErr}</p>}
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Delete board?"
        message={`Delete "${confirmDelete?.name}"? Topics already tagged with this board will keep the text but it will no longer appear in dropdowns.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
