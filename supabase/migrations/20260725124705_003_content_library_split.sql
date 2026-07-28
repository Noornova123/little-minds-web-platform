/*
# Little Minds — Content split into Daily Curriculum + Library

## Purpose
Split the `activities` content model into two types while keeping school
isolation intact:
  - `daily_curriculum`: existing behavior — unique day_number, gated by
    school.days_unlocked_up_to, part of the sequential 90-day cycle.
  - `library`: no day_number required, NOT gated by unlocks, always accessible
    to every teacher. Uses an editable category list instead of day_number.

## Changes

### 1. activities table (modified)
- Added `content_type text NOT NULL DEFAULT 'daily_curriculum'` with a CHECK
  constraining it to `daily_curriculum` or `library`. Existing rows keep their
  current behavior (they are all daily curriculum).
- `day_number` is now nullable (library activities have no day). The existing
  unique constraint on day_number is replaced with a unique-on-non-null
  partial index so two library activities don't collide on NULL, while daily
  curriculum days stay unique. (The original unique constraint is dropped and
  re-created as a partial unique index — no data is lost.)
- `category` CHECK is relaxed: for daily_curriculum it stays focus/brain/
  behaviour; for library it can be any category label managed in the new
  `library_categories` table. The column itself becomes a plain text column
  (no CHECK) so admin-defined categories can be stored. The daily-curriculum
  category values are enforced in the application layer.

### 2. library_categories table (new)
- Editable list of categories used by Library activities, managed by super
  admin. Columns: id, name (unique), sort_order, created_at.
- RLS: super admins full CRUD; authenticated (teachers) read-only.
- Seeded with the default categories: Mind Focus, Mental Health, Exam Focus,
  Fun Activity to Relax, Exercises.

### 3. library_completions table (new)
- Logs when a teacher runs a Library activity with a class: class_id,
  activity_id, student_id, date. One row per student per activity per date
  (unique constraint). This is supplementary tracking only — it does NOT touch
  days_unlocked_up_to or class_progress.
- RLS: teachers can read/write only rows for students in their own school's
  classes (same transitive school check as daily_checkpoints). Super admins
  read all.

### 4. Indexes
- Partial unique index on activities(day_number) WHERE content_type =
  'daily_curriculum'.
- Index on activities(content_type) and activities(category) for library
  filtering.
- Index on library_completions(class_id, date) and (activity_id).

## Security
- RLS enabled on both new tables. library_categories is global-readable.
  library_completions is school-scoped like the other student data tables.
- No changes to existing RLS policies.

## Important notes
1. The original `activities_day_number_key` unique constraint is replaced by a
   partial unique index so library rows (NULL day_number) don't conflict.
2. The activities.category CHECK constraint is dropped so admin-defined
   library category names can be stored.
3. All existing activities become content_type = 'daily_curriculum' by the
   column default — no data migration needed.
*/

-- ──────────────── activities: content_type + relaxed constraints ────────────────

ALTER TABLE activities ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'daily_curriculum'
  CHECK (content_type IN ('daily_curriculum','library'));

-- Drop the old unique constraint on day_number (it required NOT NULL + unique).
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_day_number_key;

-- Make day_number nullable so library activities can omit it.
ALTER TABLE activities ALTER COLUMN day_number DROP NOT NULL;

-- Replace with a partial unique index: unique day_number only for daily_curriculum.
CREATE UNIQUE INDEX IF NOT EXISTS activities_day_number_unique_curriculum
  ON activities(day_number) WHERE content_type = 'daily_curriculum';

-- Drop the old category CHECK so admin-defined library categories can be stored.
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_category_check;

-- Helper indexes for the new access patterns.
CREATE INDEX IF NOT EXISTS idx_activities_content_type ON activities(content_type);
CREATE INDEX IF NOT EXISTS idx_activities_category_lib ON activities(category) WHERE content_type = 'library';

-- ──────────────── library_categories ────────────────
CREATE TABLE IF NOT EXISTS library_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE library_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "libcat_select" ON library_categories;
CREATE POLICY "libcat_select" ON library_categories FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "libcat_insert" ON library_categories;
CREATE POLICY "libcat_insert" ON library_categories FOR INSERT
  TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "libcat_update" ON library_categories;
CREATE POLICY "libcat_update" ON library_categories FOR UPDATE
  TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "libcat_delete" ON library_categories;
CREATE POLICY "libcat_delete" ON library_categories FOR DELETE
  TO authenticated USING (is_super_admin());

-- Seed default categories (idempotent via ON CONFLICT).
INSERT INTO library_categories (name, sort_order) VALUES
  ('Mind Focus', 1),
  ('Mental Health', 2),
  ('Exam Focus', 3),
  ('Fun Activity to Relax', 4),
  ('Exercises', 5)
ON CONFLICT (name) DO NOTHING;

-- ──────────────── library_completions ────────────────
CREATE TABLE IF NOT EXISTS library_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(activity_id, student_id, date)
);

ALTER TABLE library_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lc_select" ON library_completions;
CREATE POLICY "lc_select" ON library_completions FOR SELECT
  TO authenticated
  USING (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = library_completions.class_id AND c.school_id = auth_school_id())
  );

DROP POLICY IF EXISTS "lc_insert" ON library_completions;
CREATE POLICY "lc_insert" ON library_completions FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = library_completions.class_id AND c.school_id = auth_school_id())
  );

DROP POLICY IF EXISTS "lc_update" ON library_completions;
CREATE POLICY "lc_update" ON library_completions FOR UPDATE
  TO authenticated
  USING (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = library_completions.class_id AND c.school_id = auth_school_id())
  )
  WITH CHECK (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = library_completions.class_id AND c.school_id = auth_school_id())
  );

DROP POLICY IF EXISTS "lc_delete" ON library_completions;
CREATE POLICY "lc_delete" ON library_completions FOR DELETE
  TO authenticated
  USING (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = library_completions.class_id AND c.school_id = auth_school_id())
  );

CREATE INDEX IF NOT EXISTS idx_libcomp_class_date ON library_completions(class_id, date);
CREATE INDEX IF NOT EXISTS idx_libcomp_activity ON library_completions(activity_id);
CREATE INDEX IF NOT EXISTS idx_libcomp_student ON library_completions(student_id);
