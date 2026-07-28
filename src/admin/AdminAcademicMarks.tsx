import { useEffect, useState } from 'react';
import { Plus, Trash2, BookMarked, ClipboardList, ArrowUp, ArrowDown, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AcademicSubject, ExamName, School } from '@/lib/types';
import { Card, Button, Input, Spinner, EmptyState, Badge } from '@/components/ui';
import { ConfirmDialog } from '@/components/Modal';

export function AdminAcademicMarks() {
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState<string>('');
  const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
  const [exams, setExams] = useState<ExamName[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('schools').select('*').order('name');
      const list = (data as School[]) ?? [];
      setSchools(list);
      if (list.length > 0 && !schoolId) setSchoolId(list[0].id);
      if (list.length === 0) setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    let active = true;
    (async () => {
      setLoading(true);
      const [s, e] = await Promise.all([
        supabase.from('academic_subjects').select('*').eq('school_id', schoolId).order('display_order', { ascending: true }),
        supabase.from('exam_names').select('*').eq('school_id', schoolId).order('display_order', { ascending: true }),
      ]);
      if (!active) return;
      setSubjects((s.data as AcademicSubject[]) ?? []);
      setExams((e.data as ExamName[]) ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [schoolId]);

  const selectedSchool = schools.find((s) => s.id === schoolId);

  return (
    <div className="space-y-5 lm-fade-up">
      <div className="flex items-center gap-2">
        <ClipboardList size={20} className="text-[var(--terracotta)]" />
        <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Academic Marks</h1>
      </div>
      <p className="text-sm text-[var(--ink-soft)]">Manage the subjects and exam names teachers can choose from when entering marks. These are configured per school.</p>

      {schools.length === 0 ? (
        <Card className="p-5"><EmptyState title="No schools yet" hint="Create a school first to configure academic marks." /></Card>
      ) : (
        <>
          <Card className="p-4">
            <label className="block">
              <span className="lm-label block mb-1.5 flex items-center gap-1.5"><Building2 size={14} /> School</span>
              <select className="lm-input" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </Card>

          {loading ? <Spinner label="Loading…" /> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <NameList
                title="Subjects"
                icon={<BookMarked size={18} />}
                tone="var(--terracotta)"
                items={subjects}
                schoolId={schoolId}
                table="academic_subjects"
                onReload={() => loadBoth(schoolId, setSubjects, setExams)}
                placeholder="e.g. Math, Science, English"
                emptyHint="Add subjects teachers can select when entering marks."
              />
              <NameList
                title="Exam Names"
                icon={<ClipboardList size={18} />}
                tone="var(--sky)"
                items={exams}
                schoolId={schoolId}
                table="exam_names"
                onReload={() => loadBoth(schoolId, setSubjects, setExams)}
                placeholder="e.g. Half Yearly, Yearly"
                emptyHint="Add exam names teachers can select when entering marks."
              />
            </div>
          )}

          {selectedSchool && subjects.length === 0 && exams.length === 0 && !loading && (
            <Card className="p-4">
              <p className="text-sm text-[var(--ink-soft)]">Once you add subjects and exam names, teachers at <span className="font-bold text-[var(--ink)]">{selectedSchool.name}</span> will see them in their Marks Entry screen.</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

async function loadBoth(schoolId: string, setSubjects: (v: AcademicSubject[]) => void, setExams: (v: ExamName[]) => void) {
  const [s, e] = await Promise.all([
    supabase.from('academic_subjects').select('*').eq('school_id', schoolId).order('display_order', { ascending: true }),
    supabase.from('exam_names').select('*').eq('school_id', schoolId).order('display_order', { ascending: true }),
  ]);
  setSubjects((s.data as AcademicSubject[]) ?? []);
  setExams((e.data as ExamName[]) ?? []);
}

interface NameListProps {
  title: string;
  icon: React.ReactNode;
  tone: string;
  items: { id: string; name: string; display_order: number }[];
  schoolId: string;
  table: 'academic_subjects' | 'exam_names';
  onReload: () => void;
  placeholder: string;
  emptyHint: string;
}

function NameList({ title, icon, tone, items, schoolId, table, onReload, placeholder, emptyHint }: NameListProps) {
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true); setErr(null);
    const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.display_order)) + 1 : 1;
    const { error } = await supabase.from(table).insert({ school_id: schoolId, name: newName.trim(), display_order: nextOrder });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setNewName('');
    onReload();
  }

  async function rename(id: string, name: string) {
    await supabase.from(table).update({ name }).eq('id', id);
    onReload();
  }

  async function move(item: { id: string; display_order: number }, dir: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((x) => x.id === item.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    await Promise.all([
      supabase.from(table).update({ display_order: other.display_order }).eq('id', item.id),
      supabase.from(table).update({ display_order: item.display_order }).eq('id', other.id),
    ]);
    onReload();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    await supabase.from(table).delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    onReload();
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: tone }}>{icon}</span>
        <h3 className="font-extrabold text-[var(--ink)]">{title}</h3>
        <Badge tone="neutral">{items.length}</Badge>
      </div>
      <p className="text-sm text-[var(--ink-soft)] mb-4">{emptyHint}</p>

      <form onSubmit={add} className="flex gap-2 mb-4">
        <Input className="flex-1" placeholder={placeholder} value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button type="submit" disabled={busy || !newName.trim()}><Plus size={16} /> Add</Button>
      </form>
      {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2 mb-3">{err}</p>}

      {items.length === 0 ? (
        <EmptyState title={`No ${title.toLowerCase()} yet`} hint="Add one to get started." />
      ) : (
        <div className="divide-y divide-[var(--line)]">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 py-2.5">
              <div className="flex flex-col">
                <button onClick={() => move(item, -1)} className="p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)]"><ArrowUp size={14} /></button>
                <button onClick={() => move(item, 1)} className="p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)]"><ArrowDown size={14} /></button>
              </div>
              <input
                className="lm-input flex-1 font-bold"
                value={item.name}
                onChange={(e) => {
                  // optimistic local update not needed; we reload on blur
                }}
                onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== item.name) rename(item.id, e.target.value.trim()); }}
              />
              <button onClick={() => setConfirmDelete({ id: item.id, name: item.name })} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title={`Delete ${title.toLowerCase().replace(/s$/, '')}?`}
        message={`Delete "${confirmDelete?.name}"? Already-recorded marks keep their value — only the dropdown option is removed.`}
        confirmLabel="Delete"
        danger
      />
    </Card>
  );
}
