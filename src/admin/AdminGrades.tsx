import { useEffect, useState } from 'react';
import { Plus, Trash2, GraduationCap, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { GradeLevel } from '@/lib/types';
import { Card, Button, Input, Spinner, EmptyState } from '@/components/ui';
import { ConfirmDialog } from '@/components/Modal';

export function AdminGrades() {
  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GradeLevel | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('grade_levels').select('*').order('sort_order', { ascending: true });
    setGrades((data as GradeLevel[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true); setErr(null);
    const nextOrder = grades.length > 0 ? Math.max(...grades.map((g) => g.sort_order)) + 1 : 1;
    const { error } = await supabase.from('grade_levels').insert({ name: newName.trim(), sort_order: nextOrder });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setNewName('');
    load();
  }

  async function rename(id: string, name: string) {
    await supabase.from('grade_levels').update({ name }).eq('id', id);
    load();
  }

  async function move(g: GradeLevel, dir: -1 | 1) {
    const sorted = [...grades].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === g.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    await Promise.all([
      supabase.from('grade_levels').update({ sort_order: other.sort_order }).eq('id', g.id),
      supabase.from('grade_levels').update({ sort_order: g.sort_order }).eq('id', other.id),
    ]);
    load();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    await supabase.from('grade_levels').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    load();
  }

  return (
    <div className="space-y-5 lm-fade-up">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap size={18} className="text-[var(--terracotta)]" />
          <h1 className="text-xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Grade levels</h1>
        </div>
        <p className="text-sm text-[var(--ink-soft)] mb-4">These labels tag content and classes by grade. Teachers see only the content matching their class's grade.</p>

        <form onSubmit={add} className="flex gap-2 mb-4">
          <Input className="flex-1" placeholder="New grade level (e.g. Grade 9)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button type="submit" disabled={busy || !newName.trim()}><Plus size={16} /> Add</Button>
        </form>
        {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2 mb-3">{err}</p>}

        {loading ? <Spinner label="Loading…" /> : grades.length === 0 ? (
          <EmptyState title="No grade levels yet" hint="Add one to start tagging content by grade." />
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {grades.map((g) => (
              <div key={g.id} className="flex items-center gap-2 py-2.5">
                <div className="flex flex-col">
                  <button onClick={() => move(g, -1)} disabled={g.sort_order === Math.min(...grades.map((x) => x.sort_order))} className="p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-30"><ArrowUp size={14} /></button>
                  <button onClick={() => move(g, 1)} disabled={g.sort_order === Math.max(...grades.map((x) => x.sort_order))} className="p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-30"><ArrowDown size={14} /></button>
                </div>
                <input
                  className="lm-input flex-1 font-bold"
                  value={g.name}
                  onChange={(e) => {
                    setGrades((p) => p.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x)));
                  }}
                  onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== g.name) rename(g.id, e.target.value.trim()); }}
                />
                <button onClick={() => setConfirmDelete(g)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Delete grade level?"
        message={`Delete "${confirmDelete?.name}"? Activities and classes using this label won't be deleted, but they'll need re-tagging.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
