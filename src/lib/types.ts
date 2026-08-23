export type SubscriptionStatus = 'trial' | 'active' | 'suspended' | 'expired';
export type ActivityCategory = 'focus' | 'brain' | 'behaviour';
export type ContentType = 'daily_curriculum' | 'library';
export type QuizType = 'multiple_choice' | 'right_wrong';
export type AttendanceStatus = 'present' | 'absent';

export interface LibraryCategory {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface CurriculumCategory {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface GradeLevel {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface School {
  id: string;
  name: string;
  contact_info: string | null;
  principal_name: string | null;
  subscription_status: SubscriptionStatus;
  days_unlocked_up_to: number;
  next_renewal_date: string | null;
  monthly_amount: number | null;
  logo_url: string | null;
  brand_color: string | null;
  created_at: string;
}

export interface Teacher {
  id: string;
  school_id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface ClassRow {
  id: string;
  school_id: string;
  name: string;
  teacher_id: string | null;
  grade_level: string | null;
  created_at: string;
}

export interface Student {
  id: string;
  class_id: string;
  name: string;
  roll_number: string;
  photo_url: string | null;
  created_at: string;
}

export interface StepBreakdownItem {
  title: string;
  instruction: string;
}

export interface Activity {
  id: string;
  content_type: ContentType;
  day_number: number | null;
  grade_level: string | null;
  title: string;
  category: string; // focus/brain/behaviour for daily_curriculum; any library category name for library
  duration_minutes: number;
  written_instructions: string | null;
  video_url: string | null;
  reference_images: string[];
  step_breakdown: StepBreakdownItem[];
  created_at: string;
}

export function matchesGrade(activity: Activity, classGrade: string | null): boolean {
  return (activity.grade_level ?? null) === (classGrade ?? null);
}

export interface QuizQuestion {
  id: string;
  activity_id: string;
  question_text: string;
  question_type: QuizType;
  options: string[];
  correct_answer: string;
  created_at: string;
}

export interface AttendanceRow {
  id: string;
  class_id: string;
  student_id: string;
  date: string;
  status: AttendanceStatus;
  created_at: string;
}

export interface DailyCheckpoint {
  id: string;
  student_id: string;
  activity_id: string;
  date: string;
  quiz_question_id: string | null;
  answer_correct: boolean;
  created_at: string;
}

export interface MonthlyCheck {
  id: string;
  student_id: string;
  month: string;
  focus_score: number | null;
  brain_score: number | null;
  behaviour_score: number | null;
  notes: string | null;
  created_at: string;
}

export type NoteDomain = 'social_emotional' | 'life_skills' | 'academic';

export interface ChecklistDomainRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  display_order: number;
  created_at: string;
}

export interface ChecklistStatement {
  id: string;
  domain: string;
  domain_id: string | null;
  statement_text: string;
  display_order: number;
  created_at: string;
}

export interface ChecklistResponse {
  id: string;
  student_id: string;
  statement_id: string;
  month: string;
  value: 0 | 1 | 2;
  created_at: string;
}

export interface AnecdotalNote {
  id: string;
  student_id: string;
  teacher_id: string;
  note_text: string;
  tagged_domain: NoteDomain;
  date: string;
  created_at: string;
}

export interface DomainScore {
  month: string;
  [domainId: string]: string | number | null;
}

export interface ClassProgress {
  id: string;
  class_id: string;
  current_day: number;
}

export interface SuperAdmin {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface LibraryCompletion {
  id: string;
  class_id: string;
  activity_id: string;
  student_id: string;
  date: string;
  created_at: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationRead {
  id: string;
  notification_id: string;
  teacher_id: string;
  read_at: string;
}

export interface HelpSection {
  id: string;
  slug: string;
  title: string;
  body: string;
  sort_order: number;
  updated_at: string;
}

export interface Banner {
  id: string;
  image_url: string;
  title: string | null;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface AcademicSubject {
  id: string;
  school_id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface ExamName {
  id: string;
  school_id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface ExamMark {
  id: string;
  student_id: string;
  exam_name: string;
  subject: string;
  marks_obtained: number;
  total_marks: number;
  academic_year: string;
  created_at: string;
}

export interface Achievement {
  id: string;
  student_id: string;
  title: string;
  description: string | null;
  achievement_date: string;
  created_at: string;
}

export interface TeacherFeedback {
  id: string;
  student_id: string;
  teacher_id: string;
  subject: string;
  month: string; // 'YYYY-MM'
  feedback_text: string;
  created_at: string;
  teacher?: { name: string } | null; // populated when fetched with a join
}
