import { useEffect, useState } from 'react';
import { LifeBuoy, Plus, Pencil, Trash2, Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { HelpSection } from '@/lib/types';
import { Card, Button, Input, Spinner, EmptyState } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/Modal';

export function AdminHelp() {
  const [sections, setSections] = useState<HelpSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<HelpSection | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<HelpSection | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    const { data, error } = await supabase.from('help_sections').select('*').order('sort_order', { ascending: true });
    if (error) { setErr(error.message); setLoading(false); return; }
    setSections((data as HelpSection[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null); setTitle(''); setSlug(''); setBody(''); setFormErr(null); setShowForm(true);
  }
  function openEdit(s: HelpSection) {
    setEditing(s); setTitle(s.title); setSlug(s.slug); setBody(s.body); setFormErr(null); setShowForm(true);
  }

  async function save() {
    if (!title.trim()) { setFormErr('Title is required.'); return; }
    const finalSlug = slug.trim() || title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!finalSlug) { setFormErr('Could not generate a valid slug.'); return; }
    setBusy(true); setFormErr(null);
    const nextOrder = editing ? editing.sort_order : (sections.length > 0 ? Math.max(...sections.map((s) => s.sort_order)) + 1 : 1);
    if (editing) {
      const { error } = await supabase.from('help_sections').update({ title: title.trim(), slug: finalSlug, body, updated_at: new Date().toISOString() }).eq('id', editing.id);
      setBusy(false);
      if (error) { setFormErr(error.message); return; }
    } else {
      const { error } = await supabase.from('help_sections').insert({ title: title.trim(), slug: finalSlug, body, sort_order: nextOrder });
      setBusy(false);
      if (error) { setFormErr(error.message); return; }
    }
    setShowForm(false);
    load();
  }

  async function move(s: HelpSection, dir: -1 | 1) {
    const sorted = [...sections].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === s.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    await Promise.all([
      supabase.from('help_sections').update({ sort_order: other.sort_order }).eq('id', s.id),
      supabase.from('help_sections').update({ sort_order: s.sort_order }).eq('id', other.id),
    ]);
    load();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    await supabase.from('help_sections').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    load();
  }

  return (
    <div className="space-y-5 lm-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <LifeBuoy size={20} className="text-[var(--terracotta)]" />
          <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Help content</h1>
        </div>
        <Button onClick={openNew}><Plus size={16} /> Add section</Button>
      </div>

      <p className="text-sm text-[var(--ink-soft)]">These sections appear on every teacher's Help &amp; Resources page. Edit them anytime — no new build needed.</p>

      {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>}

      {loading ? <Spinner label="Loading sections…" /> : sections.length === 0 ? (
        <Card className="p-5"><EmptyState title="No help sections yet" hint="Add one to build your teacher guide." /></Card>
      ) : (
        <div className="space-y-3">
          {sections.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-[var(--ink)]">{s.title}</p>
                  <p className="text-xs text-[var(--ink-soft)] mt-0.5">/{s.slug}</p>
                  <p className="text-sm text-[var(--ink-soft)] mt-2 whitespace-pre-wrap line-clamp-2">{s.body}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex flex-col">
                    <button onClick={() => move(s, -1)} className="p-1 text-[var(--ink-soft)] hover:text-[var(--ink)]"><ArrowUp size={14} /></button>
                    <button onClick={() => move(s, 1)} className="p-1 text-[var(--ink-soft)] hover:text-[var(--ink)]"><ArrowDown size={14} /></button>
                  </div>
                  <button onClick={() => openEdit(s)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[var(--cream-deep)] hover:text-[var(--terracotta)]"><Pencil size={15} /></button>
                  <button onClick={() => setConfirmDelete(s)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={15} /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit section' : 'Add help section'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Taking Attendance" />
          <Input label="Slug (optional)" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generated from title" />
          <label className="block">
            <span className="lm-label block mb-1.5">Body</span>
            <textarea className="lm-input h-40" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the guide content. Line breaks are preserved." />
          </label>
          {formErr && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{formErr}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Delete section?"
        message={`Delete "${confirmDelete?.title}"? It will disappear from the teacher help page.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
