/*
# Diagnostic Program — board on attempts

## Purpose
Records which education board (CBSE/ICSE/State Board/etc.) a screening was
run against, matching the board already added to diagnostic_topics in the
previous migration. This lets the screening pull a consistent question set
(subject + grade + board) and lets past attempts show which board they were
screened under.

## Changes
Added `board text NOT NULL DEFAULT 'CBSE'` to diagnostic_attempts.

## Important notes
This is additive only — no existing rows are affected beyond receiving the
default value, and no RLS policies change.
*/

ALTER TABLE diagnostic_attempts ADD COLUMN IF NOT EXISTS board text NOT NULL DEFAULT 'CBSE';
CREATE INDEX IF NOT EXISTS idx_diag_attempts_board ON diagnostic_attempts(board);
