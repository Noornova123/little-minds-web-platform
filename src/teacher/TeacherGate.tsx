import { type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { TeacherLogin } from '@/teacher/TeacherLogin';
import { Spinner } from '@/components/ui';
import { navigate } from '@/lib/router';
import { useEffect } from 'react';

// Guards teacher routes — only teachers pass. Super admins are redirected to /admin.
export function TeacherGate({ children }: { children: ReactNode }) {
  const { loading, role, user } = useAuth();

  useEffect(() => {
    if (!loading && user && role === 'super_admin') {
      navigate('/admin');
    }
  }, [loading, user, role]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner label="Loading…" /></div>;
  }

  if (!user || role !== 'teacher') {
    return <TeacherLogin />;
  }

  return <>{children}</>;
}
