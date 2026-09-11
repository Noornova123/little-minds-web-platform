import { useEffect, useState } from 'react';
import { ArrowLeft, FileText, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import type { Student, DiagnosticAttempt, DiagnosticSubject, DiagnosticSkill, DiagnosticTopic, DiagnosticSkillMastery, DiagnosticRoadmapItem } from '@/lib/types';
import { Card, Spinner, Badge } from '@/components/ui';

const MASTERY_LABEL: Record<string, string> = {
  needs_support: 'Needs support',
  developing: 'Developing',
  strong: 'Strong',
};
const MASTERY_COLOR: Record<string, string> = {
  needs_support: '#dc2626',
  developing: '#d97706',
  strong: '#059669',
};

export function DiagnosticReport({ studentId, attemptId }: { studentId: string; attemptId: string }) {
  const [student, setStudent] = useState<Student | null>(null);
  const [attempt, setAttempt] = useState<DiagnosticAttempt | null>(null);
  const [subject, setSubject] = useState<DiagnosticSubject | null>(null);
  const [rows, setRows] = useState<{ skill: DiagnosticSkill; topic: DiagnosticTopic | null; mastery: DiagnosticSkillMastery | null }[]>([]);
  const [roadmap, setRoadmap] = useState<(DiagnosticRoadmapItem & { skill_name: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    const [studentRes, attemptRes] = await Promise.all([
      supabase.from('students').select('*').eq('id', studentId).maybeSingle(),
      supabase.from('diagnostic_attempts').select('*').eq('id', attemptId).maybeSingle(),
    ]);
    if (attemptRes.error || !attemptRes.data) { setErr(attemptRes.error?.message ?? 'Report not found'); setLoading(false); return; }
    setStudent(studentRes.data as Student | null);
    const a = attemptRes.data as DiagnosticAttempt;
    setAttempt(a);

    const subjectRes = await supabase.from('diagnostic_subjects').select('*').eq('id', a.subject_id).maybeSingle();
    setSubject(subjectRes.data as DiagnosticSubject | null);

    // Skills actually tested in this attempt.
    const responseRes = await supabase.from('diagnostic_responses').select('skill_id').eq('attempt_id', attemptId);
    const skillIds = [...new Set((responseRes.data ?? []).map((r: any) => r.skill_id))];

    if (skillIds.length === 0) { setRows([]); setRoadmap([]); setLoading(false); return; }

    const [skillRes, masteryRes, roadmapRes] = await Promise.all([
      supabase.from('diagnostic_skills').select('*').in('id', skillIds),
      supabase.from('diagnostic_skill_mastery').select('*').eq('student_id', studentId).in('skill_id', skillIds),
      supabase.from('diagnostic_roadmap_items').select('*').eq('student_id', studentId).in('skill_id', skillIds).order('priority', { ascending: true }),
    ]);
    const skillRows = (skillRes.data as DiagnosticSkill[]) ?? [];
    const topicIds = [...new Set(skillRows.map((s) => s.topic_id))];
    const topicRes = topicIds.length > 0 ? await supabase.from('diagnostic_topics').select('*').in('id', topicIds) : { data: [] as any[] };
    const topicMap: Record<string, DiagnosticTopic> = {};
    ((topicRes.data as DiagnosticTopic[]) ?? []).forEach((t) => { topicMap[t.id] = t; });

    const masteryMap: Record<string, DiagnosticSkillMastery> = {};
    ((masteryRes.data as DiagnosticSkillMastery[]) ?? []).forEach((m) => { masteryMap[m.skill_id] = m; });

    setRows(skillRows.map((s) => ({ skill: s, topic: topicMap[s.topic_id] ?? null, mastery: masteryMap[s.id] ?? null })));

    const skillNameMap: Record<string, string> = {};
    skillRows.forEach((s) => { skillNameMap[s.id] = s.name; });
    setRoadmap(((roadmapRes.data as DiagnosticRoadmapItem[]) ?? []).map((r) => ({ ...r, skill_name: skillNameMap[r.skill_id] ?? 'Skill' })));

    setLoading(false);
  }

  useEffect(() => { load(); }, [attemptId]);

  if (loading) return <Spinner label="Loading report…" />;
  if (err) return <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>;

  return (
    <div className="space-y-5 lm-fade-up">
      <button onClick={() => navigate(`/dashboard/diagnostics/${studentId}`)} className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ink-soft)] hover:text-[var(--terracotta)]">
        <ArrowLeft size={16} /> Back to {student?.name ?? 'student'}
      </button>

      <div className="flex items-center gap-2 flex-wrap">
        <FileText size={20} className="text-[var(--terracotta)]" />
        <h1 className="text-xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>
          {student?.name} — {subject?.name} screening
        </h1>
      </div>
      {attempt?.completed_at && (
        <p className="text-xs text-[var(--ink-soft)]">Completed {new Date(attempt.completed_at).toLocaleDateString()} · {attempt.grade_level} · {attempt.board}</p>
      )}

      <Card className="p-5">
        <h2 className="font-extrabold text-[var(--ink)] mb-3">Skill-by-skill result</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]">No results recorded for this screening.</p>
        ) : (
          <div className="space-y-2">
            {rows.map(({ skill, topic, mastery }) => (
              <div key={skill.id} className="flex items-center gap-3 rounded-2xl border border-[var(--line)] p-3">
                <div className="flex-1">
                  <p className="font-bold text-[var(--ink)] text-sm">{skill.name}</p>
                  {topic && <p className="text-xs text-[var(--ink-soft)]">{topic.name}</p>}
                </div>
                {mastery && (
                  <span
                    className="text-xs font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap"
                    style={{ background: `${MASTERY_COLOR[mastery.mastery_level]}1f`, color: MASTERY_COLOR[mastery.mastery_level] }}
                  >
                    {MASTERY_LABEL[mastery.mastery_level]} · {Math.round(mastery.score_percent)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={18} className="text-[var(--terracotta)]" />
          <h2 className="font-extrabold text-[var(--ink)]">Recommended roadmap</h2>
        </div>
        {roadmap.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]">No weak skills found — great result! Nothing to prioritise from this screening.</p>
        ) : (
          <div className="space-y-2">
            {roadmap.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-[var(--line)] p-3">
                <div className="w-7 h-7 rounded-full bg-[var(--cream-deep)] flex items-center justify-center text-xs font-extrabold text-[var(--ink-soft)] shrink-0">{i + 1}</div>
                <span className="flex-1 font-bold text-[var(--ink)] text-sm">{r.skill_name}</span>
                <Badge tone="neutral">{r.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
