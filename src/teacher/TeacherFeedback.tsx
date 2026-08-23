import { useEffect, useState } from 'react';
import { MessageSquarePlus, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, Spinner, EmptyState } from '@/components/ui';
import { useClassContext } from '@/teacher/useClassContext';
import { ClassSelector } from '@/teacher/ClassSelector';
import { navigate } from '@/lib/router';

export function TeacherFeedback() {
  const { classes, selectedClass, students, loading, selectClass } = useClassContext();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countsLoading, setCountsLoading] = useState(true);

  useEffect(() => {
    if (students.length === 0) { setCounts({}); setCountsLoading(false); return; }
    setCountsLoading(true);
    supabase.from('teacher_feedback').select('student_id').in('student_id', students.map((s) => s.id)).then(({ data }) => {
      const map: Record<string, number> = {};
      for (const row of data ?? []) map[row.student_id] = (map[row.student_id] ?? 0) + 1;
      setCounts(map);
      setCountsLoading(false);
    });
  }, [students]);

  if (loading) return <Spinner label="Loading class…" />;

  return (
    <div className="space-y-5 lm-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Feedback</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-0.5">Pick a student to add or review their subject-wise monthly feedback.</p>
        </div>
        <ClassSelector classes={classes} selected={selectedClass} onSelect={selectClass} />
      </div>

      {students.length === 0 ? (
        <Card><EmptyState icon={<MessageSquarePlus size={36} />} title="No students in this class yet" /></Card>
      ) : (
        <Card className="p-2">
          <div className="divide-y divide-[var(--line)]">
            {students.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/dashboard/feedback/${s.id}`)}
                className="w-full flex items-center justify-between gap-3 px-3 py-3.5 text-left hover:bg-[var(--cream-deep)] rounded-xl transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-bold text-[var(--ink)]">{s.roll_number}. {s.name}</p>
                  <p className="text-xs text-[var(--ink-soft)] mt-0.5">
                    {countsLoading ? 'Loading…' : `${counts[s.id] ?? 0} feedback entr${(counts[s.id] ?? 0) === 1 ? 'y' : 'ies'}`}
                  </p>
                </div>
                <ChevronRight size={18} className="text-[var(--ink-soft)] shrink-0" />
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
