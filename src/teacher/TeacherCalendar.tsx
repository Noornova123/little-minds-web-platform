import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useClassContext } from '@/teacher/useClassContext';
import type { Activity, AttendanceRow, DailyCheckpoint } from '@/lib/types';
import { Card, Spinner, EmptyState, Badge } from '@/components/ui';
import { Modal } from '@/components/Modal';

interface DayStatus {
  date: string;
  activityDone: boolean;
  attendanceMarked: boolean;
  presentCount: number;
  absentCount: number;
  hasMonthlyCheck: boolean;
  checkpointResults: { correct: number; incorrect: number };
  activityTitle: string | null;
  activityDayNumber: number | null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function TeacherCalendar() {
  const { selectedClass, students } = useClassContext();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [loading, setLoading] = useState(true);
  const [dayMap, setDayMap] = useState<Record<string, DayStatus>>({});
  const [selectedDay, setSelectedDay] = useState<DayStatus | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  useEffect(() => {
    if (!selectedClass) { setDayMap({}); setLoading(false); return; }
    let active = true;
    (async () => {
      setLoading(true);
      const start = new Date(year, month, 1).toISOString().slice(0, 10);
      const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);

      const [att, cps, mc] = await Promise.all([
        supabase.from('attendance').select('*').eq('class_id', selectedClass.id).gte('date', start).lte('date', end),
        supabase.from('daily_checkpoints').select('*, activity:activities(id, title, day_number)').in('student_id', students.map((s) => s.id)).gte('date', start).lte('date', end),
        supabase.from('monthly_checks').select('month').in('student_id', students.map((s) => s.id)),
      ]);

      if (!active) return;

      const map: Record<string, DayStatus> = {};
      const todayStr = new Date().toISOString().slice(0, 10);

      // Attendance grouping by date.
      for (const a of (att.data as AttendanceRow[]) ?? []) {
        const key = a.date;
        if (!map[key]) map[key] = blankDay(key);
        map[key].attendanceMarked = true;
        if (a.status === 'present') map[key].presentCount++;
        else map[key].absentCount++;
      }

      // Checkpoints grouped by date — also tells us activity was done.
      for (const c of (cps.data as (DailyCheckpoint & { activity: { id: string; title: string; day_number: number } | null })[]) ?? []) {
        const key = c.date;
        if (!map[key]) map[key] = blankDay(key);
        map[key].activityDone = true;
        if (!map[key].activityTitle && c.activity) {
          map[key].activityTitle = c.activity.title;
          map[key].activityDayNumber = c.activity.day_number;
        }
        if (c.answer_correct) map[key].checkpointResults.correct++;
        else map[key].checkpointResults.incorrect++;
      }

      // Monthly checks — mark a dot on the 1st of that month for visibility.
      for (const m of (mc.data as { month: string }[]) ?? []) {
        const mDate = new Date(m.month + 'T00:00:00');
        if (mDate.getFullYear() === year && mDate.getMonth() === month) {
          const key = new Date(mDate.getFullYear(), mDate.getMonth(), 1).toISOString().slice(0, 10);
          if (!map[key]) map[key] = blankDay(key);
          map[key].hasMonthlyCheck = true;
        }
      }

      setDayMap(map);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [selectedClass, students, year, month]);

  const grid = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const todayStr = new Date().toISOString().slice(0, 10);

  if (!selectedClass) {
    return <Card className="p-5"><EmptyState icon={<CalendarDays size={36} />} title="Select a class" hint="Pick a class to see its calendar." /></Card>;
  }

  return (
    <div className="space-y-5 lm-fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays size={20} className="text-[var(--terracotta)]" />
          <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Calendar</h1>
        </div>
        <Badge tone="neutral">{selectedClass.name}</Badge>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="p-2 rounded-lg hover:bg-[var(--cream-deep)] text-[var(--ink-soft)]"><ChevronLeft size={18} /></button>
          <h2 className="font-extrabold text-[var(--ink)]">{MONTHS[month]} {year}</h2>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="p-2 rounded-lg hover:bg-[var(--cream-deep)] text-[var(--ink-soft)]"><ChevronRight size={18} /></button>
        </div>

        {loading ? <Spinner label="Loading calendar…" /> : (
          <>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DOW.map((d) => <div key={d} className="text-center text-[10px] font-extrabold uppercase text-[var(--ink-soft)] py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((day, i) => {
                if (day === null) return <div key={i} />;
                const dateStr = new Date(year, month, day).toISOString().slice(0, 10);
                const st = dayMap[dateStr];
                const isPast = dateStr < todayStr;
                const isToday = dateStr === todayStr;
                const dot = st?.activityDone ? 'bg-[var(--sage)]' : st?.attendanceMarked ? 'bg-[var(--ink-soft)]/30' : 'bg-transparent';
                return (
                  <button
                    key={i}
                    onClick={() => isPast && st && setSelectedDay(st)}
                    className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-start gap-0.5 text-xs transition-colors ${isToday ? 'ring-2 ring-[var(--terracotta)]' : ''} ${isPast && st ? 'hover:bg-[var(--cream-deep)] cursor-pointer' : 'cursor-default'}`}
                    style={{ background: st?.activityDone ? 'var(--sage-soft, #ecfdf5)' : st?.attendanceMarked ? 'var(--cream-deep)' : 'transparent' }}
                  >
                    <span className={`font-bold ${st?.activityDone ? 'text-[var(--sage-deep)]' : 'text-[var(--ink)]'}`}>{day}</span>
                    {st?.activityDone && <span className="w-1.5 h-1.5 rounded-full bg-[var(--sage)]" />}
                    {st?.hasMonthlyCheck && <span className="w-1.5 h-1.5 rounded-full bg-[var(--terracotta)]" />}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-[var(--line)] text-xs text-[var(--ink-soft)]">
              <Legend color="var(--sage)" label="Activity completed" />
              <Legend color="var(--cream-deep)" label="Attendance only" />
              <Legend color="var(--terracotta)" label="Monthly deep-check" dot />
            </div>
          </>
        )}
      </Card>

      <Modal
        open={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? formatDay(selectedDay.date) : ''}
        size="md"
      >
        {selectedDay && <DaySummary status={selectedDay} />}
      </Modal>
    </div>
  );
}

function blankDay(date: string): DayStatus {
  return { date, activityDone: false, attendanceMarked: false, presentCount: 0, absentCount: 0, hasMonthlyCheck: false, checkpointResults: { correct: 0, incorrect: 0 }, activityTitle: null, activityDayNumber: null };
}

function formatDay(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function Legend({ color, label, dot }: { color: string; label: string; dot?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {dot ? <span className="w-2 h-2 rounded-full" style={{ background: color }} /> : <span className="w-3 h-3 rounded" style={{ background: color }} />}
      <span>{label}</span>
    </div>
  );
}

function DaySummary({ status }: { status: DayStatus }) {
  const total = status.presentCount + status.absentCount;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <SummaryStat label="Attendance" value={total > 0 ? `${status.presentCount} present · ${status.absentCount} absent` : 'Not marked'} />
        <SummaryStat label="Activity" value={status.activityDone ? (status.activityTitle ?? 'Completed') : 'Not done'} />
      </div>
      {status.activityDone && (
        <div className="rounded-xl border border-[var(--line)] p-4">
          <p className="text-xs font-extrabold uppercase text-[var(--ink-soft)] mb-2">Checkpoint results</p>
          <div className="flex gap-4">
            <span className="text-sm font-bold text-[var(--sage-deep)]">{status.checkpointResults.correct} correct</span>
            <span className="text-sm font-bold text-[#dc2626]">{status.checkpointResults.incorrect} incorrect</span>
          </div>
        </div>
      )}
      {status.hasMonthlyCheck && <p className="text-sm text-[var(--terracotta)] font-semibold flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--terracotta)]" /> Monthly deep-check recorded this month</p>}
      {!status.activityDone && !status.attendanceMarked && !status.hasMonthlyCheck && (
        <p className="text-sm text-[var(--ink-soft)]">No activity recorded for this day.</p>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--cream-deep)] p-3">
      <p className="text-xs font-extrabold uppercase text-[var(--ink-soft)]">{label}</p>
      <p className="text-sm font-bold text-[var(--ink)] mt-1">{value}</p>
    </div>
  );
}
