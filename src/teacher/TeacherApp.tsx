import { useHashRoute, matchPath, navigate } from '@/lib/router';
import { TeacherGate } from '@/teacher/TeacherGate';
import { TeacherLayout } from '@/teacher/TeacherLayout';
import { ClassHome } from '@/teacher/ClassHome';
import { Attendance } from '@/teacher/Attendance';
import { ActivityPlayer } from '@/teacher/ActivityPlayer';
import { DailyCheckpoint } from '@/teacher/DailyCheckpoint';
import { MonthlyCheck } from '@/teacher/MonthlyCheck';
import { MarksEntry } from '@/teacher/MarksEntry';
import { ContentLibrary } from '@/teacher/ContentLibrary';
import { ClassReport, StudentReport } from '@/teacher/Reports';
import { TeacherProfile } from '@/teacher/TeacherProfile';
import { TeacherCalendar } from '@/teacher/TeacherCalendar';
import { TeacherHelp } from '@/teacher/TeacherHelp';
import { TeacherFeedback } from '@/teacher/TeacherFeedback';
import { TeacherFeedbackForm } from '@/teacher/TeacherFeedbackForm';

export function TeacherApp() {
  const path = useHashRoute();

  return (
    <TeacherGate>
      <TeacherLayout>
        {path === '/dashboard' || path === '/dashboard/' ? <ClassHome /> :
          path.startsWith('/dashboard/attendance') ? <Attendance /> :
          path.startsWith('/dashboard/library') ? <ContentLibrary /> :
          matchPath('/dashboard/activity/:activityId', path) ? <ActivityPlayer activityId={matchPath('/dashboard/activity/:activityId', path)!.activityId} /> :
          matchPath('/dashboard/checkpoint/:activityId', path) ? <DailyCheckpoint activityId={matchPath('/dashboard/checkpoint/:activityId', path)!.activityId} /> :
          path.startsWith('/dashboard/monthly') ? <MonthlyCheck /> :
          path.startsWith('/dashboard/marks') ? <MarksEntry /> :
          matchPath('/dashboard/feedback/:studentId', path) ? <TeacherFeedbackForm studentId={matchPath('/dashboard/feedback/:studentId', path)!.studentId} /> :
          path.startsWith('/dashboard/feedback') ? <TeacherFeedback /> :
          matchPath('/dashboard/reports/:studentId', path) ? <StudentReport studentId={matchPath('/dashboard/reports/:studentId', path)!.studentId} /> :
          path.startsWith('/dashboard/reports') ? <ClassReport /> :
          path.startsWith('/dashboard/profile') ? <TeacherProfile /> :
          path.startsWith('/dashboard/calendar') ? <TeacherCalendar /> :
          path.startsWith('/dashboard/help') ? <TeacherHelp /> :
          <NotFound onHome={() => navigate('/dashboard')} />}
      </TeacherLayout>
    </TeacherGate>
  );
}

function NotFound({ onHome }: { onHome: () => void }) {
  return (
    <div className="text-center py-16">
      <p className="text-2xl font-extrabold text-[var(--ink)]">Page not found</p>
      <button onClick={onHome} className="mt-4 text-[var(--terracotta)] font-bold hover:underline">Back to class home</button>
    </div>
  );
}
