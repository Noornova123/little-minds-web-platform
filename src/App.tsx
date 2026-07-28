import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useHashRoute, navigate } from '@/lib/router';
import { PublicSite } from '@/teacher/PublicSite';
import { TeacherApp } from '@/teacher/TeacherApp';
import { AdminApp } from '@/admin/AdminApp';

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}

function Router() {
  const path = useHashRoute();
  const { user, role, loading } = useAuth();

  // Once a teacher is signed in and lands on "/" or "/login", send them to dashboard.
  useEffect(() => {
    if (loading) return;
    if (user && role === 'teacher' && (path === '/' || path === '/login')) {
      navigate('/dashboard');
    }
    if (user && role === 'super_admin' && (path === '/' || path === '/login' || path === '/dashboard' || path.startsWith('/dashboard'))) {
      navigate('/admin');
    }
  }, [loading, user, role, path]);

  // ── Admin shell: anything under /admin ──
  // This is the critical access separation. /admin is never linked from the
  // teacher-facing or public UI; it's only reachable by typing the URL.
  if (path === '/admin' || path.startsWith('/admin/')) {
    return <AdminApp />;
  }

  // ── Teacher shell: anything under /dashboard ──
  if (path === '/dashboard' || path.startsWith('/dashboard/')) {
    return <TeacherApp />;
  }

  // ── Public site + /login (teacher login) ──
  // "/" and "/login" both render the public site (which has its own login modal),
  // or the dedicated /login page. No mention of admin anywhere here.
  if (path === '/login') {
    return <PublicSite />;
  }

  // Default: public site at "/"
  return <PublicSite />;
}
