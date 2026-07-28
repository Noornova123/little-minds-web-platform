/*
# Checklist Domains — dynamic domains replacing fixed enum

## Purpose
Replaces the hardcoded two-domain system (social_emotional / life_skills) with a
dynamic `checklist_domains` table so admins can create any number of checklist
domains (e.g. "Emotional Regulation", "Confidence Building"). Each domain has a
name, icon, color, and display order. Statements reference a domain via FK.

## New Tables
### checklist_domains
- id (uuid, PK)
- name (text, not null) — display label, e.g. "Social-Emotional"
- icon (text, not null) — lucide icon name key, e.g. "heart", "wrench"
- color (text, not null) — CSS color value, e.g. "var(--coral)" or "#ee8a6b"
- display_order (int, not null, default 0)
- created_at (timestamptz)
- RLS: super admin full CRUD; authenticated read (teachers read domains to
  render the monthly grid and reports).

## Modified Tables
### checklist_statements
- Added column `domain_id uuid REFERENCES checklist_domains(id) ON DELETE CASCADE`.
- The existing `domain text` column is RETAINED (data safety — never drop columns).
  New inserts/updates use `domain_id`; the old `domain` text column is kept for
  backward reference but is no longer the source of truth.
- Backfilled `domain_id` for existing rows based on the legacy `domain` text value.

## Data Restoration
- Restores the 3 Life Skills statements that were lost: "Makes decisions
  confidently during group activities", "Completes tasks independently",
  "Works well with others in team/group tasks".
- Seeds 2 default domains (Social-Emotional, Life Skills) mapped to the existing
  statements.

## Security
- RLS enabled on checklist_domains.
- 4 policies: super-admin write (insert/update/delete), authenticated read.
- checklist_statements existing policies unchanged (still super-admin write,
  authenticated read).

## Important notes
1. The `domain` text column on checklist_statements is kept but deprecated.
   Frontend now reads `domain_id` and joins to checklist_domains for the label,
   icon, and color.
2. Anecdotal notes keep their own `tagged_domain` text enum unchanged — those
   are separate from checklist domains and remain social_emotional/life_skills/
   academic.
3. Default domains seeded with display_order 1 and 2.
*/

-- ──────────────── checklist_domains ────────────────
CREATE TABLE IF NOT EXISTS checklist_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL,
  color text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE checklist_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklist_domain_select" ON checklist_domains;
CREATE POLICY "checklist_domain_select" ON checklist_domains
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "checklist_domain_insert" ON checklist_domains;
CREATE POLICY "checklist_domain_insert" ON checklist_domains
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "checklist_domain_update" ON checklist_domains;
CREATE POLICY "checklist_domain_update" ON checklist_domains
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "checklist_domain_delete" ON checklist_domains;
CREATE POLICY "checklist_domain_delete" ON checklist_domains
  FOR DELETE TO authenticated USING (is_super_admin());

CREATE INDEX IF NOT EXISTS idx_checklist_domains_order ON checklist_domains(display_order);

-- ──────────────── Add domain_id to checklist_statements ────────────────
ALTER TABLE checklist_statements
  ADD COLUMN IF NOT EXISTS domain_id uuid REFERENCES checklist_domains(id) ON DELETE CASCADE;

-- ──────────────── Seed default domains ────────────────
INSERT INTO checklist_domains (name, icon, color, display_order)
SELECT 'Social-Emotional', 'heart', 'var(--coral)', 1
WHERE NOT EXISTS (SELECT 1 FROM checklist_domains WHERE name = 'Social-Emotional');

INSERT INTO checklist_domains (name, icon, color, display_order)
SELECT 'Life Skills', 'wrench', 'var(--sky)', 2
WHERE NOT EXISTS (SELECT 1 FROM checklist_domains WHERE name = 'Life Skills');

-- ──────────────── Backfill domain_id from legacy domain text ────────────────
UPDATE checklist_statements s
SET domain_id = (
  SELECT cd.id FROM checklist_domains cd
  WHERE (s.domain = 'social_emotional' AND cd.name = 'Social-Emotional')
     OR (s.domain = 'life_skills' AND cd.name = 'Life Skills')
)
WHERE s.domain_id IS NULL
  AND s.domain IN ('social_emotional', 'life_skills');

-- ──────────────── Restore lost Life Skills statements ────────────────
-- Only insert if they don't already exist (idempotent).
INSERT INTO checklist_statements (domain, domain_id, statement_text, display_order)
SELECT 'life_skills', cd.id, stmt.statement_text, stmt.display_order
FROM checklist_domains cd
CROSS JOIN (VALUES
  ('Makes decisions confidently during group activities', 1),
  ('Completes tasks independently', 2),
  ('Works well with others in team/group tasks', 3)
) AS stmt(statement_text, display_order)
WHERE cd.name = 'Life Skills'
  AND NOT EXISTS (
    SELECT 1 FROM checklist_statements cs
    WHERE cs.statement_text = stmt.statement_text
  );
