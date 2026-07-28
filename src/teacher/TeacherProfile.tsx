import { useEffect, useState } from 'react';
import { User, Mail, Building2, GraduationCap, KeyRound, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useClassContext } from '@/teacher/useClassContext';
import type { School } from '@/lib/types';
import { Card, Button, Input, Spinner } from '@/components/ui';

export function TeacherProfile() {
  const { teacher, user } = useAuth();
  const { school, classes } = useClassContext();
  const [myClasses, setMyClasses] = useState<{ id: string; name: string; grade_level: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  // password change
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!teacher) return;
      const { data } = await supabase.from('classes').select('id, name, grade_level').eq('teacher_id', teacher.id).order('name');
      if (!active) return;
      setMyClasses((data as { id: string; name: string; grade_level: string | null }[]) ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [teacher]);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwErr(null); setPwMsg(null);
    if (newPw.length < 6) { setPwErr('New password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw) { setPwErr('New passwords do not match.'); return; }
    setPwBusy(true);
    // Confirm the current password by re-signing in.
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: teacher!.email, password: curPw });
    if (signInErr) {
      setPwBusy(false);
      setPwErr('Your current password is incorrect.');
      return;
    }
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
    setPwBusy(false);
    if (updateErr) { setPwErr(updateErr.message); return; }
    setPwMsg('Password updated. Use your new password next time you sign in.');
    setCurPw(''); setNewPw(''); setConfirmPw('');
  }

  if (loading) return <Spinner label="Loading profile…" />;

  return (
    <div className="space-y-5 lm-fade-up max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <User size={20} className="text-[var(--terracotta)]" />
        <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>My Profile</h1>
      </div>

      <Card className="p-5">
        <h3 className="font-extrabold text-[var(--ink)] mb-4">Account details</h3>
        <div className="space-y-4">
          <Row icon={<User size={16} />} label="Name" value={teacher?.name ?? '—'} />
          <Row icon={<Mail size={16} />} label="Email" value={teacher?.email ?? '—'} />
          <Row icon={<Building2 size={16} />} label="School" value={school?.name ?? '—'} />
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-2 w-40 shrink-0 text-[var(--ink-soft)]">
              <GraduationCap size={16} />
              <span className="text-sm font-semibold">Assigned classes</span>
            </div>
            <div className="flex-1">
              {myClasses.length === 0 ? (
                <p className="text-sm text-[var(--ink)]">No classes assigned yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {myClasses.map((c) => (
                    <span key={c.id} className="lm-chip bg-[var(--cream-deep)] text-[var(--ink)]">{c.name}{c.grade_level ? ` · ${c.grade_level}` : ''}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-[var(--ink-soft)] mt-4 pt-4 border-t border-[var(--line)]">Your name and school are managed by your admin. If something looks wrong, ask them to update it.</p>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={18} className="text-[var(--terracotta)]" />
          <h3 className="font-extrabold text-[var(--ink)]">Change password</h3>
        </div>
        <p className="text-sm text-[var(--ink-soft)] mb-4">Enter your current password to confirm, then choose a new one.</p>
        <form onSubmit={changePassword} className="space-y-3 max-w-sm">
          <Input label="Current password" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} required autoComplete="current-password" />
          <Input label="New password" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required autoComplete="new-password" />
          <Input label="Confirm new password" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required autoComplete="new-password" />
          {pwErr && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{pwErr}</p>}
          {pwMsg && <p className="text-sm font-semibold text-[var(--sage-deep)] bg-[#f4f4f5] rounded-lg px-3 py-2">{pwMsg}</p>}
          <Button type="submit" disabled={pwBusy}>
            {pwBusy ? <><Loader2 size={16} className="animate-spin" /> Updating…</> : 'Update password'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 w-40 shrink-0 text-[var(--ink-soft)]">
        {icon}
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <p className="text-sm font-bold text-[var(--ink)] flex-1">{value}</p>
    </div>
  );
}
