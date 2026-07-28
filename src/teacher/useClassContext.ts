import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { ClassRow, School, Student, ClassProgress } from '@/lib/types';

interface ClassContext {
  school: School | null;
  classes: ClassRow[];
  selectedClass: ClassRow | null;
  students: Student[];
  progress: ClassProgress | null;
  loading: boolean;
  selectClass: (id: string) => void;
  refresh: () => Promise<void>;
}

const STORAGE_KEY = 'lm-selected-class';

export function useClassContext(): ClassContext {
  const { teacher } = useAuth();
  const [school, setSchool] = useState<School | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [students, setStudents] = useState<Student[]>([]);
  const [progress, setProgress] = useState<ClassProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const loadClasses = useCallback(async () => {
    if (!teacher) return;
    setLoading(true);
    const [{ data: schoolData }, { data: classData }] = await Promise.all([
      supabase.from('schools').select('*').eq('id', teacher.school_id).maybeSingle(),
      supabase.from('classes').select('*').eq('school_id', teacher.school_id).order('name'),
    ]);
    setSchool(schoolData as School | null);
    setClasses((classData as ClassRow[]) ?? []);

    // Auto-select a class if none chosen, or if the chosen one no longer belongs.
    const valid = (classData as ClassRow[]) ?? [];
    let chosen = selectedId && valid.find((c) => c.id === selectedId) ? selectedId : null;
    if (!chosen && valid.length > 0) chosen = valid[0].id;
    if (chosen && chosen !== selectedId) {
      setSelectedId(chosen);
      localStorage.setItem(STORAGE_KEY, chosen);
    }
    if (!chosen) {
      setStudents([]); setProgress(null); setLoading(false);
    }
  }, [teacher, selectedId]);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  // Load students + progress whenever selection changes.
  useEffect(() => {
    if (!selectedId) { setStudents([]); setProgress(null); return; }
    let active = true;
    (async () => {
      const [{ data: st }, { data: prog }] = await Promise.all([
        supabase.from('students').select('*').eq('class_id', selectedId).order('roll_number'),
        supabase.from('class_progress').select('*').eq('class_id', selectedId).maybeSingle(),
      ]);
      if (!active) return;
      setStudents((st as Student[]) ?? []);
      setProgress((prog as ClassProgress) ?? null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [selectedId]);

  const selectClass = useCallback((id: string) => {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const selectedClass = classes.find((c) => c.id === selectedId) ?? null;

  const refresh = useCallback(async () => {
    if (!selectedId) return;
    const [{ data: st }, { data: prog }] = await Promise.all([
      supabase.from('students').select('*').eq('class_id', selectedId).order('roll_number'),
      supabase.from('class_progress').select('*').eq('class_id', selectedId).maybeSingle(),
    ]);
    setStudents((st as Student[]) ?? []);
    setProgress((prog as ClassProgress) ?? null);
  }, [selectedId]);

  return { school, classes, selectedClass, students, progress, loading, selectClass, refresh };
}
