import { type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { AdminLogin } from '@/admin/AdminLogin';
import { Spinner } from '@/components/ui';

// Guards admin routes — only super_admins pass. Teachers are bounced to /login.
export function AdminGate({ children }: { children: ReactNode }) {
  const { loading, role, user } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner label="Loading…" /></div>;
  }

  if (!user || role !== 'super_admin') {
    return <AdminLogin />;
  }

  return <>{children}</>;
}
