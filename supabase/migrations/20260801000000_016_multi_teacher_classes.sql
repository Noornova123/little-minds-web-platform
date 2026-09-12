/*
# Multi-teacher classes

## Purpose
A class could previously have only one teacher (classes.teacher_id). Schools
need multiple teachers on the same class, and the ability to assign/change
teachers at any time — not just when the class is created. This migration
adds a class_teachers junction table and makes every teacher-scoped RLS
policy that was written against classes.teacher_id also recognise
class_teachers membership, WITHOUT removing the original policies.

## Changes

### 1. class_teachers table (new)
Many-to-many link between classes and teachers. RLS: a teacher can see their
own memberships; only super admin can insert/update/delete (assignment is
done from the admin panel). Existing single teacher_id assignments are
backfilled in so nothing already assigned is lost.

### 2. Helper functions
- is_teacher_of_student(student_id) — true if the caller (auth.uid()) is one
  of the teachers on that student's class, via class_teachers.
- is_teacher_of_attempt(attempt_id) — same, resolved through a diagnostic
  attempt's student.
Both are SECURITY DEFINER (same pattern as the existing auth_school_id()
function) so they can read class_teachers/students regardless of the
caller's own RLS visibility into those tables.

### 3. Additive policies
For exam_marks, diagnostic_attempts, diagnostic_responses,
diagnostic_skill_mastery, and diagnostic_roadmap_items, a second permissive
policy is added per operation (select/insert/update/delete) that grants
access via class_teachers. Postgres combines multiple permissive policies
for the same operation with OR, so this only ever widens access to
additional assigned teachers — it never narrows or replaces the original
single-teacher_id policies from earlier migrations.

## Important notes
1. classes.teacher_id is left in place (nothing reads it exclusively for
   security anymore, but nothing is removed either, to avoid breaking any
   other code that may still reference it for display purposes).
2. This migration is safe to run even if some of the "_multi_teacher" policy
   names already exist, since it drops-then-recreates only those specific
   named policies it owns.
*/

-- ──────────────── class_teachers ────────────────
CREATE TABLE IF NOT EXISTS class_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, teacher_id)
);

ALTER TABLE class_teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_teachers_select" ON class_teachers;
CREATE POLICY "class_teachers_select" ON class_teachers
  FOR SELECT TO authenticated
  USING (is_super_admin() OR teacher_id = auth.uid());

DROP POLICY IF EXISTS "class_teachers_insert" ON class_teachers;
CREATE POLICY "class_teachers_insert" ON class_teachers
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "class_teachers_update" ON class_teachers;
CREATE POLICY "class_teachers_update" ON class_teachers
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "class_teachers_delete" ON class_teachers;
CREATE POLICY "class_teachers_delete" ON class_teachers
  FOR DELETE TO authenticated USING (is_super_admin());

CREATE INDEX IF NOT EXISTS idx_class_teachers_class ON class_teachers(class_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_teacher ON class_teachers(teacher_id);

-- Backfill: carry over any existing single teacher_id assignment so nothing
-- already working today is lost.
INSERT INTO class_teachers (class_id, teacher_id)
SELECT id, teacher_id FROM classes WHERE teacher_id IS NOT NULL
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- ──────────────── Helper functions ────────────────

CREATE OR REPLACE FUNCTION is_teacher_of_student(target_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM students s
    JOIN class_teachers ct ON ct.class_id = s.class_id
    WHERE s.id = target_student_id AND ct.teacher_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_teacher_of_attempt(target_attempt_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM diagnostic_attempts a
    JOIN students s ON s.id = a.student_id
    JOIN class_teachers ct ON ct.class_id = s.class_id
    WHERE a.id = target_attempt_id AND ct.teacher_id = auth.uid()
  );
$$;

-- ──────────────── Additive policies: exam_marks ────────────────

DROP POLICY IF EXISTS "exam_mark_select_multi_teacher" ON exam_marks;
CREATE POLICY "exam_mark_select_multi_teacher" ON exam_marks
  FOR SELECT TO authenticated USING (is_teacher_of_student(student_id));

DROP POLICY IF EXISTS "exam_mark_insert_multi_teacher" ON exam_marks;
CREATE POLICY "exam_mark_insert_multi_teacher" ON exam_marks
  FOR INSERT TO authenticated WITH CHECK (is_teacher_of_student(student_id));

DROP POLICY IF EXISTS "exam_mark_update_multi_teacher" ON exam_marks;
CREATE POLICY "exam_mark_update_multi_teacher" ON exam_marks
  FOR UPDATE TO authenticated USING (is_teacher_of_student(student_id)) WITH CHECK (is_teacher_of_student(student_id));

DROP POLICY IF EXISTS "exam_mark_delete_multi_teacher" ON exam_marks;
CREATE POLICY "exam_mark_delete_multi_teacher" ON exam_marks
  FOR DELETE TO authenticated USING (is_teacher_of_student(student_id));

-- ──────────────── Additive policies: diagnostic_attempts ────────────────

DROP POLICY IF EXISTS "diag_attempt_select_multi_teacher" ON diagnostic_attempts;
CREATE POLICY "diag_attempt_select_multi_teacher" ON diagnostic_attempts
  FOR SELECT TO authenticated USING (is_teacher_of_student(student_id));

DROP POLICY IF EXISTS "diag_attempt_insert_multi_teacher" ON diagnostic_attempts;
CREATE POLICY "diag_attempt_insert_multi_teacher" ON diagnostic_attempts
  FOR INSERT TO authenticated WITH CHECK (is_teacher_of_student(student_id));

DROP POLICY IF EXISTS "diag_attempt_update_multi_teacher" ON diagnostic_attempts;
CREATE POLICY "diag_attempt_update_multi_teacher" ON diagnostic_attempts
  FOR UPDATE TO authenticated USING (is_teacher_of_student(student_id)) WITH CHECK (is_teacher_of_student(student_id));

DROP POLICY IF EXISTS "diag_attempt_delete_multi_teacher" ON diagnostic_attempts;
CREATE POLICY "diag_attempt_delete_multi_teacher" ON diagnostic_attempts
  FOR DELETE TO authenticated USING (is_teacher_of_student(student_id));

-- ──────────────── Additive policies: diagnostic_responses ────────────────

DROP POLICY IF EXISTS "diag_response_select_multi_teacher" ON diagnostic_responses;
CREATE POLICY "diag_response_select_multi_teacher" ON diagnostic_responses
  FOR SELECT TO authenticated USING (is_teacher_of_attempt(attempt_id));

DROP POLICY IF EXISTS "diag_response_insert_multi_teacher" ON diagnostic_responses;
CREATE POLICY "diag_response_insert_multi_teacher" ON diagnostic_responses
  FOR INSERT TO authenticated WITH CHECK (is_teacher_of_attempt(attempt_id));

DROP POLICY IF EXISTS "diag_response_update_multi_teacher" ON diagnostic_responses;
CREATE POLICY "diag_response_update_multi_teacher" ON diagnostic_responses
  FOR UPDATE TO authenticated USING (is_teacher_of_attempt(attempt_id)) WITH CHECK (is_teacher_of_attempt(attempt_id));

DROP POLICY IF EXISTS "diag_response_delete_multi_teacher" ON diagnostic_responses;
CREATE POLICY "diag_response_delete_multi_teacher" ON diagnostic_responses
  FOR DELETE TO authenticated USING (is_teacher_of_attempt(attempt_id));

-- ──────────────── Additive policies: diagnostic_skill_mastery ────────────────

DROP POLICY IF EXISTS "diag_mastery_select_multi_teacher" ON diagnostic_skill_mastery;
CREATE POLICY "diag_mastery_select_multi_teacher" ON diagnostic_skill_mastery
  FOR SELECT TO authenticated USING (is_teacher_of_student(student_id));

DROP POLICY IF EXISTS "diag_mastery_insert_multi_teacher" ON diagnostic_skill_mastery;
CREATE POLICY "diag_mastery_insert_multi_teacher" ON diagnostic_skill_mastery
  FOR INSERT TO authenticated WITH CHECK (is_teacher_of_student(student_id));

DROP POLICY IF EXISTS "diag_mastery_update_multi_teacher" ON diagnostic_skill_mastery;
CREATE POLICY "diag_mastery_update_multi_teacher" ON diagnostic_skill_mastery
  FOR UPDATE TO authenticated USING (is_teacher_of_student(student_id)) WITH CHECK (is_teacher_of_student(student_id));

DROP POLICY IF EXISTS "diag_mastery_delete_multi_teacher" ON diagnostic_skill_mastery;
CREATE POLICY "diag_mastery_delete_multi_teacher" ON diagnostic_skill_mastery
  FOR DELETE TO authenticated USING (is_teacher_of_student(student_id));

-- ──────────────── Additive policies: diagnostic_roadmap_items ────────────────

DROP POLICY IF EXISTS "diag_roadmap_select_multi_teacher" ON diagnostic_roadmap_items;
CREATE POLICY "diag_roadmap_select_multi_teacher" ON diagnostic_roadmap_items
  FOR SELECT TO authenticated USING (is_teacher_of_student(student_id));

DROP POLICY IF EXISTS "diag_roadmap_insert_multi_teacher" ON diagnostic_roadmap_items;
CREATE POLICY "diag_roadmap_insert_multi_teacher" ON diagnostic_roadmap_items
  FOR INSERT TO authenticated WITH CHECK (is_teacher_of_student(student_id));

DROP POLICY IF EXISTS "diag_roadmap_update_multi_teacher" ON diagnostic_roadmap_items;
CREATE POLICY "diag_roadmap_update_multi_teacher" ON diagnostic_roadmap_items
  FOR UPDATE TO authenticated USING (is_teacher_of_student(student_id)) WITH CHECK (is_teacher_of_student(student_id));

DROP POLICY IF EXISTS "diag_roadmap_delete_multi_teacher" ON diagnostic_roadmap_items;
CREATE POLICY "diag_roadmap_delete_multi_teacher" ON diagnostic_roadmap_items
  FOR DELETE TO authenticated USING (is_teacher_of_student(student_id));
