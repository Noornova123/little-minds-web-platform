import { useEffect, useState } from 'react';
import { Megaphone, Plus, Pencil, Trash2, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Notification } from '@/lib/types';
import { Card, Button, Input, Spinner, EmptyState, Badge } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/Modal';

interface NotifWithReads extends Notification {
  read_count: number;
  total_teachers: number;
}

export function AdminAnnouncements() {
  const [rows, setRows] = useState<NotifWithReads[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [editing, setEditing] = useState<Notification | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Notification | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    const [{ data: notifs }, { data: reads }, { count: teacherCount }] = await Promise.all([
      supabase.from('notifications').select('*').order('created_at', { ascending: false }),
      supabase.from('notification_reads').select('notification_id'),
      supabase.from('teachers').select('id', { count: 'exact', head: true }),
    ]);
    const readCounts: Record<string, number> = {};
    for (const r of (reads as { notification_id: string }[]) ?? []) {
      readCounts[r.notification_id] = (readCounts[r.notification_id] ?? 0) + 1;
    }
    const total = teacherCount ?? 0;
    setRows(((notifs as Notification[]) ?? []).map((n) => ({ ...n, read_count: readCounts[n.id] ?? 0, total_teachers: total })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null); setTitle(''); setBody(''); setFormErr(null); setShowForm(true);
  }
  function openEdit(n: Notification) {
    setEditing(n); setTitle(n.title); setBody(n.body); setFormErr(null); setShowForm(true);
  }

  async function save() {
    if (!title.trim()) { setFormErr('Title is required.'); return; }
    setBusy(true); setFormErr(null);
    if (editing) {
      const { error } = await supabase.from('notifications').update({ title: title.trim(), body, updated_at: new Date().toISOString() }).eq('id', editing.id);
      setBusy(false);
      if (error) { setFormErr(error.message); return; }
    } else {
      const { error } = await supabase.from('notifications').insert({ title: title.trim(), body });
      setBusy(false);
      if (error) { setFormErr(error.message); return; }
    }
    setShowForm(false);
    load();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    await supabase.from('notifications').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    load();
  }

  return (
    <div className="space-y-5 lm-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Megaphone size={20} className="text-[var(--terracotta)]" />
          <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Announcements</h1>
        </div>
        <Button onClick={openNew}><Plus size={16} /> New announcement</Button>
      </div>

      {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>}

      {loading ? <Spinner label="Loading announcements…" /> : rows.length === 0 ? (
        <Card className="p-5"><EmptyState icon={<Megaphone size={36} />} title="No announcements yet" hint="Create one to send an update to all teachers." /></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((n) => (
            <Card key={n.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-[var(--ink)]">{n.title}</p>
                  <p className="text-xs text-[var(--ink-soft)] mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                  {n.body && <p className="text-sm text-[var(--ink-soft)] mt-2 whitespace-pre-wrap line-clamp-3">{n.body}</p>}
                  <div className="flex items-center gap-2 mt-3">
                    <Badge tone={n.read_count > 0 ? 'success' : 'neutral'}>
                      <Eye size={11} className="inline mr-1" />{n.read_count} read
                    </Badge>
                    <Badge tone="neutral">
                      <EyeOff size={11} className="inline mr-1" />{Math.max(0, n.total_teachers - n.read_count)} unread
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(n)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[var(--cream-deep)] hover:text-[var(--terracotta)]"><Pencil size={15} /></button>
                  <button onClick={() => setConfirmDelete(n)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={15} /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit announcement' : 'New announcement'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New activities for Week 5" />
          <label className="block">
            <span className="lm-label block mb-1.5">Message</span>
            <textarea className="lm-input h-32" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your announcement…" />
          </label>
          {formErr && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{formErr}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Delete announcement?"
        message={`Delete "${confirmDelete?.title}"? Teachers who already saw it will lose it from their bell too.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
