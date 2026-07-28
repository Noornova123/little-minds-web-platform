import { useState } from 'react';
import { Brain, Sparkles, Heart, ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { navigate } from '@/lib/router';
import { Button, Input } from '@/components/ui';

export function PublicSite() {
  const { user, role } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  // If already signed in as a teacher, send them to their dashboard.
  if (user && role === 'teacher') {
    return <RedirectToDashboard />;
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(170deg, #ffffff 0%, #f4f4f5 60%, #e4e4e7 100%)' }}>
      {/* Top bar */}
      <header className="px-5 sm:px-8 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[var(--terracotta)] flex items-center justify-center text-white">
            <Brain size={22} />
          </div>
          <span className="text-xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Little Minds</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowLogin(true)}>Teacher sign in</Button>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-8 pb-20 grid lg:grid-cols-2 gap-10 items-center">
        <div className="lm-fade-up">
          <span className="lm-chip bg-[#f4f4f5] text-[var(--terracotta)] mb-4">Daily classroom brain & focus activities</span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[var(--ink)] leading-[1.1] mb-4" style={{ fontFamily: 'Fraunces, serif' }}>
            Calm, focused,<br />curious classrooms.
          </h1>
          <p className="text-lg text-[var(--ink-soft)] mb-6 max-w-md leading-relaxed">
            A daily 10-minute routine of focus, brain, and behaviour activities for every class. Track growth, celebrate progress, and share it with parents.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={() => setShowLogin(true)}>Teacher sign in <ArrowRight size={18} /></Button>
          </div>
          <p className="text-xs text-[var(--ink-soft)] mt-4">Schools are set up by Little Minds. Ask your admin for sign-in details.</p>
        </div>

        {/* Decorative cards */}
        <div className="hidden lg:block lm-fade-up">
          <div className="grid grid-cols-2 gap-4">
            <FeatureCard icon={<Sparkles size={22} />} tone="var(--terracotta)" title="Daily activities" body="A new focus, brain, or behaviour exercise every day, ready to run in class." />
            <FeatureCard icon={<Brain size={22} />} tone="#3a5d8f" title="Growth tracking" body="Quick daily checkpoints and monthly deep-checks show how each child grows." />
            <FeatureCard icon={<Heart size={22} />} tone="var(--sage-deep)" title="Parent-ready reports" body="One-page printable reports in warm, supportive language for families." />
            <div className="lm-card p-5 flex items-center justify-center text-center" style={{ background: '#f4f4f5' }}>
              <p className="font-extrabold text-[var(--sage-deep)] text-sm">Warm, classroom-friendly, never clinical.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--line)] py-6 text-center text-xs text-[var(--ink-soft)]">
        Little Minds — daily focus for growing minds
      </footer>

      {showLogin && <TeacherLoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}

function RedirectToDashboard() {
  // The App router handles routing once role resolves; just nudge.
  navigate('/dashboard');
  return null;
}

function FeatureCard({ icon, tone, title, body }: { icon: React.ReactNode; tone: string; title: string; body: string }) {
  return (
    <div className="lm-card p-5">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${tone}1f`, color: tone }}>{icon}</div>
      <p className="font-extrabold text-[var(--ink)] mb-1">{title}</p>
      <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{body}</p>
    </div>
  );
}

function TeacherLoginModal({ onClose }: { onClose: () => void }) {
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
    else { onClose(); navigate('/dashboard'); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lm-modal-overlay">
      <div className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-sm lm-card p-6 lm-fade-up space-y-4 lm-modal-panel">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[var(--terracotta)] text-white mb-2"><Lock size={22} /></div>
          <h3 className="text-xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Teacher sign in</h3>
        </div>
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{error}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        <button type="button" onClick={onClose} className="w-full text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--terracotta)]">Back to home</button>
      </form>
    </div>
  );
}
