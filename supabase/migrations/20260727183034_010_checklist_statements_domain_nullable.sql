/*
# Make checklist_statements.domain nullable

## Purpose
The legacy `domain` text column on checklist_statements was kept (data safety)
but is now superseded by the `domain_id` FK to checklist_domains. New inserts
use `domain_id` only. The `domain` column's NOT NULL constraint blocks those
inserts, so it must be relaxed to nullable.

## Modified Tables
### checklist_statements
- `domain text NOT NULL` → `domain text` (nullable). Existing rows keep their
  values; new rows may leave it null since domain_id is the source of truth.

## Security
No RLS or policy changes.
*/

ALTER TABLE checklist_statements ALTER COLUMN domain DROP NOT NULL;
