import { ArrowLeft, Stethoscope, ChevronRight } from 'lucide-react';
import { navigate } from '@/lib/router';
import { Card, Spinner, EmptyState } from '@/components/ui';
import { useClassContext } from '@/teacher/useClassContext';
import { ClassSelector } from '@/teacher/ClassSelector';

export function Diagnostics() {
  const { classes, selectedClass, students, loading, selectClass } = useClassContext();

  return (
    <div className="space-y-5 lm-fade-up">
      <button onClick={() => navigate('/dashboard')} className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ink-soft)] hover:text-[var(--terracotta)]">
        <ArrowLeft size={16} /> Class home
      </button>

      <ClassSelector classes={classes} selected={selectedClass} onSelect={selectClass} />

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <Stethoscope size={20} className="text-[var(--terracotta)]" />
          <h1 className="text-xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Diagnostics</h1>
        </div>
        <p className="text-sm text-[var(--ink-soft)] mb-4">
          Pick a student to screen them in a subject, or view their past diagnostic reports.
        </p>

        {loading ? <Spinner label="Loading…" /> : !selectedClass ? (
          <EmptyState title="Select a class" />
        ) : students.length === 0 ? (
          <EmptyState title="No students in this class" />
        ) : (
          <div className="space-y-2">
            {students.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/dashboard/diagnostics/${s.id}`)}
                className="w-full flex items-center gap-3 rounded-2xl border border-[var(--line)] p-3 text-left hover:border-[var(--terracotta-soft)] hover:bg-[var(--coral-soft)] transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[var(--cream-deep)] flex items-center justify-center text-xs font-extrabold text-[var(--ink-soft)] shrink-0">{s.roll_number}</div>
                <span className="flex-1 font-bold text-[var(--ink)]">{s.name}</span>
                <ChevronRight size={16} className="text-[var(--ink-soft)]" />
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
