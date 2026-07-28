/*
# Little Minds — Grade-level tagging for content and classes

## Purpose
Allow the platform to serve different content for different grade levels under
the same curriculum day number (e.g. Day 5 can have a Nursery version and a
Grade 3 version, both "Day 5" in the sequence). Classes are tagged with a grade
level so the teacher dashboard auto-filters to the right content.

## Changes

### 1. grade_levels table (new)
- Editable list of grade levels, managed by super admin (same pattern as
  library_categories). Columns: id, name (unique), sort_order, created_at.
- RLS: super admins full CRUD; authenticated (teachers) read-only.
- Seeded with defaults: Nursery, LKG, UKG, Grade 1..Grade 8.

### 2. activities table (modified)
- Added `grade_level text` column (nullable). For daily_curriculum activities
  this identifies which grade level the day's content targets; for library
  activities it optionally tags the activity to a grade level.
- The partial unique index on day_number (daily_curriculum only) is replaced
  with a composite partial unique index on (day_number, grade_level) so the
  same day_number can exist for multiple grade levels, while each
  day+grade combination stays unique.

### 3. classes table (modified)
- Added `grade_level text` column (nullable). Set when admin/teacher creates a
  class so the teacher dashboard can auto-filter content. Existing classes keep
  NULL and are treated as "ungraded" (content without a grade_level still
  matches them).

### 4. Indexes
- activities(grade_level) for filtering by grade.
- classes(grade_level) for grouping.

## Security
- RLS enabled on grade_levels; policies mirror library_categories (super-admin
  write, authenticated read).
- No changes to existing RLS policies.

## Important notes
1. The old partial unique index activities_day_number_unique_curriculum is
   dropped and re-created as a composite (day_number, grade_level) index. No
   data is lost; existing rows have NULL grade_level and remain unique.
2. NULL grade_level on a daily_curriculum activity still works — it represents
   content that applies to any class whose grade_level is also NULL or unmatched.
3. Existing classes get NULL grade_level; they continue to see content exactly
   as before (the app treats NULL as a wildcard match).
*/

-- ──────────────── grade_levels ────────────────
CREATE TABLE IF NOT EXISTS grade_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE grade_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gl_select" ON grade_levels;
CREATE POLICY "gl_select" ON grade_levels FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "gl_insert" ON grade_levels;
CREATE POLICY "gl_insert" ON grade_levels FOR INSERT
  TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "gl_update" ON grade_levels;
CREATE POLICY "gl_update" ON grade_levels FOR UPDATE
  TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "gl_delete" ON grade_levels;
CREATE POLICY "gl_delete" ON grade_levels FOR DELETE
  TO authenticated USING (is_super_admin());

-- Seed default grade levels (idempotent via ON CONFLICT).
INSERT INTO grade_levels (name, sort_order) VALUES
  ('Nursery', 1),
  ('LKG', 2),
  ('UKG', 3),
  ('Grade 1', 4),
  ('Grade 2', 5),
  ('Grade 3', 6),
  ('Grade 4', 7),
  ('Grade 5', 8),
  ('Grade 6', 9),
  ('Grade 7', 10),
  ('Grade 8', 11)
ON CONFLICT (name) DO NOTHING;

-- ──────────────── activities: grade_level column + composite uniqueness ────────────────
ALTER TABLE activities ADD COLUMN IF NOT EXISTS grade_level text;

-- Replace the partial unique index: unique per (day_number, grade_level) for curriculum.
DROP INDEX IF EXISTS activities_day_number_unique_curriculum;
CREATE UNIQUE INDEX IF NOT EXISTS activities_day_number_grade_unique_curriculum
  ON activities(day_number, grade_level) WHERE content_type = 'daily_curriculum';

CREATE INDEX IF NOT EXISTS idx_activities_grade_level ON activities(grade_level);

-- ──────────────── classes: grade_level column ────────────────
ALTER TABLE classes ADD COLUMN IF NOT EXISTS grade_level text;

CREATE INDEX IF NOT EXISTS idx_classes_grade_level ON classes(grade_level);
