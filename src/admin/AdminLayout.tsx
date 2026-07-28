import { type ReactNode, useState } from 'react';
import { LayoutDashboard, Building2, BookOpen, Tags, GraduationCap, Users, CreditCard, Megaphone, LifeBuoy, ImagePlus, ListChecks, ClipboardList, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useHashRoute, navigate, matchPath } from '@/lib/router';

const navItems = [
  { label: 'Overview', path: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Schools', path: '/admin/schools', icon: Building2 },
  { label: 'Content', path: '/admin/content', icon: BookOpen },
  { label: 'Categories', path: '/admin/categories', icon: Tags },
  { label: 'Grade Levels', path: '/admin/grades', icon: GraduationCap },
  { label: 'Teachers', path: '/admin/teachers', icon: Users },
  { label: 'Billing', path: '/admin/billing', icon: CreditCard },
  { label: 'Announcements', path: '/admin/announcements', icon: Megaphone },
  { label: 'Banners', path: '/admin/banners', icon: ImagePlus },
  { label: 'Checklist Statements', path: '/admin/checklist-statements', icon: ListChecks },
  { label: 'Academic Marks', path: '/admin/academic-marks', icon: ClipboardList },
  { label: 'Help Content', path: '/admin/help', icon: LifeBuoy },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { admin, signOut } = useAuth();
  const path = useHashRoute();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (item: typeof navItems[number]) =>
    item.exact ? path === item.path : path.startsWith(item.path);

  const onSchoolDetail = !!matchPath('/admin/schools/:id', path);
  const onCategories = path.startsWith('/admin/categories');
  const onGrades = path.startsWith('/admin/grades');
  const onTeachers = path.startsWith('/admin/teachers');
  const onBilling = path.startsWith('/admin/billing');
  const onAnnouncements = path.startsWith('/admin/announcements');
  const onBanners = path.startsWith('/admin/banners');
  const onChecklist = path.startsWith('/admin/checklist-statements');
  const onAcademicMarks = path.startsWith('/admin/academic-marks');
  const onHelp = path.startsWith('/admin/help');

  function handleSignOut() {
    signOut();
    navigate('/admin');
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--cream)' }}>
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-[var(--ink)] text-[var(--cream)] flex flex-col z-40 transition-transform no-print ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-[var(--terracotta)] flex items-center justify-center font-extrabold text-sm">LM</div>
          <div>
            <p className="font-extrabold text-sm leading-tight">Little Minds</p>
            <p className="text-[10px] uppercase tracking-wider text-white/50">Admin Console</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${active ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs font-bold text-white truncate">{admin?.name || 'Admin'}</p>
            <p className="text-[11px] text-white/50 truncate">{admin?.email}</p>
          </div>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-white/60 hover:text-white hover:bg-white/5 transition-colors">
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden no-print" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-[var(--cream)]/85 backdrop-blur border-b border-[var(--line)] px-4 lg:px-8 py-3 flex items-center gap-3 no-print">
          <button className="lg:hidden p-2 rounded-lg hover:bg-[var(--cream-deep)]" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex-1">
            <h2 className="font-extrabold text-[var(--ink)] text-lg leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>
              {onSchoolDetail ? 'School Detail' : onCategories ? 'Categories' : onGrades ? 'Grade Levels' : onTeachers ? 'Teachers' : onBilling ? 'Billing' : onAnnouncements ? 'Announcements' : onBanners ? 'Banners' : onChecklist ? 'Checklist Statements' : onAcademicMarks ? 'Academic Marks' : onHelp ? 'Help Content' : navItems.find((i) => isActive(i))?.label ?? 'Admin'}
            </h2>
          </div>
        </header>

        <main className="flex-1 px-4 lg:px-8 py-6 lg:py-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
