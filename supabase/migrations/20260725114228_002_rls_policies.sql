/*
# Little Minds — Row Level Security Policies

## Purpose
Enforce strict multi-tenant isolation at the database level so that:
  - A teacher in School A can NEVER read or write School B's classes, students,
    attendance, daily_checkpoints, monthly_checks, or class_progress — even if
    they guess an ID or URL.
  - Super admins can read and manage everything across all schools.
  - Global content (activities + quiz_questions) is readable by all
    authenticated users but writable ONLY by super admins.

## Role Model
- Teachers: `id` lives in `auth.users`; their `school_id` is in the `teachers`
  table. Their JWT app_metadata has no `role` (default teacher).
- Super admins: `id` lives in `auth.users`; their JWT app_metadata has
  `role = 'super_admin'`. Detected via the `is_super_admin()` helper.

## Per-table policy summary

1. **super_admins** — a super admin can read/update only their own row; super
   admins can read all rows. (The bootstrap edge function inserts the first
   one using the service role, bypassing RLS.)
2. **schools** — teachers can read their OWN school; super admins read/update
   all. Teachers cannot create or delete schools.
3. **teachers** — teachers can read colleagues in their own school only.
   Super admins read/manage all.
4. **classes** — teachers see/manage classes in their own school. Super admins
   see/manage all.
5. **students** — teachers see/manage students in classes belonging to their
   own school. Super admins see/manage all.
6. **activities** — READ for all authenticated (global library); WRITE only
   for super admins.
7. **quiz_questions** — READ for all authenticated; WRITE only super admins.
8. **attendance** — teachers manage rows for students in their school's
   classes. Super admins read all.
9. **daily_checkpoints** — same scoping as attendance.
10. **monthly_checks** — same scoping as attendance.
11. **class_progress** — teachers see/update progress for classes in their
     school. Super admins read all.

## Isolation mechanism for child tables
For students/attendance/checkpoints/monthly_checks/progress, the policy checks
membership transitively: student → class → school must equal the caller's
`auth_school_id()`. A guessed UUID from another school fails the policy.

## Notes
- Policies use `auth.uid()` and `is_super_admin()` / `auth_school_id()` helpers.
- Four separate policies per table (SELECT/INSERT/UPDATE/DELETE) — no `FOR ALL`.
*/

-- ──────────────── super_admins ────────────────
DROP POLICY IF EXISTS "sa_select_self" ON super_admins;
CREATE POLICY "sa_select_self" ON super_admins FOR SELECT
  TO authenticated USING (id = auth.uid() OR is_super_admin());

DROP POLICY IF EXISTS "sa_update_self" ON super_admins;
CREATE POLICY "sa_update_self" ON super_admins FOR UPDATE
  TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ──────────────── schools ────────────────
DROP POLICY IF EXISTS "schools_select" ON schools;
CREATE POLICY "schools_select" ON schools FOR SELECT
  TO authenticated
  USING (is_super_admin() OR id = auth_school_id());

DROP POLICY IF EXISTS "schools_update" ON schools;
CREATE POLICY "schools_update" ON schools FOR UPDATE
  TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "schools_insert" ON schools;
CREATE POLICY "schools_insert" ON schools FOR INSERT
  TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "schools_delete" ON schools;
CREATE POLICY "schools_delete" ON schools FOR DELETE
  TO authenticated USING (is_super_admin());

-- ──────────────── teachers ────────────────
DROP POLICY IF EXISTS "teachers_select" ON teachers;
CREATE POLICY "teachers_select" ON teachers FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = auth_school_id());

DROP POLICY IF EXISTS "teachers_insert" ON teachers;
CREATE POLICY "teachers_insert" ON teachers FOR INSERT
  TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "teachers_update" ON teachers;
CREATE POLICY "teachers_update" ON teachers FOR UPDATE
  TO authenticated
  USING (is_super_admin() OR school_id = auth_school_id())
  WITH CHECK (is_super_admin() OR school_id = auth_school_id());

DROP POLICY IF EXISTS "teachers_delete" ON teachers;
CREATE POLICY "teachers_delete" ON teachers FOR DELETE
  TO authenticated USING (is_super_admin());

-- ──────────────── classes ────────────────
DROP POLICY IF EXISTS "classes_select" ON classes;
CREATE POLICY "classes_select" ON classes FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = auth_school_id());

DROP POLICY IF EXISTS "classes_insert" ON classes;
CREATE POLICY "classes_insert" ON classes FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin() OR school_id = auth_school_id());

DROP POLICY IF EXISTS "classes_update" ON classes;
CREATE POLICY "classes_update" ON classes FOR UPDATE
  TO authenticated
  USING (is_super_admin() OR school_id = auth_school_id())
  WITH CHECK (is_super_admin() OR school_id = auth_school_id());

DROP POLICY IF EXISTS "classes_delete" ON classes;
CREATE POLICY "classes_delete" ON classes FOR DELETE
  TO authenticated
  USING (is_super_admin() OR school_id = auth_school_id());

-- ──────────────── students ────────────────
DROP POLICY IF EXISTS "students_select" ON students;
CREATE POLICY "students_select" ON students FOR SELECT
  TO authenticated
  USING (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = students.class_id AND c.school_id = auth_school_id())
  );

DROP POLICY IF EXISTS "students_insert" ON students;
CREATE POLICY "students_insert" ON students FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = students.class_id AND c.school_id = auth_school_id())
  );

DROP POLICY IF EXISTS "students_update" ON students;
CREATE POLICY "students_update" ON students FOR UPDATE
  TO authenticated
  USING (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = students.class_id AND c.school_id = auth_school_id())
  )
  WITH CHECK (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = students.class_id AND c.school_id = auth_school_id())
  );

DROP POLICY IF EXISTS "students_delete" ON students;
CREATE POLICY "students_delete" ON students FOR DELETE
  TO authenticated
  USING (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = students.class_id AND c.school_id = auth_school_id())
  );

-- ──────────────── activities (global content) ────────────────
DROP POLICY IF EXISTS "activities_select" ON activities;
CREATE POLICY "activities_select" ON activities FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "activities_insert" ON activities;
CREATE POLICY "activities_insert" ON activities FOR INSERT
  TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "activities_update" ON activities;
CREATE POLICY "activities_update" ON activities FOR UPDATE
  TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "activities_delete" ON activities;
CREATE POLICY "activities_delete" ON activities FOR DELETE
  TO authenticated USING (is_super_admin());

-- ──────────────── quiz_questions ────────────────
DROP POLICY IF EXISTS "quiz_select" ON quiz_questions;
CREATE POLICY "quiz_select" ON quiz_questions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "quiz_insert" ON quiz_questions;
CREATE POLICY "quiz_insert" ON quiz_questions FOR INSERT
  TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "quiz_update" ON quiz_questions;
CREATE POLICY "quiz_update" ON quiz_questions FOR UPDATE
  TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "quiz_delete" ON quiz_questions;
CREATE POLICY "quiz_delete" ON quiz_questions FOR DELETE
  TO authenticated USING (is_super_admin());

-- ──────────────── attendance ────────────────
DROP POLICY IF EXISTS "att_select" ON attendance;
CREATE POLICY "att_select" ON attendance FOR SELECT
  TO authenticated
  USING (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = attendance.class_id AND c.school_id = auth_school_id())
  );

DROP POLICY IF EXISTS "att_insert" ON attendance;
CREATE POLICY "att_insert" ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = attendance.class_id AND c.school_id = auth_school_id())
  );

DROP POLICY IF EXISTS "att_update" ON attendance;
CREATE POLICY "att_update" ON attendance FOR UPDATE
  TO authenticated
  USING (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = attendance.class_id AND c.school_id = auth_school_id())
  )
  WITH CHECK (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = attendance.class_id AND c.school_id = auth_school_id())
  );

DROP POLICY IF EXISTS "att_delete" ON attendance;
CREATE POLICY "att_delete" ON attendance FOR DELETE
  TO authenticated
  USING (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = attendance.class_id AND c.school_id = auth_school_id())
  );

-- ──────────────── daily_checkpoints ────────────────
DROP POLICY IF EXISTS "cp_select" ON daily_checkpoints;
CREATE POLICY "cp_select" ON daily_checkpoints FOR SELECT
  TO authenticated
  USING (
    is_super_admin() OR
    EXISTS (
      SELECT 1 FROM classes c
      JOIN students s ON s.id = daily_checkpoints.student_id
      WHERE c.id = s.class_id AND c.school_id = auth_school_id()
    )
  );

DROP POLICY IF EXISTS "cp_insert" ON daily_checkpoints;
CREATE POLICY "cp_insert" ON daily_checkpoints FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin() OR
    EXISTS (
      SELECT 1 FROM classes c
      JOIN students s ON s.id = daily_checkpoints.student_id
      WHERE c.id = s.class_id AND c.school_id = auth_school_id()
    )
  );

DROP POLICY IF EXISTS "cp_update" ON daily_checkpoints;
CREATE POLICY "cp_update" ON daily_checkpoints FOR UPDATE
  TO authenticated
  USING (
    is_super_admin() OR
    EXISTS (
      SELECT 1 FROM classes c
      JOIN students s ON s.id = daily_checkpoints.student_id
      WHERE c.id = s.class_id AND c.school_id = auth_school_id()
    )
  )
  WITH CHECK (
    is_super_admin() OR
    EXISTS (
      SELECT 1 FROM classes c
      JOIN students s ON s.id = daily_checkpoints.student_id
      WHERE c.id = s.class_id AND c.school_id = auth_school_id()
    )
  );

DROP POLICY IF EXISTS "cp_delete" ON daily_checkpoints;
CREATE POLICY "cp_delete" ON daily_checkpoints FOR DELETE
  TO authenticated
  USING (
    is_super_admin() OR
    EXISTS (
      SELECT 1 FROM classes c
      JOIN students s ON s.id = daily_checkpoints.student_id
      WHERE c.id = s.class_id AND c.school_id = auth_school_id()
    )
  );

-- ──────────────── monthly_checks ────────────────
DROP POLICY IF EXISTS "mc_select" ON monthly_checks;
CREATE POLICY "mc_select" ON monthly_checks FOR SELECT
  TO authenticated
  USING (
    is_super_admin() OR
    EXISTS (
      SELECT 1 FROM classes c
      JOIN students s ON s.id = monthly_checks.student_id
      WHERE c.id = s.class_id AND c.school_id = auth_school_id()
    )
  );

DROP POLICY IF EXISTS "mc_insert" ON monthly_checks;
CREATE POLICY "mc_insert" ON monthly_checks FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin() OR
    EXISTS (
      SELECT 1 FROM classes c
      JOIN students s ON s.id = monthly_checks.student_id
      WHERE c.id = s.class_id AND c.school_id = auth_school_id()
    )
  );

DROP POLICY IF EXISTS "mc_update" ON monthly_checks;
CREATE POLICY "mc_update" ON monthly_checks FOR UPDATE
  TO authenticated
  USING (
    is_super_admin() OR
    EXISTS (
      SELECT 1 FROM classes c
      JOIN students s ON s.id = monthly_checks.student_id
      WHERE c.id = s.class_id AND c.school_id = auth_school_id()
    )
  )
  WITH CHECK (
    is_super_admin() OR
    EXISTS (
      SELECT 1 FROM classes c
      JOIN students s ON s.id = monthly_checks.student_id
      WHERE c.id = s.class_id AND c.school_id = auth_school_id()
    )
  );

DROP POLICY IF EXISTS "mc_delete" ON monthly_checks;
CREATE POLICY "mc_delete" ON monthly_checks FOR DELETE
  TO authenticated
  USING (
    is_super_admin() OR
    EXISTS (
      SELECT 1 FROM classes c
      JOIN students s ON s.id = monthly_checks.student_id
      WHERE c.id = s.class_id AND c.school_id = auth_school_id()
    )
  );

-- ──────────────── class_progress ────────────────
DROP POLICY IF EXISTS "cprog_select" ON class_progress;
CREATE POLICY "cprog_select" ON class_progress FOR SELECT
  TO authenticated
  USING (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = class_progress.class_id AND c.school_id = auth_school_id())
  );

DROP POLICY IF EXISTS "cprog_insert" ON class_progress;
CREATE POLICY "cprog_insert" ON class_progress FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = class_progress.class_id AND c.school_id = auth_school_id())
  );

DROP POLICY IF EXISTS "cprog_update" ON class_progress;
CREATE POLICY "cprog_update" ON class_progress FOR UPDATE
  TO authenticated
  USING (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = class_progress.class_id AND c.school_id = auth_school_id())
  )
  WITH CHECK (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = class_progress.class_id AND c.school_id = auth_school_id())
  );

DROP POLICY IF EXISTS "cprog_delete" ON class_progress;
CREATE POLICY "cprog_delete" ON class_progress FOR DELETE
  TO authenticated
  USING (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM classes c WHERE c.id = class_progress.class_id AND c.school_id = auth_school_id())
  );
