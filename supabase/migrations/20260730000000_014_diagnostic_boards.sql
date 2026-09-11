/*
# Diagnostic Program — Education Boards

## Purpose
Adds a board dimension (CBSE / ICSE / State Board / etc.) to the diagnostic
question bank, since the same grade's syllabus differs by board. A topic is
now tagged by both grade_level and board, so admin can author, e.g., "Grade 5
Fractions — CBSE" separately from "Grade 5 Fractions — ICSE".

## Changes

### 1. education_boards table (new)
Global, admin-managed list of boards, same pattern as grade_levels. Columns:
id, name (unique), sort_order, created_at. RLS: super admin full CRUD;
authenticated (teacher) read-only. Seeded with CBSE, ICSE, State Board.

### 2. diagnostic_topics table (modified)
Added `board text` column, defaulted to 'CBSE' so any existing rows stay
valid. New topics select a board explicitly in the admin UI.

## Security
- RLS enabled on education_boards; policies mirror grade_levels (super-admin
  write, authenticated read).
- No changes to existing RLS policies on diagnostic_topics.

## Important notes
1. board is stored as plain text on diagnostic_topics (not a foreign key),
   matching the existing convention used by grade_level everywhere else in
   this schema — keeps authoring simple and avoids breaking topics if a
   board is ever renamed.
2. This migration is additive and does not touch schools, classes, or any
   other table. Matching a school/class to a specific board is left to the
   app layer once the teacher-facing screening flow is built.
*/

-- ──────────────── education_boards ────────────────
CREATE TABLE IF NOT EXISTS education_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE education_boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "board_select" ON education_boards;
CREATE POLICY "board_select" ON education_boards
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "board_insert" ON education_boards;
CREATE POLICY "board_insert" ON education_boards
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "board_update" ON education_boards;
CREATE POLICY "board_update" ON education_boards
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "board_delete" ON education_boards;
CREATE POLICY "board_delete" ON education_boards
  FOR DELETE TO authenticated USING (is_super_admin());

-- Seed default boards (idempotent via ON CONFLICT).
INSERT INTO education_boards (name, sort_order) VALUES
  ('CBSE', 1),
  ('ICSE', 2),
  ('State Board', 3)
ON CONFLICT (name) DO NOTHING;

-- ──────────────── diagnostic_topics: board column ────────────────
ALTER TABLE diagnostic_topics ADD COLUMN IF NOT EXISTS board text NOT NULL DEFAULT 'CBSE';

CREATE INDEX IF NOT EXISTS idx_diag_topics_board ON diagnostic_topics(board);
