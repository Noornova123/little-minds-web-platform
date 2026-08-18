import { supabase } from '@/lib/supabase';
import type { Student, School, ClassRow, ExamMark, AnecdotalNote, DailyCheckpoint, MonthlyCheck, ChecklistStatement, ChecklistResponse, ChecklistDomainRow, Achievement, AttendanceRow, TeacherFeedback } from '@/lib/types';

export interface ReportData {
  student: Student;
  school: School;
  classRow: ClassRow | null;
  marks: ExamMark[];
  notes: AnecdotalNote[];
  checkpoints: DailyCheckpoint[];
  monthlyChecks: MonthlyCheck[];
  attendance: AttendanceRow[];
  statements: ChecklistStatement[];
  responses: ChecklistResponse[];
  domains: ChecklistDomainRow[];
  achievements: Achievement[];
  teacherFeedback: TeacherFeedback[];
  academicYear: string;
}

export async function loadReportData(studentId: string): Promise<ReportData> {
  const { data: st } = await supabase.from('students').select('*').eq('id', studentId).maybeSingle();
  const student = st as Student | null;
  if (!student) throw new Error('Student not found');

  const { data: cls } = await supabase.from('classes').select('*').eq('id', student.class_id).maybeSingle();
  const classRow = cls as ClassRow | null;

  const schoolId = classRow?.school_id ?? '';
  const { data: sch } = await supabase.from('schools').select('*').eq('id', schoolId).maybeSingle();
  const school = sch as School | null;
  if (!school) throw new Error('School not found');

  const [mk, nts, cp, mc, att, stmts, resp, doms, ach, fb] = await Promise.all([
    supabase.from('exam_marks').select('*').eq('student_id', studentId).order('academic_year', { ascending: false }),
    supabase.from('anecdotal_notes').select('*').eq('student_id', studentId).order('date', { ascending: false }),
    supabase.from('daily_checkpoints').select('*').eq('student_id', studentId).order('date'),
    supabase.from('monthly_checks').select('*').eq('student_id', studentId).order('month'),
    supabase.from('attendance').select('*').eq('student_id', studentId).order('date'),
    supabase.from('checklist_statements').select('*'),
    supabase.from('checklist_responses').select('*').eq('student_id', studentId).order('month'),
    supabase.from('checklist_domains').select('*').order('display_order'),
    supabase.from('achievements').select('*').eq('student_id', studentId).order('achievement_date', { ascending: false }),
    supabase.from('teacher_feedback').select('*, teacher:teachers(name)').eq('student_id', studentId).order('month', { ascending: true }),
  ]);

  const academicYear = new Date().getFullYear().toString();

  return {
    student,
    school,
    classRow,
    marks: (mk.data as ExamMark[]) ?? [],
    notes: (nts.data as AnecdotalNote[]) ?? [],
    checkpoints: (cp.data as DailyCheckpoint[]) ?? [],
    monthlyChecks: (mc.data as MonthlyCheck[]) ?? [],
    attendance: (att.data as AttendanceRow[]) ?? [],
    statements: (stmts.data as ChecklistStatement[]) ?? [],
    responses: (resp.data as ChecklistResponse[]) ?? [],
    domains: (doms.data as ChecklistDomainRow[]) ?? [],
    achievements: (ach.data as Achievement[]) ?? [],
    teacherFeedback: (fb.data as TeacherFeedback[]) ?? [],
    academicYear,
  };
}

// Groups teacher feedback by subject, each with its entries sorted by month.
export function groupFeedbackBySubject(feedback: TeacherFeedback[]): { subject: string; entries: TeacherFeedback[] }[] {
  const bySubject = new Map<string, TeacherFeedback[]>();
  for (const f of feedback) {
    const list = bySubject.get(f.subject) ?? [];
    list.push(f);
    bySubject.set(f.subject, list);
  }
  return [...bySubject.entries()]
    .map(([subject, entries]) => ({ subject, entries: entries.sort((a, b) => a.month.localeCompare(b.month)) }))
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

export interface DomainTrend {
  domain: ChecklistDomainRow;
  labels: string[];
  values: (number | null)[];
  latest: number | null;
}

export function computeDomainTrends(data: ReportData): DomainTrend[] {
  const months = [...new Set(data.responses.map((r) => r.month))].sort();
  return data.domains.map((d) => {
    const stmtIds = data.statements.filter((s) => s.domain_id === d.id).map((s) => s.id);
    const values = months.map((m) => {
      const vals = data.responses
        .filter((r) => r.month === m && stmtIds.includes(r.statement_id))
        .map((r) => r.value);
      if (vals.length === 0) return null;
      return Math.round((vals.reduce<number>((a, b) => a + b, 0) / vals.length / 2) * 100);
    });
    return {
      domain: d,
      labels: months.map((m) => m.slice(5, 7) + '/' + m.slice(2, 4)),
      values,
      latest: values.filter((v): v is number => v !== null).at(-1) ?? null,
    };
  });
}

export interface MonthlyTrend {
  labels: string[];
  focus: (number | null)[];
  brain: (number | null)[];
}

export function computeMonthlyTrend(data: ReportData): MonthlyTrend {
  const sorted = [...data.monthlyChecks].sort((a, b) => a.month.localeCompare(b.month));
  return {
    labels: sorted.map((m) => m.month.slice(5, 7) + '/' + m.month.slice(2, 4)),
    focus: sorted.map((m) => m.focus_score),
    brain: sorted.map((m) => m.brain_score),
  };
}

export function attendancePct(data: ReportData): number | null {
  if (data.attendance.length === 0) return null;
  return Math.round((data.attendance.filter((a) => a.status === 'present').length / data.attendance.length) * 100);
}

export function checkpointAcc(data: ReportData): number | null {
  if (data.checkpoints.length === 0) return null;
  return Math.round((data.checkpoints.filter((c) => c.answer_correct).length / data.checkpoints.length) * 100);
}

export function markBadge(pct: number): { label: string; bg: string; color: string } {
  if (pct >= 75) return { label: 'Excellent', bg: '#f0fdf4', color: '#5d7a58' };
  if (pct >= 40) return { label: 'Good', bg: '#fef3c7', color: '#d99a2b' };
  return { label: 'Pass', bg: '#eff6ff', color: '#6ba8c9' };
}

export function generateNarrative(data: ReportData): string {
  const { student, notes, checkpoints, monthlyChecks, marks, achievements } = data;
  const parts: string[] = [];

  const firstName = student.name.split(' ')[0];
  parts.push(`This year has been a wonderful journey of growth for ${firstName}.`);

  const cpAcc = checkpointAcc(data);
  if (cpAcc !== null) {
    if (cpAcc >= 80) parts.push(`${firstName} engaged confidently with daily activities, achieving ${cpAcc}% accuracy across ${checkpoints.length} sessions — showing strong focus and understanding.`);
    else if (cpAcc >= 50) parts.push(`Across ${checkpoints.length} daily activity sessions, ${firstName} achieved ${cpAcc}% accuracy, showing steady progress and growing confidence.`);
    else parts.push(`${firstName} participated in ${checkpoints.length} daily activity sessions this year, building engagement step by step.`);
  }

  if (monthlyChecks.length > 0) {
    const focusVals = monthlyChecks.map((m) => m.focus_score).filter((v): v is number => v !== null);
    const brainVals = monthlyChecks.map((m) => m.brain_score).filter((v): v is number => v !== null);
    if (focusVals.length > 0) {
      const avgFocus = Math.round(focusVals.reduce<number>((a, b) => a + b, 0) / focusVals.length);
      parts.push(`In monthly focus assessments, ${firstName} maintained an average score of ${avgFocus}, reflecting consistent concentration and effort.`);
    }
    if (brainVals.length > 0) {
      const avgBrain = Math.round(brainVals.reduce<number>((a, b) => a + b, 0) / brainVals.length);
      parts.push(`Cognitive development scores averaged ${avgBrain}, showing healthy growth in problem-solving and critical thinking.`);
    }
  }

  if (marks.length > 0) {
    const totalObtained = marks.reduce<number>((a, m) => a + Number(m.marks_obtained), 0);
    const totalMax = marks.reduce<number>((a, m) => a + Number(m.total_marks), 0);
    if (totalMax > 0) {
      const overallPct = Math.round((totalObtained / totalMax) * 100);
      const badge = markBadge(overallPct);
      parts.push(`Academically, ${firstName} achieved an overall ${overallPct}% across all exams — a ${badge.label.toLowerCase()} performance that reflects dedication and hard work.`);
    }
  }

  const taggedNotes = notes.slice(0, 3);
  if (taggedNotes.length > 0) {
    const noteSummaries = taggedNotes.map((n) => n.note_text);
    parts.push(`Teachers noted: "${noteSummaries.join('" and "')}".`);
  }

  if (achievements.length > 0) {
    const titles = achievements.slice(0, 3).map((a) => a.title);
    parts.push(`${firstName} earned ${achievements.length} achievement${achievements.length === 1 ? '' : 's'} this year, including ${titles.join(', ')}.`);
  }

  parts.push(`We are proud of ${firstName}'s progress and look forward to continued growth next year.`);
  return parts.join(' ');
}

export function generateSuggestions(data: ReportData): string[] {
  const { student, marks, monthlyChecks, checkpoints } = data;
  const firstName = student.name.split(' ')[0];
  const suggestions: string[] = [];

  if (marks.length > 0) {
    const bySubject: Record<string, number[]> = {};
    for (const m of marks) {
      const pct = Number(m.total_marks) > 0 ? (Number(m.marks_obtained) / Number(m.total_marks)) * 100 : 0;
      if (!bySubject[m.subject]) bySubject[m.subject] = [];
      bySubject[m.subject].push(pct);
    }
    const weakest = Object.entries(bySubject)
      .map(([subj, pcts]) => ({ subj, avg: pcts.reduce<number>((a, b) => a + b, 0) / pcts.length }))
      .sort((a, b) => a.avg - b.avg)[0];
    if (weakest && weakest.avg < 60) {
      suggestions.push(`Continue nurturing ${firstName}'s skills in ${weakest.subj} with playful, low-pressure practice — small daily exposures build confidence over time.`);
    }
  }

  const cpAcc = checkpointAcc(data);
  if (cpAcc !== null && cpAcc < 60) {
    suggestions.push(`Encourage short, focused activity sessions at home to strengthen concentration — even 10 minutes daily makes a difference.`);
  }

  const focusVals = monthlyChecks.map((m) => m.focus_score).filter((v): v is number => v !== null);
  if (focusVals.length > 0) {
    const latest = focusVals[focusVals.length - 1];
    if (latest < 50) {
      suggestions.push(`Gentle mindfulness exercises and regular routines can help ${firstName} build focus and emotional regulation.`);
    }
  }

  if (checkpoints.length < 10) {
    suggestions.push(`More regular participation in daily activities will help ${firstName} build consistent learning habits.`);
  }

  if (suggestions.length === 0) {
    suggestions.push(`${firstName} is progressing beautifully — keep encouraging curiosity and celebrating small wins at home.`);
  }

  return suggestions.slice(0, 2);
}
