/*
# Academic Marks — subjects, exam names, and per-student exam marks

## Purpose
Adds an academic marks module so teachers can record exam scores per student
across subjects and exams. Admins manage the list of subjects and exam names
per school (e.g. "Math", "Science", "Half Yearly", "Yearly"). Teachers enter
marks in a quick grid. Each student's report shows a subject-wise summary with
pass/good/excellent visual badges based on percentage — no ranking.

## New Tables

### 1. academic_subjects
- School-scoped list of subjects (e.g. Math, Science, English).
- Fields: id, school_id, name, display_order, created_at.
- RLS: super admin full CRUD; teacher read for subjects in their own school.

### 2. exam_names
- School-scoped list of exam names (e.g. Half Yearly, Yearly).
- Fields: id, school_id, name, display_order, created_at.
- RLS: super admin full CRUD; teacher read for exams in their own school.

### 3. exam_marks
- Per-student per-exam per-subject marks record.
- Fields: id, student_id, exam_name (text), subject (text), marks_obtained
  (numeric, can be decimals), total_marks (numeric), academic_year (text),
  created_at.
- Unique constraint on (student_id, exam_name, subject, academic_year) so
  re-entering a mark updates the existing row rather than creating a duplicate.
- RLS: teacher scoped — a teacher can access marks for students in classes they
  own. Super admin full access.

## Security
- RLS enabled on all three tables.
- academic_subjects & exam_names: super-admin write, authenticated read.
- exam_marks: teacher scoped via subquery through students + classes; super
  admin full access.

## Important notes
1. exam_marks stores exam_name and subject as TEXT (not FKs) intentionally —
   this keeps marks intact even if an admin renames or deletes a subject/exam
   name later. The admin lists are for convenient dropdown selection during
   entry, not for referential integrity of recorded marks.
2. marks_obtained and total_marks are numeric (decimal) to support half-mark
   scoring (e.g. 18.5 / 20).
3. academic_year is free text (e.g. "2025-2026") so schools can record marks
   across multiple years.
*/

-- ──────────────── academic_subjects ────────────────
CREATE TABLE IF NOT EXISTS academic_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, name)
);

ALTER TABLE academic_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "academic_subject_select" ON academic_subjects;
CREATE POLICY "academic_subject_select" ON academic_subjects
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "academic_subject_insert" ON academic_subjects;
CREATE POLICY "academic_subject_insert" ON academic_subjects
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "academic_subject_update" ON academic_subjects;
CREATE POLICY "academic_subject_update" ON academic_subjects
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "academic_subject_delete" ON academic_subjects;
CREATE POLICY "academic_subject_delete" ON academic_subjects
  FOR DELETE TO authenticated USING (is_super_admin());

CREATE INDEX IF NOT EXISTS idx_academic_subjects_school ON academic_subjects(school_id);

-- ──────────────── exam_names ────────────────
CREATE TABLE IF NOT EXISTS exam_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, name)
);

ALTER TABLE exam_names ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exam_name_select" ON exam_names;
CREATE POLICY "exam_name_select" ON exam_names
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "exam_name_insert" ON exam_names;
CREATE POLICY "exam_name_insert" ON exam_names
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "exam_name_update" ON exam_names;
CREATE POLICY "exam_name_update" ON exam_names
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "exam_name_delete" ON exam_names;
CREATE POLICY "exam_name_delete" ON exam_names
  FOR DELETE TO authenticated USING (is_super_admin());

CREATE INDEX IF NOT EXISTS idx_exam_names_school ON exam_names(school_id);

-- ──────────────── exam_marks ────────────────
CREATE TABLE IF NOT EXISTS exam_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam_name text NOT NULL,
  subject text NOT NULL,
  marks_obtained numeric NOT NULL DEFAULT 0,
  total_marks numeric NOT NULL DEFAULT 100,
  academic_year text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, exam_name, subject, academic_year)
);

ALTER TABLE exam_marks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exam_mark_select" ON exam_marks;
CREATE POLICY "exam_mark_select" ON exam_marks
  FOR SELECT TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = exam_marks.student_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "exam_mark_insert" ON exam_marks;
CREATE POLICY "exam_mark_insert" ON exam_marks
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = exam_marks.student_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "exam_mark_update" ON exam_marks;
CREATE POLICY "exam_mark_update" ON exam_marks
  FOR UPDATE TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = exam_marks.student_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = exam_marks.student_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "exam_mark_delete" ON exam_marks;
CREATE POLICY "exam_mark_delete" ON exam_marks
  FOR DELETE TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = exam_marks.student_id AND c.teacher_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_exam_marks_student ON exam_marks(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_marks_student_year ON exam_marks(student_id, academic_year);
