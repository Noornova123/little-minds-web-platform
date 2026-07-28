/*
# Little Minds — Banners + principal_name

## Purpose
1. Adds a `principal_name` field to schools so it can be shown in the teacher
   topbar alongside the school name.
2. Creates a `banners` table for admin-managed promotional banner images that
   appear in an auto-rotating carousel on the teacher Class Home.

## Modified Tables
### schools
- Added `principal_name text` (nullable). Existing rows get NULL; no data lost.

## New Tables
### banners
- Admin-managed promotional banner slides. Fields: id, image_url (required),
  title (optional caption), link_url (optional click-through), display_order
  (controls carousel sequence), is_active (bool toggle), created_at.
- RLS: super admin full CRUD; authenticated read (so teachers can load them).

## Security
- RLS enabled on banners.
- Four separate policies (SELECT/INSERT/UPDATE/DELETE) — no FOR ALL.
- SELECT open to all authenticated (global content teachers read).
- INSERT/UPDATE/DELETE restricted to super admins via is_super_admin().
*/

ALTER TABLE schools ADD COLUMN IF NOT EXISTS principal_name text;

CREATE TABLE IF NOT EXISTS banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  title text,
  link_url text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banners_select" ON banners;
CREATE POLICY "banners_select" ON banners FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "banners_insert" ON banners;
CREATE POLICY "banners_insert" ON banners FOR INSERT
  TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "banners_update" ON banners;
CREATE POLICY "banners_update" ON banners FOR UPDATE
  TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "banners_delete" ON banners;
CREATE POLICY "banners_delete" ON banners FOR DELETE
  TO authenticated USING (is_super_admin());

CREATE INDEX IF NOT EXISTS idx_banners_order ON banners(display_order);
