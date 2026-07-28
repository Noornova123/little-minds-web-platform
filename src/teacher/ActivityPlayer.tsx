import { useEffect, useState } from 'react';
import { ArrowLeft, Play, Check, Lock, Film, ImageIcon, CheckCircle2, ClipboardList, Library } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import type { Activity, AttendanceRow, ClassProgress } from '@/lib/types';
import { Card, Button, Spinner, EmptyState, Badge } from '@/components/ui';
import { useClassContext } from '@/teacher/useClassContext';
import { ClassSelector } from '@/teacher/ClassSelector';

// ActivityPlayer now loads a specific activity by ID. The home screen's
// "today's activity" and the library's activity cards both route here as
// /dashboard/activity/:activityId. The content_type determines whether the
// follow-on checkpoint advances the curriculum (daily) or just logs a
// library completion (library).
export function ActivityPlayer({ activityId }: { activityId: string }) {
  const { school, classes, selectedClass, progress, loading, selectClass } = useClassContext();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [attendanceDone, setAttendanceDone] = useState(false);
  const [actLoading, setActLoading] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const today = new Date().toISOString().slice(0, 10);
  const isLibrary = activity?.content_type === 'library';
  const daysUnlocked = school?.days_unlocked_up_to ?? 0;

  useEffect(() => {
    let active = true;
    (async () => {
      setActLoading(true);
      const { data: act } = await supabase.from('activities').select('*').eq('id', activityId).maybeSingle();
      if (!active) return;
      setActivity(act as Activity | null);
      if (selectedClass) {
        const { data: att } = await supabase.from('attendance').select('*').eq('class_id', selectedClass.id).eq('date', today);
        if (!active) return;
        setAttendanceDone(((att as AttendanceRow[] | null)?.length ?? 0) > 0);
      }
      setActLoading(false);
    })();
    return () => { active = false; };
  }, [activityId, selectedClass, today]);

  if (loading || actLoading) return <Spinner label="Loading activity…" />;

  // Daily curriculum: lock if the day is beyond daysUnlocked.
  const locked = !isLibrary && activity?.day_number ? activity.day_number > daysUnlocked : false;

  return (
    <div className="space-y-5 lm-fade-up">
      <button onClick={() => navigate('/dashboard/library')} className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ink-soft)] hover:text-[var(--terracotta)]">
        <ArrowLeft size={16} /> Content Library
      </button>

      <ClassSelector classes={classes} selected={selectedClass} onSelect={selectClass} />

      {!activity ? (
        <Card><EmptyState title="Activity not found" /></Card>
      ) : locked ? (
        <Card className="p-6 text-center">
          <Lock size={32} className="mx-auto text-[var(--amber)] mb-2" />
          <p className="font-extrabold text-[var(--ink)]">Day {activity.day_number} isn't unlocked yet</p>
          <p className="text-sm text-[var(--ink-soft)] mt-1">Your school is unlocked through Day {daysUnlocked}.</p>
        </Card>
      ) : !isLibrary && !attendanceDone ? (
        <Card className="p-6 text-center">
          <Lock size={32} className="mx-auto text-[var(--amber)] mb-2" />
          <p className="font-extrabold text-[var(--ink)]">Take attendance first</p>
          <p className="text-sm text-[var(--ink-soft)] mt-1 mb-4">Daily activities unlock once attendance is done.</p>
          <Button onClick={() => navigate('/dashboard/attendance')}>Go to attendance</Button>
        </Card>
      ) : (
        <>
          {/* Header */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {isLibrary ? (
                <Badge tone="neutral"><Library size={12} /> Library</Badge>
              ) : (
                <Badge tone={activity.category === 'focus' ? 'focus' : activity.category === 'brain' ? 'brain' : 'behaviour'}>{activity.category}</Badge>
              )}
              {!isLibrary && <span className="text-xs font-bold text-[var(--ink-soft)]">Day {activity.day_number}</span>}
              <span className="text-xs font-bold text-[var(--ink-soft)]">· {activity.duration_minutes} min</span>
            </div>
            <h1 className="text-2xl font-extrabold text-[var(--ink)] mb-2" style={{ fontFamily: 'Fraunces, serif' }}>{activity.title}</h1>
            {activity.written_instructions && (
              <p className="text-[var(--ink-soft)] leading-relaxed whitespace-pre-wrap">{activity.written_instructions}</p>
            )}
          </Card>

          {activity.video_url && (
            <Card className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <Film size={18} className="text-[var(--terracotta)]" />
                <h3 className="font-extrabold text-[var(--ink)]">Video</h3>
              </div>
              <VideoEmbed url={activity.video_url} />
            </Card>
          )}

          {activity.reference_images.length > 0 && (
            <Card className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon size={18} className="text-[var(--sage-deep)]" />
                <h3 className="font-extrabold text-[var(--ink)]">Reference images</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {activity.reference_images.map((img, i) => (
                  <div key={i} className="rounded-xl overflow-hidden border border-[var(--line)] aspect-square bg-[var(--cream-deep)] cursor-zoom-in" onClick={() => window.open(img, '_blank')}>
                    <img src={img} alt={`Reference ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2'; }} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activity.step_breakdown.length > 0 && (
            <Card className="p-5">
              <h3 className="font-extrabold text-[var(--ink)] mb-1">Walk through the steps</h3>
              <p className="text-sm text-[var(--ink-soft)] mb-4">Tap each step as you complete it with the class.</p>
              <div className="space-y-2.5">
                {activity.step_breakdown.map((step, i) => {
                  const done = completedSteps.includes(i);
                  return (
                    <button
                      key={i}
                      onClick={() => setCompletedSteps((p) => done ? p.filter((x) => x !== i) : [...p, i])}
                      className={`w-full text-left rounded-2xl p-4 transition-all ${done ? 'bg-[#f4f4f5] border-2 border-[var(--sage)]' : 'bg-[var(--cream)]/40 border-2 border-[var(--line)]'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${done ? 'bg-[var(--sage)] text-white' : 'bg-[var(--cream-deep)] text-[var(--ink-soft)]'}`}>
                          {done ? <Check size={16} /> : <span className="text-xs font-extrabold">{i + 1}</span>}
                        </div>
                        <div className="flex-1">
                          <p className={`font-extrabold ${done ? 'text-[var(--sage-deep)]' : 'text-[var(--ink)]'}`}>{step.title || `Step ${i + 1}`}</p>
                          {step.instruction && <p className="text-sm text-[var(--ink-soft)] mt-0.5">{step.instruction}</p>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <p className="text-sm font-bold text-[var(--ink-soft)]">{completedSteps.length}/{activity.step_breakdown.length} steps done</p>
                <Button onClick={() => navigate(`/dashboard/checkpoint/${activity.id}`)}>
                  {completedSteps.length === activity.step_breakdown.length ? <><CheckCircle2 size={16} /> Continue to checkpoint</> : <><ClipboardList size={16} /> Continue to checkpoint</>}
                </Button>
              </div>
            </Card>
          )}

          {activity.step_breakdown.length === 0 && (
            <div className="flex justify-end">
              <Button onClick={() => navigate(`/dashboard/checkpoint/${activity.id}`)}>Continue to checkpoint <Play size={16} /></Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VideoEmbed({ url }: { url: string }) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  const vm = url.match(/vimeo\.com\/(\d+)/);
  let embed: string | null = null;
  if (yt) embed = `https://www.youtube.com/embed/${yt[1]}`;
  if (vm) embed = `https://player.vimeo.com/video/${vm[1]}`;
  if (!embed) {
    return <a href={url} target="_blank" rel="noreferrer" className="text-[var(--terracotta)] font-bold underline">Open video →</a>;
  }
  return (
    <div className="aspect-video rounded-xl overflow-hidden bg-black">
      <iframe src={embed} title="Activity video" className="w-full h-full" allowFullScreen frameBorder="0" />
    </div>
  );
}
