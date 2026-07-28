import { useState, useEffect } from 'react';
import { ShieldCheck, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button, Input, Spinner } from '@/components/ui';
import { navigate } from '@/lib/router';

// One-time bootstrap route. The edge function refuses to run if any
// super_admin already exists, so this page is safe to leave reachable.
export function AdminBootstrap() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [alreadyHasAdmin, setAlreadyHasAdmin] = useState(false);

  // We can't directly check super_admins from the anon client (RLS), so we
  // rely on the edge function's guard. We still render the form; if an admin
  // exists, submission returns a clear error.
  useEffect(() => { setChecking(false); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setDone(null);
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bootstrap`;
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ email: email.trim(), password, name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) setAlreadyHasAdmin(true);
        throw new Error(data.error || 'Bootstrap failed');
      }
      setDone(data.message || 'Admin account created. You can now sign in at /admin.');
      setName(''); setEmail(''); setPassword('');
    } catch (err) {
      setErr(err instanceof Error ? err.message : 'Bootstrap failed');
    } finally {
      setBusy(false);
    }
  }

  if (checking) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>;

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(160deg, var(--cream) 0%, var(--cream-deep) 100%)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--ink)] text-[var(--cream)] mb-3">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>First-time setup</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-1 flex items-center justify-center gap-1"><Lock size={12} /> Claim the first super admin account</p>
        </div>

        {alreadyHasAdmin ? (
          <div className="lm-card p-6 text-center space-y-3">
            <AlertCircle size={32} className="mx-auto text-[var(--amber)]" />
            <p className="font-bold text-[var(--ink)]">An admin account already exists</p>
            <p className="text-sm text-[var(--ink-soft)]">Bootstrap is disabled for security. Sign in at /admin instead.</p>
            <Button onClick={() => navigate('/admin')}>Go to admin sign in</Button>
          </div>
        ) : done ? (
          <div className="lm-card p-6 text-center space-y-3">
            <CheckCircle2 size={32} className="mx-auto text-[var(--sage-deep)]" />
            <p className="font-bold text-[var(--ink)]">Admin account created</p>
            <p className="text-sm text-[var(--ink-soft)]">{done}</p>
            <Button onClick={() => navigate('/admin')}>Go to admin sign in</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="lm-card p-6 lm-fade-up space-y-4">
            <Input label="Your name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Choose a strong password" required />
            {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>{busy ? 'Creating admin…' : 'Create admin account'}</Button>
            <p className="text-xs text-center text-[var(--ink-soft)]">This only works once, before any admin exists.</p>
          </form>
        )}

        <p className="text-center text-xs text-[var(--ink-soft)] mt-6">
          <button onClick={() => navigate('/admin')} className="hover:text-[var(--terracotta)] font-semibold">← Back to admin sign in</button>
        </p>
      </div>
    </div>
  );
}
