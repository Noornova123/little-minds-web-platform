import { useEffect, useState } from 'react';
import { StickyNote, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { AnecdotalNote, NoteDomain } from '@/lib/types';
import { Button, Spinner } from '@/components/ui';
import { Modal } from '@/components/Modal';

const DOMAINS: { value: NoteDomain; label: string; tone: string }[] = [
  { value: 'social_emotional', label: 'Social-Emotional', tone: 'var(--coral)' },
  { value: 'life_skills', label: 'Life Skills', tone: 'var(--sky)' },
  { value: 'academic', label: 'Academic', tone: 'var(--terracotta)' },
];

export function QuickNoteButton({ studentId, studentName }: { studentId: string; studentName: string }) {
  const { teacher } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [domain, setDomain] = useState<NoteDomain>('social_emotional');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!text.trim() || !teacher) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.from('anecdotal_notes').insert({
      student_id: studentId,
      teacher_id: teacher.id,
      note_text: text.trim(),
      tagged_domain: domain,
      date: new Date().toISOString().slice(0, 10),
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOpen(false); setText('');
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lm-chip bg-[var(--sunny-soft)] text-[var(--amber)] hover:bg-[var(--sunny)] hover:text-white transition-colors cursor-pointer"
      >
        <StickyNote size={13} /> Quick note
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Quick note · ${studentName}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !text.trim()}>
              {busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save note'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="lm-label block mb-1.5">Observation</span>
            <textarea
              className="lm-input h-20"
              placeholder="One quick line about this student…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={200}
            />
            <span className="text-xs text-[var(--ink-soft)] mt-1 block">{text.length}/200</span>
          </label>
          <div>
            <span className="lm-label block mb-1.5">Tag</span>
            <div className="flex gap-2">
              {DOMAINS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDomain(d.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${domain === d.value ? 'text-white' : 'bg-[var(--cream-deep)] text-[var(--ink-soft)]'}`}
                  style={domain === d.value ? { background: d.tone } : {}}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>}
        </div>
      </Modal>
    </>
  );
}

export function NotesList({ notes, onDelete }: { notes: AnecdotalNote[]; onDelete?: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(id: string) {
    setBusyId(id);
    await supabase.from('anecdotal_notes').delete().eq('id', id);
    setBusyId(null);
    onDelete?.();
  }

  if (notes.length === 0) return null;

  return (
    <div className="space-y-2">
      {notes.map((n) => {
        const d = DOMAINS.find((x) => x.value === n.tagged_domain);
        return (
          <div key={n.id} className="flex items-start gap-2 rounded-xl bg-[var(--cream-deep)] p-3">
            <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: d?.tone ?? 'var(--ink-soft)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--ink)]">{n.note_text}</p>
              <p className="text-xs text-[var(--ink-soft)] mt-0.5">{d?.label} · {new Date(n.date).toLocaleDateString()}</p>
            </div>
            {onDelete && (
              <button onClick={() => remove(n.id)} disabled={busyId === n.id} className="p-1 text-[var(--ink-soft)] hover:text-[#dc2626]">
                {busyId === n.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
