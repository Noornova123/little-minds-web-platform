import { useEffect, useState } from 'react';
import { BookOpen, Library, Lock, Check, Play, Clock, ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import type { Activity, LibraryCategory, DailyCheckpoint, LibraryCompletion } from '@/lib/types';
import { matchesGrade } from '@/lib/types';
import { Card, Spinner, EmptyState, Badge } from '@/components/ui';
import { useClassContext } from '@/teacher/useClassContext';
import { ClassSelector } from '@/teacher/ClassSelector';

type Tab = 'curriculum' | 'explore';

const categoryIcons: Record<string, string> = {
  focus: '🎯',
  brain: '🧠',
  behaviour: '🤝',
};

export function ContentLibrary() {
  const { school, classes, selectedClass, progress, loading, selectClass } = useClassContext();
  const [tab, setTab] = useState<Tab>('curriculum');
  const [curriculum, setCurriculum] = useState<Activity[]>([]);
  const [library, setLibrary] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [activeCat, setActiveCat] = useState<string>('');
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set());
  const [libDoneIds, setLibDoneIds] = useState<Set<string>>(new Set());
  const [dataLoading, setDataLoading] = useState(true);

  const daysUnlocked = school?.days_unlocked_up_to ?? 0;
  const currentDay = progress?.current_day ?? 0;
  const classGrade = selectedClass?.grade_level ?? null;

  useEffect(() => {
    let active = true;
    (async () => {
      setDataLoading(true);
      const [acts, cats] = await Promise.all([
        supabase.from('activities').select('*').order('day_number', { ascending: true, nullsFirst: false }),
        supabase.from('library_categories').select('*').order('sort_order', { ascending: true }),
      ]);
      if (!active) return;
      const all = (acts.data as Activity[]) ?? [];
      setCurriculum(all.filter((a) => a.content_type === 'daily_curriculum'));
      setLibrary(all.filter((a) => a.content_type === 'library'));
      const catsData = (cats.data as LibraryCategory[]) ?? [];
      setCategories(catsData);
      if (catsData.length > 0 && !activeCat) setActiveCat(catsData[0].name);
      setDataLoading(false);
    })();
    return () => { active = false; };
  }, [activeCat]);

  // Load completion state for the selected class.
  useEffect(() => {
    if (!selectedClass) return;
    let active = true;
    (async () => {
      // Daily: which day_numbers have checkpoints for this class's students?
      const { data: cp } = await supabase
        .from('daily_checkpoints')
        .select('activity_id')
        .in('student_id', (await supabase.from('students').select('id').eq('class_id', selectedClass.id)).data?.map((s: { id: string }) => s.id) ?? []);
      if (!active) return;
      const cps = (cp as DailyCheckpoint[] | null) ?? [];
      const doneDayIds = new Set(cps.map((c) => c.activity_id));
      // Map activity_id → day_number.
      const daySet = new Set<number>();
      curriculum.forEach((a) => { if (doneDayIds.has(a.id)) daySet.add(a.day_number ?? 0); });
      setCompletedDays(daySet);

      // Library: which activity_ids have completions for this class?
      const { data: lc } = await supabase.from('library_completions').select('activity_id').eq('class_id', selectedClass.id);
      if (!active) return;
      setLibDoneIds(new Set(((lc as LibraryCompletion[] | null) ?? []).map((l) => l.activity_id)));
    })();
    return () => { active = false; };
  }, [selectedClass, curriculum]);

  if (loading) return <Spinner label="Loading…" />;

  // Build the day grid: Day 1 .. daysUnlocked (show locked teasers beyond current).
  const maxDay = Math.max(daysUnlocked, currentDay, 0);
  const dayGrid = Array.from({ length: Math.max(maxDay, 0) }, (_, i) => i + 1);

  return (
    <div className="space-y-5 lm-fade-up">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--ink)] flex items-center gap-2" style={{ fontFamily: 'Fraunces, serif' }}>
          <Library size={22} className="text-[var(--terracotta)]" /> Content Library
        </h1>
        <p className="text-sm text-[var(--ink-soft)] mt-1">Browse the daily curriculum or explore extra activities any time.</p>
      </div>

      <ClassSelector classes={classes} selected={selectedClass} onSelect={selectClass} />

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--cream-deep)] rounded-2xl p-1 w-full sm:w-fit overflow-x-auto">
        <TabBtn active={tab === 'curriculum'} onClick={() => setTab('curriculum')}><BookOpen size={16} /> Daily Curriculum</TabBtn>
        <TabBtn active={tab === 'explore'} onClick={() => setTab('explore')}><Library size={16} /> Explore by Category</TabBtn>
      </div>

      {dataLoading ? <Spinner label="Loading content…" /> : !selectedClass ? (
        <Card><EmptyState title="Select a class" /></Card>
      ) : tab === 'curriculum' ? (
        <CurriculumTab
          dayGrid={dayGrid}
          curriculum={curriculum}
          completedDays={completedDays}
          daysUnlocked={daysUnlocked}
          currentDay={currentDay}
          classGrade={classGrade}
        />
      ) : (
        <ExploreTab
          library={library}
          categories={categories}
          activeCat={activeCat}
          setActiveCat={setActiveCat}
          doneIds={libDoneIds}
          classGrade={classGrade}
        />
      )}
    </div>
  );
}

function CurriculumTab({ dayGrid, curriculum, completedDays, daysUnlocked, currentDay, classGrade }: {
  dayGrid: number[];
  curriculum: Activity[];
  completedDays: Set<number>;
  daysUnlocked: number;
  currentDay: number;
  classGrade: string | null;
}) {
  const gradeMatched = curriculum.filter((a) => matchesGrade(a, classGrade));
  if (gradeMatched.length === 0 && curriculum.length === 0) {
    return <Card><EmptyState icon={<BookOpen size={36} />} title="No daily activities yet" hint="Your admin is still building the curriculum." /></Card>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {dayGrid.map((day) => {
        const activity = gradeMatched.find((a) => a.day_number === day);
        const anyForDay = curriculum.some((a) => a.day_number === day);
        if (!activity) {
          // No matching-grade content for this day.
          return (
            <div key={day} className="lm-card p-4 opacity-70">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-extrabold uppercase text-[var(--ink-soft)]">Day {day}</span>
                <Lock size={12} className="text-[var(--ink-soft)]" />
              </div>
              <p className="font-bold text-[var(--ink-soft)] text-sm">{anyForDay ? 'Content not yet added for this grade level' : 'Coming soon'}</p>
            </div>
          );
        }
        const completed = completedDays.has(day);
        const unlocked = day <= daysUnlocked;
        const locked = !unlocked;

        return (
          <button
            key={day}
            disabled={locked}
            onClick={() => navigate(`/dashboard/activity/${activity.id}`)}
            className={`lm-card p-4 text-left transition-all ${locked ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-md hover:-translate-y-0.5'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase text-[var(--ink-soft)]">Day {day}</span>
              {locked ? (
                <span className="lm-chip bg-[var(--cream-deep)] text-[var(--ink-soft)]"><Lock size={11} /> Locked</span>
              ) : completed ? (
                <span className="lm-chip bg-[#f4f4f5] text-[var(--sage-deep)]"><Check size={11} /> Done</span>
              ) : (
                <span className="lm-chip bg-[#f4f4f5] text-[var(--terracotta)]"><Play size={11} /> Available</span>
              )}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{categoryIcons[activity.category] ?? '✨'}</span>
              <p className={`font-extrabold text-sm ${locked ? 'text-[var(--ink-soft)]' : 'text-[var(--ink)]'}`}>
                {activity.title}
              </p>
            </div>
            {!locked && (
              <p className="text-xs text-[var(--ink-soft)] flex items-center gap-1"><Clock size={11} /> {activity.duration_minutes} min</p>
            )}
            {locked && <p className="text-xs text-[var(--ink-soft)]">Unlocks with your school's plan.</p>}
          </button>
        );
      })}
    </div>
  );
}

function ExploreTab({ library, categories, activeCat, setActiveCat, doneIds, classGrade }: {
  library: Activity[];
  categories: LibraryCategory[];
  activeCat: string;
  setActiveCat: (c: string) => void;
  doneIds: Set<string>;
  classGrade: string | null;
}) {
  if (categories.length === 0) {
    return <Card><EmptyState title="No categories yet" hint="Your admin hasn't added library categories." /></Card>;
  }
  const items = library.filter((a) => a.category === activeCat && (a.grade_level === classGrade || a.grade_level === null));

  return (
    <div className="space-y-4">
      {/* Category sub-tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.name)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${activeCat === c.name ? 'bg-[var(--terracotta)] text-white' : 'bg-[var(--cream-deep)] text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <Card><EmptyState icon={<Library size={36} />} title={`No ${activeCat} activities yet`} hint="Check back soon — your admin is adding more." /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((a) => {
            const done = doneIds.has(a.id);
            const thumb = a.reference_images[0];
            return (
              <button
                key={a.id}
                onClick={() => navigate(`/dashboard/activity/${a.id}`)}
                className="lm-card overflow-hidden text-left transition-all hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="aspect-video bg-[var(--cream-deep)] relative">
                  {thumb ? (
                    <img src={thumb} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2'; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl opacity-40">{categoryIcons[a.category] ?? '✨'}</div>
                  )}
                  {done && <span className="absolute top-2 right-2 lm-chip bg-[#f4f4f5] text-[var(--sage-deep)]"><Check size={11} /> Done</span>}
                </div>
                <div className="p-4">
                  <p className="font-extrabold text-[var(--ink)] text-sm">{a.title}</p>
                  <p className="text-xs text-[var(--ink-soft)] mt-1 flex items-center gap-1"><Clock size={11} /> {a.duration_minutes} min · {a.step_breakdown.length} steps</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${active ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}>
      {children}
    </button>
  );
}
