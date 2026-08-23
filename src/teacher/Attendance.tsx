import { useEffect, useState } from 'react';
import { ArrowLeft, Check, X, CalendarCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import type { AttendanceRow } from '@/lib/types';
import { Card, Button, Spinner, EmptyState } from '@/components/ui';
import { StudentAvatar } from '@/components/StudentAvatar';
import { useClassContext } from '@/teacher/useClassContext';
import { ClassSelector } from '@/teacher/ClassSelector';

export function Attendance() {
  const { classes, selectedClass, students, loading, selectClass, refresh } = useClassContext();
  const [records, setRecords] = useState<Record<string, 'present' | 'absent'>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!selectedClass) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from('attendance').select('*').eq('class_id', selectedClass.id).eq('date', today);
      if (!active) return;
      const map: Record<string, 'present' | 'absent'> = {};
      (data as AttendanceRow[] | null)?.forEach((a) => { map[a.student_id] = a.status; });
      // Default everyone present if no record yet.
      students.forEach((s) => { if (!(s.id in map)) map[s.id] = 'present'; });
      setRecords(map);
      setSaved(((data as AttendanceRow[] | null)?.length ?? 0) > 0);
    })();
    return () => { active = false; };
  }, [selectedClass, today, students]);

  function setStatus(studentId: string, status: 'present' | 'absent') {
    setRecords((p) => ({ ...p, [studentId]: status }));
    setSaved(false);
  }

  function markAll(status: 'present' | 'absent') {
    const map: Record<string, 'present' | 'absent'> = {};
    students.forEach((s) => { map[s.id] = status; });
    setRecords(map);
    setSaved(false);
  }

  async function save() {
    if (!selectedClass) return;
    setSaving(true);
    // Upsert each record. The unique constraint (class_id, student_id, date) handles dups.
    const rows = students.map((s) => ({
      class_id: selectedClass.id,
      student_id: s.id,
      date: today,
      status: records[s.id] ?? 'present',
    }));
    // Delete existing for today then insert (simplest upsert for this scope).
    await supabase.from('attendance').delete().eq('class_id', selectedClass.id).eq('date', today);
    const { error } = await supabase.from('attendance').insert(rows);
    setSaving(false);
    if (error) { alert(error.message); return; }
    setSaved(true);
    refresh();
  }

  if (loading) return <Spinner label="Loading…" />;

  return (
    <div className="space-y-5 lm-fade-up">
      <button onClick={() => navigate('/dashboard')} className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ink-soft)] hover:text-[var(--terracotta)]">
        <ArrowLeft size={16} /> Class home
      </button>

      <ClassSelector classes={classes} selected={selectedClass} onSelect={selectClass} />

      <Card className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <CalendarCheck size={20} className="text-[var(--sage-deep)]" />
            <h1 className="text-xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Attendance</h1>
          </div>
          <span className="text-sm font-bold text-[var(--ink-soft)]">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        </div>
        <p className="text-sm text-[var(--ink-soft)] mb-4">Mark everyone before starting today's activity.</p>

        <div className="flex gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={() => markAll('present')}>Mark all present</Button>
          <Button variant="ghost" size="sm" onClick={() => markAll('absent')}>Mark all absent</Button>
        </div>

        {students.length === 0 ? <EmptyState title="No students" /> : (
          <div className="space-y-2">
            {students.map((s) => {
              const status = records[s.id] ?? 'present';
              return (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--line)]">
                  <StudentAvatar id={s.id} name={s.name} photoUrl={s.photo_url} size="sm" />
                  <span className="font-bold text-[var(--ink)] text-sm flex-1 truncate">{s.name}</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setStatus(s.id, 'present')}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${status === 'present' ? 'bg-[var(--sage)] text-white' : 'bg-[var(--cream-deep)] text-[var(--ink-soft)] hover:bg-[#e4e4e7]'}`}
                    >
                      <Check size={18} />
                    </button>
                    <button
                      onClick={() => setStatus(s.id, 'absent')}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${status === 'absent' ? 'bg-[#dc2626] text-white' : 'bg-[var(--cream-deep)] text-[var(--ink-soft)] hover:bg-[#e4e4e7]'}`}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {students.length > 0 && (
          <div className="mt-5 flex items-center justify-between gap-3">
            {saved && <p className="text-sm font-bold text-[var(--sage-deep)]">Saved — you can start today's activity.</p>}
            <div className="flex gap-2 ml-auto">
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>Cancel</Button>
              <Button onClick={save} disabled={saving || students.length === 0}>{saving ? 'Saving…' : saved ? 'Update & continue' : 'Save attendance'}</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
