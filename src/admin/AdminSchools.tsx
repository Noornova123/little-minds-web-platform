import { useEffect, useState } from 'react';
import { Plus, Search, ArrowRight, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import type { School, SubscriptionStatus } from '@/lib/types';
import { Card, Button, Input, Spinner, EmptyState, Badge } from '@/components/ui';
import { Modal } from '@/components/Modal';

const statusTone: Record<SubscriptionStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  active: 'success',
  trial: 'warning',
  suspended: 'error',
  expired: 'error',
};

export function AdminSchools() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  // add/edit form
  const [editing, setEditing] = useState<School | null>(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [status, setStatus] = useState<SubscriptionStatus>('trial');
  const [days, setDays] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('schools').select('*').order('created_at', { ascending: false });
    setSchools((data as School[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setName(''); setContact(''); setStatus('trial'); setDays(0);
    setErr(null);
    setShowAdd(true);
  }

  function openEdit(s: School) {
    setEditing(s);
    setName(s.name); setContact(s.contact_info ?? ''); setStatus(s.subscription_status); setDays(s.days_unlocked_up_to);
    setErr(null);
    setShowAdd(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr(null);
    const payload = { name, contact_info: contact || null, subscription_status: status, days_unlocked_up_to: Number(days) || 0 };
    let result;
    if (editing) {
      result = await supabase.from('schools').update(payload).eq('id', editing.id).select().maybeSingle();
    } else {
      result = await supabase.from('schools').insert(payload).select().maybeSingle();
    }
    setSaving(false);
    if (result.error) { setErr(result.error.message); return; }
    setShowAdd(false);
    load();
  }

  const filtered = schools.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-5 lm-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
          <input className="lm-input pl-9" placeholder="Search schools…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button onClick={openAdd}><Plus size={16} /> Add school</Button>
      </div>

      {loading ? <Spinner label="Loading schools…" /> : filtered.length === 0 ? (
        <Card><EmptyState icon={<Building2 size={36} />} title="No schools found" hint={query ? "Try a different search." : "Add your first school to get started."} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-[var(--line)]">
            {filtered.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-4 hover:bg-[var(--cream-deep)] transition-colors">
                <button onClick={() => navigate(`/admin/schools/${s.id}`)} className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[var(--ink)] truncate">{s.name}</p>
                    <Badge tone={statusTone[s.subscription_status]}>{s.subscription_status}</Badge>
                  </div>
                  <p className="text-xs text-[var(--ink-soft)] mt-0.5">Day {s.days_unlocked_up_to} unlocked · {s.contact_info || 'No contact info'}</p>
                </button>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>Edit</Button>
                  <button onClick={() => navigate(`/admin/schools/${s.id}`)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[var(--cream)]">
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title={editing ? 'Edit school' : 'Add school'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !name}>{saving ? 'Saving…' : 'Save'}</Button>
          </>
        }
      >
        <form onSubmit={save} className="space-y-4">
          <Input label="School name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Contact info" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email or phone" />
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="lm-label block mb-1.5">Subscription status</span>
              <select className="lm-input" value={status} onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}>
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="expired">Expired</option>
              </select>
            </label>
            <Input label="Days unlocked up to" type="number" min={0} value={days} onChange={(e) => setDays(Number(e.target.value))} />
          </div>
          {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>}
        </form>
      </Modal>
    </div>
  );
}
