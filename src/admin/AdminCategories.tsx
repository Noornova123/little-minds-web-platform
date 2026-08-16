import { useEffect, useState } from 'react';
import { Plus, Trash2, Tag, BookOpen, Library, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { LibraryCategory, CurriculumCategory } from '@/lib/types';
import { Card, Button, Input, Spinner, EmptyState } from '@/components/ui';
import { ConfirmDialog } from '@/components/Modal';

type Cat = LibraryCategory | CurriculumCategory;

function CategoryManager({
  table,
  icon,
  heading,
  hint,
  deleteHint,
}: {
  table: 'curriculum_categories' | 'library_categories';
  icon: React.ReactNode;
  heading: string;
  hint: string;
  deleteHint: (name: string) => string;
}) {
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Cat | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from(table).select('*').order('sort_order', { ascending: true });
    setCats((data as Cat[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true); setErr(null);
    const nextOrder = cats.length > 0 ? Math.max(...cats.map((c) => c.sort_order)) + 1 : 1;
    const { error } = await supabase.from(table).insert({ name: newName.trim(), sort_order: nextOrder });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setNewName('');
    load();
  }

  async function rename(id: string, name: string) {
    await supabase.from(table).update({ name }).eq('id', id);
    load();
  }

  async function move(c: Cat, dir: -1 | 1) {
    const sorted = [...cats].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === c.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    await Promise.all([
      supabase.from(table).update({ sort_order: other.sort_order }).eq('id', c.id),
      supabase.from(table).update({ sort_order: c.sort_order }).eq('id', other.id),
    ]);
    load();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    await supabase.from(table).delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    load();
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h1 className="text-xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>{heading}</h1>
      </div>
      <p className="text-sm text-[var(--ink-soft)] mb-4">{hint}</p>

      <form onSubmit={add} className="flex gap-2 mb-4">
        <Input className="flex-1" placeholder="New category name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button type="submit" disabled={busy || !newName.trim()}><Plus size={16} /> Add</Button>
      </form>
      {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2 mb-3">{err}</p>}

      {loading ? <Spinner label="Loading…" /> : cats.length === 0 ? (
        <EmptyState title="No categories yet" hint="Add one to start organizing." />
      ) : (
        <div className="divide-y divide-[var(--line)]">
          {cats.map((c) => (
            <div key={c.id} className="flex items-center gap-2 py-2.5">
              <div className="flex flex-col">
                <button onClick={() => move(c, -1)} disabled={c.sort_order === Math.min(...cats.map((x) => x.sort_order))} className="p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-30"><ArrowUp size={14} /></button>
                <button onClick={() => move(c, 1)} disabled={c.sort_order === Math.max(...cats.map((x) => x.sort_order))} className="p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-30"><ArrowDown size={14} /></button>
              </div>
              <input
                className="lm-input flex-1 font-bold"
                value={c.name}
                onChange={(e) => {
                  setCats((p) => p.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)));
                }}
                onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== c.name) rename(c.id, e.target.value.trim()); }}
              />
              <button onClick={() => setConfirmDelete(c)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Delete category?"
        message={confirmDelete ? deleteHint(confirmDelete.name) : ''}
        confirmLabel="Delete"
        danger
      />
    </Card>
  );
}

export function AdminCategories() {
  return (
    <div className="space-y-5 lm-fade-up">
      <CategoryManager
        table="curriculum_categories"
        icon={<BookOpen size={18} className="text-[var(--terracotta)]" />}
        heading="Daily curriculum categories"
        hint="These labels tag each day's curriculum activity (e.g. Focus, Brain, Behaviour). Add or rename any time."
        deleteHint={(name) => `Delete "${name}"? Daily curriculum activities using this label won't be deleted, but they'll need re-categorizing.`}
      />
      <CategoryManager
        table="library_categories"
        icon={<Library size={18} className="text-[var(--terracotta)]" />}
        heading="Library categories"
        hint="These labels organize the Content Library teachers browse. Add or rename any time."
        deleteHint={(name) => `Delete "${name}"? Library activities using this label won't be deleted, but they'll need re-categorizing.`}
      />
    </div>
  );
}
