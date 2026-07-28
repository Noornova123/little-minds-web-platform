import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Teacher, SuperAdmin } from '@/lib/types';

export type AuthRole = 'teacher' | 'super_admin' | null;

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: AuthRole;
  teacher: Teacher | null;
  admin: SuperAdmin | null;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    user: null,
    role: null,
    teacher: null,
    admin: null,
  });

  // Resolve role + profile after a session is known.
  async function resolveProfile(user: User | null) {
    if (!user) {
      setState({ loading: false, session: null, user: null, role: null, teacher: null, admin: null });
      return;
    }

    const role = (user.app_metadata?.role ?? null) as AuthRole;

    if (role === 'super_admin') {
      const { data } = await supabase
        .from('super_admins')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      setState({ loading: false, session: null, user, role, teacher: null, admin: data as SuperAdmin | null });
      return;
    }

    // Default: teacher. Look up their teacher profile.
    const { data } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    setState({
      loading: false,
      session: null,
      user,
      role: data ? 'teacher' : null,
      teacher: data as Teacher | null,
      admin: null,
    });
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session) {
        resolveProfile(session.user);
      } else {
        setState({ loading: false, session: null, user: null, role: null, teacher: null, admin: null });
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session) {
          await resolveProfile(session.user);
        } else {
          setState({ loading: false, session: null, user: null, role: null, teacher: null, admin: null });
        }
      })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
