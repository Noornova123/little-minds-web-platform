import { useEffect, useState } from 'react';
import { Building2, Users, GraduationCap, TrendingUp, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, Spinner, EmptyState } from '@/components/ui';
import { navigate } from '@/lib/router';

interface Stats {
  schools: number;
  classes: number;
  students: number;
  avgFocus: number | null;
  avgBrain: number | null;
  avgBehaviour: number | null;
}

export function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<{ id: string; name: string; subscription_status: string; days_unlocked_up_to: number; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [schools, classes, students, checks] = await Promise.all([
        supabase.from('schools').select('*', { count: 'exact', head: true }),
        supabase.from('classes').select('*', { count: 'exact', head: true }),
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('monthly_checks').select('focus_score, brain_score, behaviour_score'),
      ]);

      const mc = checks.data ?? [];
      const avg = (key: 'focus_score' | 'brain_score' | 'behaviour_score') => {
        const vals = mc.map((r) => r[key]).filter((v): v is number => v !== null);
        return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
      };

      setStats({
        schools: schools.count ?? 0,
        classes: classes.count ?? 0,
        students: students.count ?? 0,
        avgFocus: avg('focus_score'),
        avgBrain: avg('brain_score'),
        avgBehaviour: avg('behaviour_score'),
      });

      const { data: recentSchools } = await supabase
        .from('schools')
        .select('id, name, subscription_status, days_unlocked_up_to, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      setRecent(recentSchools ?? []);

      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner label="Loading overview…" />;

  const statCards = [
    { label: 'Schools', value: stats?.schools ?? 0, icon: Building2, tone: 'var(--terracotta)' },
    { label: 'Classes', value: stats?.classes ?? 0, icon: GraduationCap, tone: 'var(--sage)' },
    { label: 'Students', value: stats?.students ?? 0, icon: Users, tone: 'var(--amber)' },
  ];

  const scoreCards = [
    { label: 'Avg Focus', value: stats?.avgFocus, color: 'var(--terracotta)' },
    { label: 'Avg Brain', value: stats?.avgBrain, color: '#3a5d8f' },
    { label: 'Avg Behaviour', value: stats?.avgBehaviour, color: 'var(--sage)' },
  ];

  return (
    <div className="space-y-6 lm-fade-up">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[var(--ink-soft)]">{s.label}</p>
                <p className="text-3xl font-extrabold text-[var(--ink)] mt-1">{s.value}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${s.tone}1f`, color: s.tone }}>
                <s.icon size={24} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-[var(--sage-deep)]" />
          <h3 className="font-extrabold text-[var(--ink)]">Average scores across all schools</h3>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {scoreCards.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-sm font-bold text-[var(--ink-soft)] mb-1">{s.label}</p>
              <p className="text-2xl font-extrabold" style={{ color: s.color }}>
                {s.value === null ? '—' : s.value}
              </p>
              <p className="text-xs text-[var(--ink-soft)]">/ 100</p>
            </div>
          ))}
        </div>
        {stats?.avgFocus === null && stats?.avgBrain === null && stats?.avgBehaviour === null && (
          <p className="text-center text-sm text-[var(--ink-soft)] mt-3">No monthly checks recorded yet.</p>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-[var(--ink)]">Recently added schools</h3>
          <button onClick={() => navigate('/admin/schools')} className="text-sm font-bold text-[var(--terracotta)] hover:underline inline-flex items-center gap-1">
            View all <ArrowRight size={14} />
          </button>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="No schools yet" hint="Add your first school to get started." />
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {recent.map((s) => (
              <button key={s.id} onClick={() => navigate(`/admin/schools/${s.id}`)} className="w-full flex items-center justify-between py-3 text-left hover:bg-[var(--cream-deep)] -mx-2 px-2 rounded-lg transition-colors">
                <div>
                  <p className="font-bold text-[var(--ink)]">{s.name}</p>
                  <p className="text-xs text-[var(--ink-soft)] capitalize">{s.subscription_status} · Day {s.days_unlocked_up_to} unlocked</p>
                </div>
                <ArrowRight size={16} className="text-[var(--ink-soft)]" />
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
