import { useState } from 'react';
import { ShieldCheck, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { navigate } from '@/lib/router';
import { Button, Input, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export function AdminLogin() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // bootstrap state
  const [showBootstrap, setShowBootstrap] = useState(false);
  const [bName, setBName] = useState('');
  const [bEmail, setBEmail] = useState('');
  const [bPassword, setBPassword] = useState('');
  const [bBusy, setBBusy] = useState(false);
  const [bError, setBError] = useState<string | null>(null);
  const [bDone, setBDone] = useState<string | null>(null);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) setError(error);
  }

  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault();
    setBBusy(true);
    setBError(null);
    setBDone(null);
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bootstrap`;
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ email: bEmail.trim(), password: bPassword, name: bName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bootstrap failed');
      setBDone(data.message || 'Admin account created. You can now sign in.');
      setBName(''); setBEmail(''); setBPassword('');
    } catch (err) {
      setBError(err instanceof Error ? err.message : 'Bootstrap failed');
    } finally {
      setBBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(160deg, var(--cream) 0%, var(--cream-deep) 100%)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--ink)] text-[var(--cream)] mb-3">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Admin Console</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-1">Little Minds platform management</p>
        </div>

        {!showBootstrap ? (
          <form onSubmit={handleSignIn} className="lm-card p-6 lm-fade-up space-y-4">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@littleminds.io" required autoFocus />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            {error && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{error}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setShowBootstrap(true)}
                className="text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--terracotta)] inline-flex items-center gap-1"
              >
                <Lock size={12} /> First-time setup? Claim admin
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleBootstrap} className="lm-card p-6 lm-fade-up space-y-4">
            <div className="flex items-center gap-2 text-[var(--ink-soft)] text-sm">
              <Lock size={14} />
              <span>Available only when no admin exists yet.</span>
            </div>
            <Input label="Your name" value={bName} onChange={(e) => setBName(e.target.value)} required />
            <Input label="Email" type="email" value={bEmail} onChange={(e) => setBEmail(e.target.value)} required />
            <Input label="Password" type="password" value={bPassword} onChange={(e) => setBPassword(e.target.value)} placeholder="Choose a strong password" required />
            {bError && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{bError}</p>}
            {bDone && <p className="text-sm font-semibold text-[var(--sage-deep)] bg-[#f4f4f5] rounded-lg px-3 py-2">{bDone}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={bBusy}>
              {bBusy ? 'Creating admin…' : 'Create admin account'}
            </Button>
            <button type="button" onClick={() => setShowBootstrap(false)} className="w-full text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--terracotta)]">
              Back to sign in
            </button>
          </form>
        )}

        <p className="text-center text-xs text-[var(--ink-soft)] mt-6">
          <button onClick={() => navigate('/login')} className="hover:text-[var(--terracotta)] font-semibold">School & teacher sign-in →</button>
        </p>
      </div>
    </div>
  );
}
