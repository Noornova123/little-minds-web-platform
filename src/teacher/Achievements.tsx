import { useState, useEffect } from 'react';
import { Award, Plus, Trash2, Loader2, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Achievement } from '@/lib/types';
import { Button, Input, Spinner, EmptyState } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/Modal';

export function AchievementsSection({ studentId, studentName, achievements, onReload }: {
  studentId: string;
  studentName: string;
  achievements: Achievement[];
  onReload: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<Achievement | null>(null);

  async function save() {
    if (!title.trim()) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.from('achievements').insert({
      student_id: studentId,
      title: title.trim(),
      description: desc.trim() || null,
      achievement_date: date,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setShowAdd(false); setTitle(''); setDesc(''); setDate(new Date().toISOString().slice(0, 10));
    onReload();
  }

  async function doDelete() {
    if (!confirmDel) return;
    await supabase.from('achievements').delete().eq('id', confirmDel.id);
    setConfirmDel(null);
    onReload();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Award size={18} className="text-[var(--amber)]" />
          <h3 className="font-extrabold text-[var(--ink)]">Achievements</h3>
          <span className="lm-chip bg-[var(--sunny-soft)] text-[var(--amber)]">{achievements.length}</span>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setShowAdd(true)}><Plus size={14} /> Add</Button>
      </div>

      {achievements.length === 0 ? (
        <EmptyState icon={<Star size={28} />} title="No achievements yet" hint="Add badges, certificates, or milestones to celebrate this student's progress." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {achievements.map((a) => (
            <div key={a.id} className="flex items-start gap-3 p-3 rounded-2xl bg-[var(--sunny-soft)] border border-[var(--amber)]/20">
              <div className="w-8 h-8 rounded-xl bg-[var(--amber)] flex items-center justify-center text-white shrink-0">
                <Star size={16} fill="white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[var(--ink)] text-sm">{a.title}</p>
                {a.description && <p className="text-xs text-[var(--ink-soft)] mt-0.5 line-clamp-2">{a.description}</p>}
                <p className="text-[10px] text-[var(--ink-soft)] mt-1">{new Date(a.achievement_date).toLocaleDateString()}</p>
              </div>
              <button onClick={() => setConfirmDel(a)} className="p-1 text-[var(--ink-soft)] hover:text-[#dc2626]"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title={`Add achievement · ${studentName}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !title.trim()}>
              {busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Most Improved Student" />
          <label className="block">
            <span className="lm-label block mb-1.5">Description (optional)</span>
            <textarea className="lm-input h-20" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="A short note about this achievement…" maxLength={200} />
          </label>
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={doDelete}
        title="Delete achievement?"
        message={`Delete "${confirmDel?.title}"? This will remove it from the student's report.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
