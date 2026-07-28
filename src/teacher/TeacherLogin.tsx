import { useState } from 'react';
import { Brain, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { navigate } from '@/lib/router';
import { Button, Input } from '@/components/ui';

// Separate teacher login at /login. No mention of admin anywhere here.
export function TeacherLogin() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) setError(error);
    else { sessionStorage.setItem('lm-welcome-shown', 'pending'); navigate('/dashboard'); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(160deg, #ffffff 0%, #f4f4f5 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--terracotta)] text-white mb-3">
            <Brain size={28} />
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Teacher sign in</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-1">Welcome back to your classroom</p>
        </div>
        <form onSubmit={submit} className="lm-card p-6 lm-fade-up space-y-4">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>
        <p className="text-center text-xs text-[var(--ink-soft)] mt-5 flex items-center justify-center gap-1">
          <Lock size={12} /> Don't have an account? Ask your school admin.
        </p>
        <p className="text-center mt-3">
          <button onClick={() => navigate('/')} className="text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--terracotta)]">← Back to home</button>
        </p>
      </div>
    </div>
  );
}
