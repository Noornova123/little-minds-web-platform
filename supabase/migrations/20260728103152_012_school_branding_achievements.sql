/*
# School Branding + Student Achievements

## Purpose
1. Adds logo_url and brand_color to schools so each school's generated PDF
   reports can be branded with their own logo and accent color.
2. Adds an achievements table so teachers can record badges, certificates, and
   milestones for students, which appear in the generated PDF report's
   Achievements section.

## Modified Tables

### schools
- logo_url (text, nullable) — public URL of the uploaded logo image.
- brand_color (text, nullable) — hex color string e.g. '#ee8a6b', used as the
  accent color in generated PDF reports.

## New Tables

### achievements
- Per-student achievements: badges, certificates, milestones.
- Fields: id, student_id, title, description, achievement_date, created_at.
- RLS: teacher scoped (teacher can access achievements for students in classes
  they own); super admin full access.

## Security
- schools: existing RLS stays. The new columns are readable by any authenticated
  user (school info is already visible) and writable only by super admin. No new
  policies needed — existing school policies already cover SELECT/UPDATE on the
  row level; the new columns inherit those.
- achievements: RLS enabled, teacher-scoped via students + classes join.
*/

-- ──────────────── schools: branding columns ────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schools' AND column_name = 'logo_url') THEN
    ALTER TABLE schools ADD COLUMN logo_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schools' AND column_name = 'brand_color') THEN
    ALTER TABLE schools ADD COLUMN brand_color text;
  END IF;
END $$;

-- ──────────────── achievements ────────────────
CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  achievement_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "achievement_select" ON achievements;
CREATE POLICY "achievement_select" ON achievements
  FOR SELECT TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = achievements.student_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "achievement_insert" ON achievements;
CREATE POLICY "achievement_insert" ON achievements
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = achievements.student_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "achievement_delete" ON achievements;
CREATE POLICY "achievement_delete" ON achievements
  FOR DELETE TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = achievements.student_id AND c.teacher_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_achievements_student ON achievements(student_id);
