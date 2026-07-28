import { useHashRoute, matchPath, navigate } from '@/lib/router';
import { AdminGate } from '@/admin/AdminGate';
import { AdminLayout } from '@/admin/AdminLayout';
import { AdminOverview } from '@/admin/AdminOverview';
import { AdminSchools } from '@/admin/AdminSchools';
import { AdminSchoolDetail } from '@/admin/AdminSchoolDetail';
import { AdminContent } from '@/admin/AdminContent';
import { AdminCategories } from '@/admin/AdminCategories';
import { AdminGrades } from '@/admin/AdminGrades';
import { AdminTeachers } from '@/admin/AdminTeachers';
import { AdminBilling } from '@/admin/AdminBilling';
import { AdminAnnouncements } from '@/admin/AdminAnnouncements';
import { AdminHelp } from '@/admin/AdminHelp';
import { AdminBanners } from '@/admin/AdminBanners';
import { AdminChecklistStatements } from '@/admin/AdminChecklistStatements';
import { AdminAcademicMarks } from '@/admin/AdminAcademicMarks';
import { AdminBootstrap } from '@/admin/AdminBootstrap';

export function AdminApp() {
  const path = useHashRoute();

  // Normalise: /admin, /admin/ → treat as /admin
  const isAdminRoot = path === '/admin' || path === '/admin/';

  // Bootstrap route is public — it must render before AdminGate so it works
  // when no admin is signed in. The edge function refuses to run once any
  // super_admin exists, so this is safe to leave reachable.
  if (path === '/admin/bootstrap') {
    return <AdminBootstrap />;
  }

  return (
    <AdminGate>
      <AdminLayout>
        {isAdminRoot ? <AdminOverview /> :
          matchPath('/admin/schools/:id', path) ? <AdminSchoolDetail schoolId={matchPath('/admin/schools/:id', path)!.id} /> :
          path.startsWith('/admin/schools') ? <AdminSchools /> :
          path.startsWith('/admin/content') ? <AdminContent /> :
          path.startsWith('/admin/categories') ? <AdminCategories /> :
          path.startsWith('/admin/grades') ? <AdminGrades /> :
          path.startsWith('/admin/teachers') ? <AdminTeachers /> :
          path.startsWith('/admin/billing') ? <AdminBilling /> :
          path.startsWith('/admin/announcements') ? <AdminAnnouncements /> :
          path.startsWith('/admin/help') ? <AdminHelp /> :
          path.startsWith('/admin/banners') ? <AdminBanners /> :
          path.startsWith('/admin/checklist-statements') ? <AdminChecklistStatements /> :
          path.startsWith('/admin/academic-marks') ? <AdminAcademicMarks /> :
          <NotFound onHome={() => navigate('/admin')} />}
      </AdminLayout>
    </AdminGate>
  );
}

function NotFound({ onHome }: { onHome: () => void }) {
  return (
    <div className="text-center py-16">
      <p className="text-2xl font-extrabold text-[var(--ink)]">Page not found</p>
      <button onClick={onHome} className="mt-4 text-[var(--terracotta)] font-bold hover:underline">Back to overview</button>
    </div>
  );
}
