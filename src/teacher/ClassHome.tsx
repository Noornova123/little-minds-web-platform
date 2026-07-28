import { useEffect, useState } from 'react';
import { CalendarCheck, Play, FileText, Flame, Users, Lock, Library, Sparkles, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import type { Activity, AttendanceRow, Banner, ChecklistResponse } from '@/lib/types';
import { matchesGrade } from '@/lib/types';
import { Card, Button, Spinner, EmptyState, Badge } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { useClassContext } from '@/teacher/useClassContext';
import { ClassSelector } from '@/teacher/ClassSelector';
import { BannerCarousel } from '@/teacher/BannerCarousel';
import { QuickNoteButton } from '@/teacher/QuickNote';
import { useAuth } from '@/lib/auth';

export function ClassHome() {
  const { school, classes, selectedClass, students, progress, loading, selectClass } = useClassContext();
  const { teacher } = useAuth();
  const [todayActivity, setTodayActivity] = useState<Activity | null>(null);
  const [attendanceToday, setAttendanceToday] = useState<AttendanceRow[]>([]);
  const [streak, setStreak] = useState(0);
  const [actLoading, setActLoading] = useState(true);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [checklistDue, setChecklistDue] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const currentDay = progress?.current_day ?? 0;
  const daysUnlocked = school?.days_unlocked_up_to ?? 0;
  const classGrade = selectedClass?.grade_level ?? null;

  useEffect(() => {
    if (!selectedClass) { setActLoading(false); return; }
    let active = true;
    (async () => {
      setActLoading(true);
      // Today's activity = the activity for current_day + 1 matching the class's grade level.
      const dayToShow = currentDay + 1;
      let q = supabase.from('activities').select('*').eq('day_number', dayToShow).eq('content_type', 'daily_curriculum');
      if (classGrade) q = q.eq('grade_level', classGrade);
      else q = q.is('grade_level', null);
      const { data: actArr } = await q.order('created_at').limit(1);
      if (!active) return;
      const act = (actArr as Activity[] | null)?.[0] ?? null;
      setTodayActivity(act);

      const { data: att } = await supabase.from('attendance').select('*').eq('class_id', selectedClass.id).eq('date', today);
      if (!active) return;
      setAttendanceToday((att as AttendanceRow[]) ?? []);

      // Streak: count consecutive days up to today with attendance recorded.
      const { data: allAtt } = await supabase.from('attendance').select('date').eq('class_id', selectedClass.id).order('date', { ascending: false });
      if (!active) return;
      const dates = new Set((allAtt as AttendanceRow[] | null)?.map((a) => a.date) ?? []);
      let s = 0;
      const d = new Date();
      for (;;) {
        const ds = d.toISOString().slice(0, 10);
        if (dates.has(ds)) { s++; d.setDate(d.getDate() - 1); } else break;
      }
      setStreak(s);
      setActLoading(false);
    })();
    return () => { active = false; };
  }, [selectedClass, currentDay, today, classGrade]);

  // Load active banners (global, not class-scoped).
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from('banners').select('*').eq('is_active', true).order('display_order', { ascending: true });
      if (!active) return;
      setBanners((data as Banner[]) ?? []);
    })();
    return () => { active = false; };
  }, []);

  // Welcome popup: shows once per fresh login session.
  useEffect(() => {
    if (!teacher || loading) return;
    const flag = sessionStorage.getItem('lm-welcome-shown');
    if (flag === 'pending') {
      setWelcomeOpen(true);
      sessionStorage.setItem('lm-welcome-shown', 'done');
    }
  }, [teacher, loading]);

  // Monthly checklist reminder: show banner if it's a new month and no
  // checklist responses exist for this class this month.
  useEffect(() => {
    if (!selectedClass || students.length === 0) { setChecklistDue(false); return; }
    let active = true;
    (async () => {
      const month = new Date().toISOString().slice(0, 7) + '-01';
      const { count } = await supabase
        .from('checklist_responses')
        .select('id', { count: 'exact', head: true })
        .in('student_id', students.map((s) => s.id))
        .eq('month', month);
      if (active) setChecklistDue((count ?? 0) === 0);
    })();
    return () => { active = false; };
  }, [selectedClass, students]);

  if (loading) return <Spinner label="Loading your class…" />;

  if (classes.length === 0) {
    return (
      <Card><EmptyState icon={<Users size={36} />} title="No classes assigned yet" hint="Your school admin needs to create a class and assign it to you. Once that's done, your classroom will appear here." /></Card>
    );
  }

  if (!selectedClass) {
    return <Card><EmptyState title="Select a class to begin" /></Card>;
  }

  const presentCount = attendanceToday.filter((a) => a.status === 'present').length;
  const attendanceDone = attendanceToday.length > 0;
  const activityLocked = !attendanceDone;
  const allDaysComplete = currentDay >= daysUnlocked && daysUnlocked > 0;

  return (
    <div className="space-y-5 lm-fade-up">
      <ClassSelector classes={classes} selected={selectedClass} onSelect={selectClass} />

      {/* Banner carousel */}
      {banners.length > 0 && <BannerCarousel banners={banners} />}

      {/* Monthly checklist reminder */}
      {checklistDue && (
        <div className="rounded-2xl border-2 border-[var(--amber)] bg-[var(--sunny-soft)] p-4 flex items-center gap-3 lm-fade-up">
          <div className="w-10 h-10 rounded-xl bg-[var(--amber)] flex items-center justify-center text-white shrink-0">
            <AlertCircle size={20} />
          </div>
          <div className="flex-1">
            <p className="font-extrabold text-[var(--ink)] text-sm">Monthly checklist not done yet for {new Date().toLocaleDateString(undefined, { month: 'long' })}</p>
            <p className="text-xs text-[var(--ink-soft)]">Take a few minutes to complete the social-emotional and life skills checklist for your class.</p>
          </div>
          <Button size="sm" onClick={() => navigate('/dashboard/monthly-check')}>Start checklist</Button>
        </div>
      )}

      {/* Summary header with mascot */}
      <Card className="p-5 sm:p-6 lm-card-bouncy" style={{ borderRadius: '1.75rem' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--sunny)] to-[var(--coral)] flex items-center justify-center text-white shrink-0 lm-wiggle" style={{ boxShadow: '0 4px 12px rgba(238, 138, 107, 0.3)' }}>
              <Sparkles size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>{selectedClass.name}</h1>
              <p className="text-sm text-[var(--ink-soft)] mt-0.5">{students.length} students · {school?.name}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Stat icon={<Flame size={16} />} value={streak} label="day streak" tone="var(--terracotta)" bg="var(--coral-soft)" />
            <Stat icon={<CalendarCheck size={16} />} value={`${currentDay}/${daysUnlocked}`} label="days done" tone="var(--sage-deep)" bg="var(--sage-soft)" />
          </div>
        </div>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ActionCard icon={<CalendarCheck />} title="Attendance" subtitle={attendanceDone ? `${presentCount}/${students.length} present` : 'Not done today'} tone="var(--sage-deep)" pop="var(--sage-soft)" onClick={() => navigate('/dashboard/attendance')} done={attendanceDone} />
        <ActionCard icon={<Play />} title="Today's Activity" subtitle={todayActivity ? todayActivity.title : allDaysComplete ? 'All caught up' : 'Not set'} tone="var(--terracotta)" pop="var(--coral-soft)" onClick={() => todayActivity && navigate(`/dashboard/activity/${todayActivity.id}`)} locked={activityLocked || !todayActivity} />
        <ActionCard icon={<Library />} title="Content Library" subtitle="Browse all activities" tone="var(--sky)" pop="var(--sky-soft)" onClick={() => navigate('/dashboard/library')} />
        <ActionCard icon={<FileText />} title="Reports" subtitle="Class & student growth" tone="var(--amber)" pop="var(--sunny-soft)" onClick={() => navigate('/dashboard/reports')} />
      </div>

      {/* Today's activity preview */}
      {actLoading ? <Spinner label="Loading today's activity…" /> : todayActivity ? (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Badge tone={todayActivity.category === 'focus' ? 'focus' : todayActivity.category === 'brain' ? 'brain' : 'behaviour'}>{todayActivity.category}</Badge>
            <span className="text-xs font-bold text-[var(--ink-soft)]">Day {todayActivity.day_number} · {todayActivity.duration_minutes} min</span>
          </div>
          <h3 className="text-lg font-extrabold text-[var(--ink)] mb-1" style={{ fontFamily: 'Fraunces, serif' }}>{todayActivity.title}</h3>
          <p className="text-sm text-[var(--ink-soft)] line-clamp-2 mb-3">{todayActivity.written_instructions?.slice(0, 160) ?? 'No written instructions.'}</p>
          <Button onClick={() => todayActivity && navigate(`/dashboard/activity/${todayActivity.id}`)} disabled={activityLocked || !todayActivity}>
            {activityLocked ? <><Lock size={16} /> Do attendance first</> : <><Play size={16} /> Start activity</>}
          </Button>
        </Card>
      ) : allDaysComplete ? (
        <Card className="p-5"><EmptyState icon={<Flame size={32} />} title="All unlocked days complete!" hint={`Your class has finished all ${daysUnlocked} unlocked days. More days unlock as your school's plan progresses.`} /></Card>
      ) : (
        <Card className="p-5"><EmptyState title="Content not yet added for this grade level" hint={`Day ${currentDay + 1} content for ${classGrade ?? 'this class'}'s grade hasn't been created yet. Your admin is working on it.`} /></Card>
      )}

      {/* Roster */}
      <Card className="p-5">
        <h3 className="font-extrabold text-[var(--ink)] mb-3">Roster · {students.length} students</h3>
        {students.length === 0 ? (
          <EmptyState title="No students in this class" hint="Your admin can bulk-upload students from the school detail page." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {students.map((s) => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2.5 rounded-2xl hover:bg-[var(--cream-deep)] transition-colors">
                <button onClick={() => navigate(`/dashboard/reports/${s.id}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--sunny-soft)] to-[var(--coral-soft)] flex items-center justify-center text-xs font-extrabold text-[var(--ink-soft)]">{s.roll_number}</div>
                  <span className="font-bold text-[var(--ink)] text-sm flex-1 truncate">{s.name}</span>
                </button>
                <QuickNoteButton studentId={s.id} studentName={s.name} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Welcome popup */}
      <Modal
        open={welcomeOpen}
        onClose={() => setWelcomeOpen(false)}
        title=""
        size="sm"
      >
        <div className="text-center pt-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--sunny)] to-[var(--coral)] flex items-center justify-center text-white mx-auto mb-4 lm-pop-in" style={{ boxShadow: '0 6px 18px rgba(238, 138, 107, 0.35)' }}>
            <Sparkles size={32} />
          </div>
          <h2 className="text-xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Welcome back, {teacher?.name?.split(' ')[0] ?? 'Teacher'}!</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-2">Ready for today's activity at {school?.name ?? 'your school'}?</p>
          <Button className="w-full mt-5" onClick={() => setWelcomeOpen(false)}>Let's go!</Button>
        </div>
      </Modal>
    </div>
  );
}

function Stat({ icon, value, label, tone, bg }: { icon: React.ReactNode; value: React.ReactNode; label: string; tone: string; bg: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-2xl" style={{ background: bg }}>
      <span style={{ color: tone }}>{icon}</span>
      <div>
        <p className="font-extrabold text-[var(--ink)] leading-none">{value}</p>
        <p className="text-[10px] text-[var(--ink-soft)] font-bold uppercase tracking-wide">{label}</p>
      </div>
    </div>
  );
}

function ActionCard({ icon, title, subtitle, tone, pop, onClick, done, locked }: { icon: React.ReactNode; title: string; subtitle: string; tone: string; pop: string; onClick: () => void; done?: boolean; locked?: boolean }) {
  return (
    <button onClick={onClick} disabled={locked} className={`lm-card lm-card-bouncy p-4 text-left transition-all ${locked ? 'opacity-60 cursor-not-allowed' : ''}`} style={{ borderRadius: '1.5rem' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: pop, color: tone }}>{icon}</div>
        {done && <span className="text-xs font-extrabold text-[var(--sage-deep)] bg-[#f4f4f5] lm-chip">Done</span>}
        {locked && <Lock size={16} className="text-[var(--ink-soft)]" />}
      </div>
      <p className="font-extrabold text-[var(--ink)] text-sm">{title}</p>
      <p className="text-xs text-[var(--ink-soft)] mt-0.5">{subtitle}</p>
    </button>
  );
}
