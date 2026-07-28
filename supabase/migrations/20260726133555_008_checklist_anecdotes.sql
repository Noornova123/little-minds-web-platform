/*
# Little Minds — Checklist-based monthly assessment + anecdotal notes

## Purpose
Replaces the old single-score monthly "behaviour" entry with a structured
checklist system. Teachers tap through a grid of statements (Yes/Sometimes/
Rarely) per student; domain scores are auto-calculated from those responses.
Adds lightweight anecdotal notes that teachers can jot down any time.

## New Tables

### 1. checklist_statements
- Admin-managed statements grouped by domain. Fields: id, domain
  (social_emotional | life_skills), statement_text, display_order, created_at.
- RLS: super admin full CRUD; authenticated read (teachers read to fill grid).
- Seeded with 3 statements per domain (6 total).

### 2. checklist_responses
- Per-student per-statement per-month response. Fields: id, student_id,
  statement_id, month (YYYY-MM-01), value (0=Rarely, 1=Sometimes, 2=Yes),
  created_at. Unique on (student_id, statement_id, month).
- RLS: teacher scoped — a teacher can access responses for students in classes
  they own (checked via subquery: students -> classes -> teacher_id). Super
  admin full access.

### 3. anecdotal_notes
- Short optional teacher observations. Fields: id, student_id, teacher_id,
  note_text, tagged_domain (social_emotional | life_skills | academic), date,
  created_at.
- RLS: teacher scoped (own notes, or notes for students in their classes);
  super admin full access.

## Modified Tables
### monthly_checks
- No columns removed (data safety). behaviour_score remains in schema but is
  no longer written to by the new checklist flow.

## Security
- RLS enabled on all three new tables.
- checklist_statements: super-admin write, authenticated read (global).
- checklist_responses: teacher scoped via subquery through students + classes.
- anecdotal_notes: teacher scoped via teacher_id OR students + classes subquery.

## Important notes
1. Domain scores are computed in the frontend from checklist_responses:
   score = avg of domain statement values * 50 (scales 0-2 to 0-100).
2. The unique constraint makes re-tapping a cell an upsert (idempotent).
3. Anecdotal notes are fully optional — no reminders or completion pressure.
*/

-- ──────────────── checklist_statements ────────────────
CREATE TABLE IF NOT EXISTS checklist_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL CHECK (domain IN ('social_emotional', 'life_skills')),
  statement_text text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE checklist_statements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklist_stmt_select" ON checklist_statements;
CREATE POLICY "checklist_stmt_select" ON checklist_statements
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "checklist_stmt_insert" ON checklist_statements;
CREATE POLICY "checklist_stmt_insert" ON checklist_statements
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "checklist_stmt_update" ON checklist_statements;
CREATE POLICY "checklist_stmt_update" ON checklist_statements
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "checklist_stmt_delete" ON checklist_statements;
CREATE POLICY "checklist_stmt_delete" ON checklist_statements
  FOR DELETE TO authenticated USING (is_super_admin());

INSERT INTO checklist_statements (domain, statement_text, display_order) VALUES
  ('social_emotional', 'Shares or helps classmates without being asked', 1),
  ('social_emotional', 'Stays calm when things don''t go as expected', 2),
  ('social_emotional', 'Talks about their feelings when upset', 3),
  ('life_skills', 'Makes decisions confidently during group activities', 1),
  ('life_skills', 'Completes tasks independently', 2),
  ('life_skills', 'Works well with others in team/group tasks', 3)
ON CONFLICT DO NOTHING;

-- ──────────────── checklist_responses ────────────────
CREATE TABLE IF NOT EXISTS checklist_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  statement_id uuid NOT NULL REFERENCES checklist_statements(id) ON DELETE CASCADE,
  month text NOT NULL,
  value int NOT NULL CHECK (value IN (0, 1, 2)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, statement_id, month)
);

ALTER TABLE checklist_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklist_resp_select" ON checklist_responses;
CREATE POLICY "checklist_resp_select" ON checklist_responses
  FOR SELECT TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = checklist_responses.student_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "checklist_resp_insert" ON checklist_responses;
CREATE POLICY "checklist_resp_insert" ON checklist_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = checklist_responses.student_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "checklist_resp_update" ON checklist_responses;
CREATE POLICY "checklist_resp_update" ON checklist_responses
  FOR UPDATE TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = checklist_responses.student_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = checklist_responses.student_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "checklist_resp_delete" ON checklist_responses;
CREATE POLICY "checklist_resp_delete" ON checklist_responses
  FOR DELETE TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = checklist_responses.student_id AND c.teacher_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_checklist_resp_student ON checklist_responses(student_id);
CREATE INDEX IF NOT EXISTS idx_checklist_resp_month ON checklist_responses(month);

-- ──────────────── anecdotal_notes ────────────────
CREATE TABLE IF NOT EXISTS anecdotal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  note_text text NOT NULL,
  tagged_domain text NOT NULL CHECK (tagged_domain IN ('social_emotional', 'life_skills', 'academic')),
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE anecdotal_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anecdote_select" ON anecdotal_notes;
CREATE POLICY "anecdote_select" ON anecdotal_notes
  FOR SELECT TO authenticated
  USING (
    is_super_admin() OR teacher_id = auth.uid() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = anecdotal_notes.student_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "anecdote_insert" ON anecdotal_notes;
CREATE POLICY "anecdote_insert" ON anecdotal_notes
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR teacher_id = auth.uid());

DROP POLICY IF EXISTS "anecdote_update" ON anecdotal_notes;
CREATE POLICY "anecdote_update" ON anecdotal_notes
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR teacher_id = auth.uid())
  WITH CHECK (is_super_admin() OR teacher_id = auth.uid());

DROP POLICY IF EXISTS "anecdote_delete" ON anecdotal_notes;
CREATE POLICY "anecdote_delete" ON anecdotal_notes
  FOR DELETE TO authenticated
  USING (is_super_admin() OR teacher_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_anecdote_student ON anecdotal_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_anecdote_domain ON anecdotal_notes(tagged_domain);
