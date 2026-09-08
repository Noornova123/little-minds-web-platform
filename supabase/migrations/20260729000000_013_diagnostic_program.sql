/*
# Diagnostic Program — subjects, topics, skills, question bank, screening, roadmap

## Purpose
Adds a diagnostic screening module. Super admin builds a class-wise and
subject-wise question bank (subject -> topic -> skill -> question), tagged by
grade_level (reuses the existing grade_levels list). A teacher runs a
screening test for a student in a subject; the app scores each answer against
its skill, computes a mastery level per skill, and auto-generates a
prioritized roadmap of weak skills for that student. Content (actual
questions) is added later — this migration only creates the structure.

## New Tables

### 1. diagnostic_subjects (global, admin-managed)
Master list of subjects available for diagnostic screening (e.g. Math,
English). Same pattern as grade_levels — global, not school-scoped, since the
question bank itself is shared content across all schools.

### 2. diagnostic_topics
A chapter/unit within a subject, tied to a grade_level (text, matches
grade_levels.name — same loose-matching pattern as classes.grade_level).

### 3. diagnostic_skills
A granular, individually-testable concept within a topic. This is the unit
that mastery is measured against — not the whole subject.

### 4. diagnostic_questions
The question bank. Each question belongs to one skill and one difficulty
tier. mcq stores options as a text[]; correct_answer stores the correct
option text or "true"/"false" for true_false type.

### 5. diagnostic_attempts
One row per screening session: a student takes a diagnostic in one subject.
status moves in_progress -> completed. Teacher-scoped like exam_marks.

### 6. diagnostic_responses
One row per question answered during an attempt. Stores whether it was
correct, and which skill it was testing (denormalized for fast mastery
aggregation without joining back through questions every time).

### 7. diagnostic_skill_mastery
Computed result per student per skill: mastery_level derived from
score_percent across all responses for that skill (needs_support / developing
/ strong). Recomputed whenever a new attempt affecting that skill completes.

### 8. diagnostic_roadmap_items
Auto-generated action list per student: weakest skills first (lowest
priority number = do first). recommended_activity is free text for now
(links to actual remediation content once that content library exists).

## Security
- diagnostic_subjects / diagnostic_topics / diagnostic_skills /
  diagnostic_questions: super-admin write, authenticated (teacher) read —
  identical pattern to grade_levels.
- diagnostic_attempts / diagnostic_responses / diagnostic_skill_mastery /
  diagnostic_roadmap_items: teacher scoped via the same
  students -> classes -> teacher_id subquery pattern used by exam_marks.
  Super admin has full access to everything for support/oversight.

## Important notes
1. Question bank tables are global (no school_id) — same reasoning as the
   activities table: content is shared, authored once by the platform.
2. diagnostic_topics.grade_level and diagnostic_questions difficulty are
   plain text, matching the loose-matching convention already used by
   classes.grade_level / activities.grade_level (no FK, easy to author).
3. Nothing here reads or writes existing tables — fully additive migration.
*/

-- ──────────────── diagnostic_subjects ────────────────
CREATE TABLE IF NOT EXISTS diagnostic_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE diagnostic_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diag_subject_select" ON diagnostic_subjects;
CREATE POLICY "diag_subject_select" ON diagnostic_subjects
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "diag_subject_insert" ON diagnostic_subjects;
CREATE POLICY "diag_subject_insert" ON diagnostic_subjects
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "diag_subject_update" ON diagnostic_subjects;
CREATE POLICY "diag_subject_update" ON diagnostic_subjects
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "diag_subject_delete" ON diagnostic_subjects;
CREATE POLICY "diag_subject_delete" ON diagnostic_subjects
  FOR DELETE TO authenticated USING (is_super_admin());

-- ──────────────── diagnostic_topics ────────────────
CREATE TABLE IF NOT EXISTS diagnostic_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES diagnostic_subjects(id) ON DELETE CASCADE,
  grade_level text NOT NULL,
  name text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE diagnostic_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diag_topic_select" ON diagnostic_topics;
CREATE POLICY "diag_topic_select" ON diagnostic_topics
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "diag_topic_insert" ON diagnostic_topics;
CREATE POLICY "diag_topic_insert" ON diagnostic_topics
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "diag_topic_update" ON diagnostic_topics;
CREATE POLICY "diag_topic_update" ON diagnostic_topics
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "diag_topic_delete" ON diagnostic_topics;
CREATE POLICY "diag_topic_delete" ON diagnostic_topics
  FOR DELETE TO authenticated USING (is_super_admin());

CREATE INDEX IF NOT EXISTS idx_diag_topics_subject ON diagnostic_topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_diag_topics_grade ON diagnostic_topics(grade_level);

-- ──────────────── diagnostic_skills ────────────────
CREATE TABLE IF NOT EXISTS diagnostic_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES diagnostic_topics(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE diagnostic_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diag_skill_select" ON diagnostic_skills;
CREATE POLICY "diag_skill_select" ON diagnostic_skills
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "diag_skill_insert" ON diagnostic_skills;
CREATE POLICY "diag_skill_insert" ON diagnostic_skills
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "diag_skill_update" ON diagnostic_skills;
CREATE POLICY "diag_skill_update" ON diagnostic_skills
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "diag_skill_delete" ON diagnostic_skills;
CREATE POLICY "diag_skill_delete" ON diagnostic_skills
  FOR DELETE TO authenticated USING (is_super_admin());

CREATE INDEX IF NOT EXISTS idx_diag_skills_topic ON diagnostic_skills(topic_id);

-- ──────────────── diagnostic_questions ────────────────
CREATE TABLE IF NOT EXISTS diagnostic_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES diagnostic_skills(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'mcq'
    CHECK (question_type IN ('mcq','true_false','short_answer')),
  options text[] NOT NULL DEFAULT '{}',
  correct_answer text NOT NULL,
  difficulty text NOT NULL DEFAULT 'medium'
    CHECK (difficulty IN ('easy','medium','hard')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE diagnostic_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diag_question_select" ON diagnostic_questions;
CREATE POLICY "diag_question_select" ON diagnostic_questions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "diag_question_insert" ON diagnostic_questions;
CREATE POLICY "diag_question_insert" ON diagnostic_questions
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "diag_question_update" ON diagnostic_questions;
CREATE POLICY "diag_question_update" ON diagnostic_questions
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "diag_question_delete" ON diagnostic_questions;
CREATE POLICY "diag_question_delete" ON diagnostic_questions
  FOR DELETE TO authenticated USING (is_super_admin());

CREATE INDEX IF NOT EXISTS idx_diag_questions_skill ON diagnostic_questions(skill_id);

-- ──────────────── diagnostic_attempts ────────────────
CREATE TABLE IF NOT EXISTS diagnostic_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES diagnostic_subjects(id),
  grade_level text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','completed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE diagnostic_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diag_attempt_select" ON diagnostic_attempts;
CREATE POLICY "diag_attempt_select" ON diagnostic_attempts
  FOR SELECT TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = diagnostic_attempts.student_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "diag_attempt_insert" ON diagnostic_attempts;
CREATE POLICY "diag_attempt_insert" ON diagnostic_attempts
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = diagnostic_attempts.student_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "diag_attempt_update" ON diagnostic_attempts;
CREATE POLICY "diag_attempt_update" ON diagnostic_attempts
  FOR UPDATE TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = diagnostic_attempts.student_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = diagnostic_attempts.student_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "diag_attempt_delete" ON diagnostic_attempts;
CREATE POLICY "diag_attempt_delete" ON diagnostic_attempts
  FOR DELETE TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = diagnostic_attempts.student_id AND c.teacher_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_diag_attempts_student ON diagnostic_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_diag_attempts_subject ON diagnostic_attempts(subject_id);

-- ──────────────── diagnostic_responses ────────────────
CREATE TABLE IF NOT EXISTS diagnostic_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES diagnostic_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES diagnostic_questions(id),
  skill_id uuid NOT NULL REFERENCES diagnostic_skills(id),
  student_answer text,
  is_correct boolean NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE diagnostic_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diag_response_select" ON diagnostic_responses;
CREATE POLICY "diag_response_select" ON diagnostic_responses
  FOR SELECT TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM diagnostic_attempts a
      JOIN students s ON s.id = a.student_id
      JOIN classes c ON c.id = s.class_id
      WHERE a.id = diagnostic_responses.attempt_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "diag_response_insert" ON diagnostic_responses;
CREATE POLICY "diag_response_insert" ON diagnostic_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM diagnostic_attempts a
      JOIN students s ON s.id = a.student_id
      JOIN classes c ON c.id = s.class_id
      WHERE a.id = diagnostic_responses.attempt_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "diag_response_update" ON diagnostic_responses;
CREATE POLICY "diag_response_update" ON diagnostic_responses
  FOR UPDATE TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM diagnostic_attempts a
      JOIN students s ON s.id = a.student_id
      JOIN classes c ON c.id = s.class_id
      WHERE a.id = diagnostic_responses.attempt_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM diagnostic_attempts a
      JOIN students s ON s.id = a.student_id
      JOIN classes c ON c.id = s.class_id
      WHERE a.id = diagnostic_responses.attempt_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "diag_response_delete" ON diagnostic_responses;
CREATE POLICY "diag_response_delete" ON diagnostic_responses
  FOR DELETE TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM diagnostic_attempts a
      JOIN students s ON s.id = a.student_id
      JOIN classes c ON c.id = s.class_id
      WHERE a.id = diagnostic_responses.attempt_id AND c.teacher_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_diag_responses_attempt ON diagnostic_responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_diag_responses_skill ON diagnostic_responses(skill_id);

-- ──────────────── diagnostic_skill_mastery ────────────────
CREATE TABLE IF NOT EXISTS diagnostic_skill_mastery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES diagnostic_skills(id) ON DELETE CASCADE,
  mastery_level text NOT NULL DEFAULT 'needs_support'
    CHECK (mastery_level IN ('needs_support','developing','strong')),
  score_percent numeric NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, skill_id)
);

ALTER TABLE diagnostic_skill_mastery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diag_mastery_select" ON diagnostic_skill_mastery;
CREATE POLICY "diag_mastery_select" ON diagnostic_skill_mastery
  FOR SELECT TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = diagnostic_skill_mastery.student_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "diag_mastery_insert" ON diagnostic_skill_mastery;
CREATE POLICY "diag_mastery_insert" ON diagnostic_skill_mastery
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = diagnostic_skill_mastery.student_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "diag_mastery_update" ON diagnostic_skill_mastery;
CREATE POLICY "diag_mastery_update" ON diagnostic_skill_mastery
  FOR UPDATE TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = diagnostic_skill_mastery.student_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = diagnostic_skill_mastery.student_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "diag_mastery_delete" ON diagnostic_skill_mastery;
CREATE POLICY "diag_mastery_delete" ON diagnostic_skill_mastery
  FOR DELETE TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = diagnostic_skill_mastery.student_id AND c.teacher_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_diag_mastery_student ON diagnostic_skill_mastery(student_id);
CREATE INDEX IF NOT EXISTS idx_diag_mastery_skill ON diagnostic_skill_mastery(skill_id);

-- ──────────────── diagnostic_roadmap_items ────────────────
CREATE TABLE IF NOT EXISTS diagnostic_roadmap_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES diagnostic_skills(id) ON DELETE CASCADE,
  priority int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','done')),
  recommended_activity text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE diagnostic_roadmap_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diag_roadmap_select" ON diagnostic_roadmap_items;
CREATE POLICY "diag_roadmap_select" ON diagnostic_roadmap_items
  FOR SELECT TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = diagnostic_roadmap_items.student_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "diag_roadmap_insert" ON diagnostic_roadmap_items;
CREATE POLICY "diag_roadmap_insert" ON diagnostic_roadmap_items
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = diagnostic_roadmap_items.student_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "diag_roadmap_update" ON diagnostic_roadmap_items;
CREATE POLICY "diag_roadmap_update" ON diagnostic_roadmap_items
  FOR UPDATE TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = diagnostic_roadmap_items.student_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = diagnostic_roadmap_items.student_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "diag_roadmap_delete" ON diagnostic_roadmap_items;
CREATE POLICY "diag_roadmap_delete" ON diagnostic_roadmap_items
  FOR DELETE TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = diagnostic_roadmap_items.student_id AND c.teacher_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_diag_roadmap_student ON diagnostic_roadmap_items(student_id);
CREATE INDEX IF NOT EXISTS idx_diag_roadmap_skill ON diagnostic_roadmap_items(skill_id);
