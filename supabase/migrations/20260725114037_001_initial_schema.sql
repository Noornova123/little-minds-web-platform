/*
# Little Minds — Initial Schema

## Purpose
Multi-tenant database for a school platform where teachers run daily classroom
brain/focus/behaviour activities. Strict isolation between schools is enforced
via Row Level Security (see migration 002).

## Tables Created

1. **super_admins** — Platform operators who manage all schools. `id` links to
   `auth.users(id)` so Supabase Auth handles passwords. Created only via the
   bootstrap edge function when zero super_admins exist.
2. **schools** — Tenant root. `days_unlocked_up_to` is the content-release gate
   (admin manually raises it to unlock more days of activities for a school).
   `subscription_status` controls access (trial/active/suspended/expired).
3. **teachers** — School staff. `id` links to `auth.users(id)`. Created only by
   super admin via the create-teacher edge function (no self-signup). Each
   teacher belongs to exactly one school (`school_id`).
4. **classes** — A classroom within a school, optionally assigned a teacher.
5. **students** — Children in a class. Roll numbers unique per class.
6. **activities** — GLOBAL content library (shared across all schools). Each
   activity has a unique `day_number`, a category (focus/brain/behaviour),
   rich-text instructions, optional video, reference image gallery, and an
   ordered step breakdown the teacher walks through live.
7. **quiz_questions** — Questions tied to an activity. Type is multiple_choice
   (with options array) or right_wrong. `correct_answer` stores the right
   option text or "right"/"wrong".
8. **attendance** — Daily present/absent per student. Unique per class+student+date.
9. **daily_checkpoints** — Per-student result for a day's quiz question
   (correct/incorrect). Submitting advances class progress.
10. **monthly_checks** — Monthly focus/brain/behaviour scores (0–100) entered
    from an offline worksheet. Unique per student+month.
11. **class_progress** — Tracks `current_day` for a class (one row per class),
    capped by `school.days_unlocked_up_to` in application logic.

## Helper Functions
- **is_super_admin()** — returns true if the caller's JWT app_metadata role is
  `super_admin`.
- **auth_school_id()** — returns the school_id of the authenticated teacher
  (security definer, bypasses RLS to look up the caller's own school).

## Indexes
Added on all frequently-queried foreign keys and filter columns.

## Security
RLS enabled on every table. Policies added in migration 002.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ──────────────── super_admins ────────────────
CREATE TABLE IF NOT EXISTS super_admins (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ──────────────── schools ────────────────
CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_info text,
  subscription_status text NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN ('trial','active','suspended','expired')),
  days_unlocked_up_to int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ──────────────── teachers ────────────────
CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ──────────────── classes ────────────────
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ──────────────── students ────────────────
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  roll_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, roll_number)
);

-- ──────────────── activities (GLOBAL content) ────────────────
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number int UNIQUE NOT NULL,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('focus','brain','behaviour')),
  duration_minutes int NOT NULL DEFAULT 10,
  written_instructions text,
  video_url text,
  reference_images text[] NOT NULL DEFAULT '{}',
  step_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ──────────────── quiz_questions ────────────────
CREATE TABLE IF NOT EXISTS quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('multiple_choice','right_wrong')),
  options text[] NOT NULL DEFAULT '{}',
  correct_answer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ──────────────── attendance ────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present','absent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id, date)
);

-- ──────────────── daily_checkpoints ────────────────
CREATE TABLE IF NOT EXISTS daily_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  date date NOT NULL,
  quiz_question_id uuid REFERENCES quiz_questions(id) ON DELETE SET NULL,
  answer_correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, quiz_question_id, date)
);

-- ──────────────── monthly_checks ────────────────
CREATE TABLE IF NOT EXISTS monthly_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  month date NOT NULL,
  focus_score int CHECK (focus_score >= 0 AND focus_score <= 100),
  brain_score int CHECK (brain_score >= 0 AND brain_score <= 100),
  behaviour_score int CHECK (behaviour_score >= 0 AND behaviour_score <= 100),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, month)
);

-- ──────────────── class_progress ────────────────
CREATE TABLE IF NOT EXISTS class_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid UNIQUE NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  current_day int NOT NULL DEFAULT 0
);

-- ──────────────── Helper Functions ────────────────

-- Returns true if the caller is a super_admin (checked via JWT app_metadata).
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false);
$$;

-- Returns the school_id of the authenticated teacher.
-- Security definer so it can read the teachers table bypassing RLS.
-- Only looks up the caller's own id, so it never leaks other schools' data.
CREATE OR REPLACE FUNCTION auth_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM teachers WHERE id = auth.uid();
$$;

-- ──────────────── Indexes ────────────────
CREATE INDEX IF NOT EXISTS idx_teachers_school_id ON teachers(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_school_id ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_student_date ON daily_checkpoints(student_id, date);
CREATE INDEX IF NOT EXISTS idx_checkpoints_activity ON daily_checkpoints(activity_id);
CREATE INDEX IF NOT EXISTS idx_monthly_checks_student ON monthly_checks(student_id, month);
CREATE INDEX IF NOT EXISTS idx_class_progress_class ON class_progress(class_id);
CREATE INDEX IF NOT EXISTS idx_activities_day ON activities(day_number);
CREATE INDEX IF NOT EXISTS idx_quiz_activity ON quiz_questions(activity_id);

-- Enable RLS on every table (locked until policies in migration 002)
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_progress ENABLE ROW LEVEL SECURITY;
