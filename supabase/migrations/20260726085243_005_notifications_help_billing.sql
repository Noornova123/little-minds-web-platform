/*
# Little Minds — Notifications, Help content, Billing fields

## Purpose
Adds three platform-level features requested by the admin:
  1. Announcements/notifications system with per-teacher read tracking.
  2. Admin-editable help & resources content shown to teachers.
  3. Manual billing record-keeping fields on schools.

## New Tables

### 1. notifications
- Platform-wide announcements authored by super admin. Fields: id, title, body,
  created_at, updated_at. RLS: super admin full CRUD; teachers read all.

### 2. notification_reads
- Tracks which teachers have seen each notification. Fields: id, notification_id,
  teacher_id (auth.users id), read_at. Unique per (notification_id, teacher_id).
  RLS: a teacher can read/insert only their own rows; super admin reads all.
  This powers the read/unread count per announcement shown in admin.

### 3. help_sections
- Admin-editable help guide sections shown to teachers on the Help & Resources
  page. Fields: id, slug (unique, stable key), title, body (rich text),
  sort_order, updated_at. Seeded with three default sections: Getting Started,
  Running Today's Activity, Understanding Reports. RLS: super admin full CRUD;
  teachers read all.

## Modified Tables

### schools
- Added `next_renewal_date date` (nullable) — manually editable billing field.
- Added `monthly_amount numeric(10,2)` (nullable) — manually editable monthly
  fee for revenue summary. Existing rows get NULL; no data is lost.

## Security
- RLS enabled on all three new tables.
- notifications: super-admin write, authenticated read (global).
- notification_reads: teacher scoped to own rows (auth.uid() = teacher_id);
  super admin reads all.
- help_sections: super-admin write, authenticated read (global).
- No changes to existing RLS policies.

## Important notes
1. The notification "read count" in admin is derived by counting
   notification_reads rows per notification. A teacher marking a notification
   read inserts a row (idempotent via unique constraint + ON CONFLICT).
2. Billing fields are manual record-keeping only — no automated payment logic.
3. Help section bodies are stored as rich text (plain text / light HTML);
   the admin editor is a simple textarea.
*/

-- ──────────────── notifications ────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select" ON notifications;
CREATE POLICY "notif_select" ON notifications FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "notif_insert" ON notifications;
CREATE POLICY "notif_insert" ON notifications FOR INSERT
  TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "notif_update" ON notifications;
CREATE POLICY "notif_update" ON notifications FOR UPDATE
  TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "notif_delete" ON notifications;
CREATE POLICY "notif_delete" ON notifications FOR DELETE
  TO authenticated USING (is_super_admin());

-- ──────────────── notification_reads ────────────────
CREATE TABLE IF NOT EXISTS notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notification_id, teacher_id)
);

ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nr_select" ON notification_reads;
CREATE POLICY "nr_select" ON notification_reads FOR SELECT
  TO authenticated
  USING (is_super_admin() OR teacher_id = auth.uid());

DROP POLICY IF EXISTS "nr_insert" ON notification_reads;
CREATE POLICY "nr_insert" ON notification_reads FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin() OR teacher_id = auth.uid());

DROP POLICY IF EXISTS "nr_delete" ON notification_reads;
CREATE POLICY "nr_delete" ON notification_reads FOR DELETE
  TO authenticated
  USING (is_super_admin() OR teacher_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notif_reads_notif ON notification_reads(notification_id);
CREATE INDEX IF NOT EXISTS idx_notif_reads_teacher ON notification_reads(teacher_id);

-- ──────────────── help_sections ────────────────
CREATE TABLE IF NOT EXISTS help_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE help_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "help_select" ON help_sections;
CREATE POLICY "help_select" ON help_sections FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "help_insert" ON help_sections;
CREATE POLICY "help_insert" ON help_sections FOR INSERT
  TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "help_update" ON help_sections;
CREATE POLICY "help_update" ON help_sections FOR UPDATE
  TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "help_delete" ON help_sections;
CREATE POLICY "help_delete" ON help_sections FOR DELETE
  TO authenticated USING (is_super_admin());

-- Seed default help sections (idempotent via ON CONFLICT on slug).
INSERT INTO help_sections (slug, title, body, sort_order) VALUES
  ('getting-started', 'Getting Started',
   'Welcome to Little Minds! This guide walks you through your first day.\n\n1. Pick your class from the dropdown at the top.\n2. Take attendance for today — tap each student Present or Absent.\n3. Open Today''s Activity and walk your class through the steps shown on screen.\n4. At the end, run the quick checkpoint quiz to lock in the day''s progress.\n\nYou can always revisit any day''s activity from the Content Library.',
   1),
  ('running-todays-activity', 'Running Today''s Activity',
   'Each day has a short brain, focus, or behaviour activity.\n\n- Read the written instructions or play the video to see how it works.\n- Follow the step-by-step breakdown with your class.\n- Keep it light and fun — these are meant to feel like a game, not a test.\n- When the steps are done, tap "Continue to checkpoint" to record results.\n\nIf a step is unclear, improvise! The goal is engagement, not perfection.',
   2),
  ('understanding-reports', 'Understanding Reports',
   'The Reports tab shows how your class is doing over time.\n\n- Daily checkpoints show how many students got the day''s quiz right.\n- Monthly deep-checks capture focus, brain, and behaviour scores from your offline worksheet.\n- Use the trends to spot students who may need extra support.\n\nScores are for your insight only — they are never shared with students or parents automatically.',
   3)
ON CONFLICT (slug) DO NOTHING;

-- ──────────────── schools: billing fields ────────────────
ALTER TABLE schools ADD COLUMN IF NOT EXISTS next_renewal_date date;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS monthly_amount numeric(10,2);
