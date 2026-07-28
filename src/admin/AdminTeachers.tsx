import { useEffect, useState } from 'react';
import { Users, Search, KeyRound, Pencil, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Input, Spinner, EmptyState, Badge } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/Modal';

interface TeacherRow {
  id: string;
  name: string;
  email: string;
  school_id: string;
  school_name: string;
  classes: string[];
  last_login: string | null;
  created_at: string;
}

export function AdminTeachers() {
  const [rows, setRows] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPw, setEditPw] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-teacher?action=list`;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(fnUrl, { headers: { Authorization: `Bearer ${session?.access_token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load teachers');
      setRows(data.teachers as TeacherRow[]);
      const uniq = Array.from(new Map((data.teachers as TeacherRow[]).map((t) => [t.school_id, { id: t.school_id, name: t.school_name }])).values());
      setSchools(uniq);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openEdit(t: TeacherRow) {
    setEditing(t); setEditName(t.name); setEditEmail(t.email); setEditPw(''); setEditErr(null); setEditMsg(null);
  }

  async function saveEdit() {
    if (!editing) return;
    setEditBusy(true); setEditErr(null); setEditMsg(null);
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-teacher?action=update-profile`;
      const { data: { session } } = await supabase.auth.getSession();
      const body: Record<string, string> = { user_id: editing.id };
      if (editName.trim() && editName.trim() !== editing.name) body.name = editName.trim();
      if (editEmail.trim() && editEmail.trim() !== editing.email) body.email = editEmail.trim();
      const res = await fetch(fnUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');

      if (editPw) {
        if (editPw.length < 6) throw new Error('Password must be at least 6 characters.');
        const pwUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-teacher?action=reset-password`;
        const pwRes = await fetch(pwUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ user_id: editing.id, password: editPw }) });
        const pwData = await pwRes.json();
        if (!pwRes.ok) throw new Error(pwData.error || 'Password reset failed');
      }
      setEditMsg('Teacher updated.');
      load();
    } catch (e) {
      setEditErr(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setEditBusy(false);
    }
  }

  const filtered = rows.filter((t) => {
    if (schoolFilter !== 'all' && t.school_id !== schoolFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.email.toLowerCase().includes(q) && !t.school_name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5 lm-fade-up">
      <div className="flex items-center gap-2">
        <Users size={20} className="text-[var(--terracotta)]" />
        <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Teachers</h1>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
            <input className="lm-input pl-9" placeholder="Search by name, email, or school…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="lm-input" value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}>
            <option value="all">All schools</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </Card>

      {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>}

      {loading ? <Spinner label="Loading teachers…" /> : filtered.length === 0 ? (
        <Card className="p-5"><EmptyState title="No teachers found" hint="Adjust your search or create teachers from a school's detail page." /></Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          {/* Desktop: table */}
          <div className="overflow-x-auto lm-responsive-table">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-[11px] font-extrabold uppercase text-[var(--ink-soft)]">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Classes</th>
                  <th className="px-4 py-3">Last login</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-[var(--cream-deep)]/40">
                    <td className="px-4 py-3 font-bold text-[var(--ink)]">{t.name}</td>
                    <td className="px-4 py-3 text-[var(--ink-soft)]">{t.email}</td>
                    <td className="px-4 py-3 text-[var(--ink-soft)]">{t.school_name}</td>
                    <td className="px-4 py-3 text-[var(--ink-soft)]">{t.classes.length > 0 ? t.classes.join(', ') : '—'}</td>
                    <td className="px-4 py-3 text-[var(--ink-soft)]">{t.last_login ? new Date(t.last_login).toLocaleDateString() : 'Never'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(t)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[var(--cream-deep)] hover:text-[var(--terracotta)]"><Pencil size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile: cards */}
          <div className="lm-responsive-cards divide-y divide-[var(--line)]">
            {filtered.map((t) => (
              <div key={t.id} className="p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[var(--ink)] truncate">{t.name}</p>
                  <p className="text-xs text-[var(--ink-soft)] truncate mt-0.5">{t.email}</p>
                  <p className="text-xs text-[var(--ink-soft)] mt-1">{t.school_name}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {t.classes.length > 0 ? t.classes.map((c) => (
                      <span key={c} className="lm-chip bg-[var(--cream-deep)] text-[var(--ink-soft)] text-[10px]">{c}</span>
                    )) : <span className="text-xs text-[var(--ink-soft)]">No classes</span>}
                  </div>
                  <p className="text-[11px] text-[var(--ink-soft)] mt-1.5">Last login: {t.last_login ? new Date(t.last_login).toLocaleDateString() : 'Never'}</p>
                </div>
                <button onClick={() => openEdit(t)} className="p-2.5 rounded-lg text-[var(--ink-soft)] hover:bg-[var(--cream-deep)] hover:text-[var(--terracotta)] shrink-0"><Pencil size={16} /></button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit teacher"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Close</Button>
            <Button onClick={saveEdit} disabled={editBusy}>{editBusy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save changes'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
          <Input label="Email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
          <div>
            <Input label="Reset password (optional)" type="text" value={editPw} onChange={(e) => setEditPw(e.target.value)} placeholder="Leave blank to keep current" />
            <p className="text-xs text-[var(--ink-soft)] mt-1 flex items-center gap-1"><KeyRound size={12} /> Enter a new password only if you want to reset it.</p>
          </div>
          {editErr && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{editErr}</p>}
          {editMsg && <p className="text-sm font-semibold text-[var(--sage-deep)] bg-[#f4f4f5] rounded-lg px-3 py-2">{editMsg}</p>}
        </div>
      </Modal>
    </div>
  );
}
