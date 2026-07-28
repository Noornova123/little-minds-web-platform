import { useState, useEffect, useRef } from 'react';
import { Brain, LogOut, Menu, X, Home, Library, FileText, User, CalendarDays, LifeBuoy, ChevronLeft, School, ClipboardList } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { navigate, useHashRoute, matchPath } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import type { School as SchoolType } from '@/lib/types';

export function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { teacher, signOut } = useAuth();
  const path = useHashRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [school, setSchool] = useState<SchoolType | null>(null);

  const onReports = path.startsWith('/dashboard/reports');
  const onHome = path === '/dashboard' || path === '/dashboard/';
  const onLibrary = path.startsWith('/dashboard/library');
  const onProfile = path.startsWith('/dashboard/profile');
  const onCalendar = path.startsWith('/dashboard/calendar');
  const onMarks = path.startsWith('/dashboard/marks');
  const onHelp = path.startsWith('/dashboard/help');

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  // Close menu on route change.
  useEffect(() => { setMenuOpen(false); }, [path]);

  // Load the teacher's school so we can show its name in the topbar.
  useEffect(() => {
    if (!teacher) { setSchool(null); return; }
    let active = true;
    (async () => {
      const { data } = await supabase.from('schools').select('*').eq('id', teacher.school_id).maybeSingle();
      if (active) setSchool(data as SchoolType | null);
    })();
    return () => { active = false; };
  }, [teacher]);

  function handleSignOut() {
    signOut();
    navigate('/');
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--cream)' }}>
      <header className="sticky top-0 z-30 bg-[var(--cream)]/90 backdrop-blur border-b border-[var(--line)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          {/* Hamburger menu */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-xl hover:bg-[var(--cream-deep)] transition-colors"
              aria-label="Menu"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            {menuOpen && (
              <div className="absolute left-0 top-full mt-2 w-60 lm-card p-2 lm-fade-up z-40">
                <p className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">Menu</p>
                <MenuItem icon={<Home size={18} />} label="Home" active={onHome} onClick={() => navigate('/dashboard')} />
                <MenuItem icon={<Library size={18} />} label="Content Library" active={onLibrary} onClick={() => navigate('/dashboard/library')} />
                <MenuItem icon={<FileText size={18} />} label="Reports" active={onReports} onClick={() => navigate('/dashboard/reports')} />
                <MenuItem icon={<CalendarDays size={18} />} label="Calendar" active={onCalendar} onClick={() => navigate('/dashboard/calendar')} />
                <MenuItem icon={<ClipboardList size={18} />} label="Marks Entry" active={onMarks} onClick={() => navigate('/dashboard/marks')} />
                <MenuItem icon={<User size={18} />} label="My Profile" active={onProfile} onClick={() => navigate('/dashboard/profile')} />
                <MenuItem icon={<LifeBuoy size={18} />} label="Help & Resources" active={onHelp} onClick={() => navigate('/dashboard/help')} />
                <div className="my-2 border-t border-[var(--line)]" />
                <div className="px-3 py-2">
                  <p className="text-xs font-bold text-[var(--ink)] truncate">{teacher?.name}</p>
                  <p className="text-[11px] text-[var(--ink-soft)] truncate">{teacher?.email}</p>
                </div>
                <MenuItem icon={<LogOut size={18} />} label="Sign out" onClick={handleSignOut} danger />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--terracotta)] flex items-center justify-center text-white lm-wiggle">
              <Brain size={20} />
            </div>
            <div className="hidden sm:block leading-tight">
              <p className="font-extrabold text-[var(--ink)] leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>Little Minds</p>
              {school && (
                <p className="text-[11px] font-bold text-[var(--ink-soft)] flex items-center gap-1 leading-tight mt-0.5">
                  <School size={10} />{school.name}{school.principal_name ? ` · ${school.principal_name}` : ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex-1" />

          {/* Back button shows on sub-screens for quick navigation */}
          {showBack(path) && (
            <button onClick={() => navigate('/dashboard')} className="p-2 rounded-xl text-[var(--ink-soft)] hover:bg-[var(--cream-deep)] transition-colors" title="Class home">
              <ChevronLeft size={20} />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}

function showBack(path: string): boolean {
  if (path.startsWith('/dashboard/library')) return true;
  if (path.startsWith('/dashboard/reports/') && matchPath('/dashboard/reports/:studentId', path)) return true;
  if (path.startsWith('/dashboard/profile')) return true;
  if (path.startsWith('/dashboard/calendar')) return true;
  if (path.startsWith('/dashboard/marks')) return true;
  if (path.startsWith('/dashboard/help')) return true;
  return false;
}

function MenuItem({ icon, label, active, onClick, danger }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${danger ? 'text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]' : active ? 'bg-[var(--cream-deep)] text-[var(--ink)]' : 'text-[var(--ink-soft)] hover:bg-[var(--cream-deep)] hover:text-[var(--ink)]'}`}
    >
      {icon}
      {label}
    </button>
  );
}
