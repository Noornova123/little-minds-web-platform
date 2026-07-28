import { useEffect, useState } from 'react';
import { CreditCard, Search, Loader2, IndianRupee } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { School } from '@/lib/types';
import { Card, Button, Input, Spinner, EmptyState, Badge } from '@/components/ui';

interface BillingSchool extends School {
  student_count: number;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  active: 'success', trial: 'warning', suspended: 'error', expired: 'error',
};

export function AdminBilling() {
  const [rows, setRows] = useState<BillingSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    const { data: schools, error } = await supabase.from('schools').select('*').order('name');
    if (error) { setErr(error.message); setLoading(false); return; }
    // Count students per school via classes.
    const enriched = await Promise.all((schools as School[]).map(async (s) => {
      // Count students for this school by joining through classes.
      const { data: classIds } = await supabase.from('classes').select('id').eq('school_id', s.id);
      const ids = (classIds as { id: string }[]) ?? [];
      let count = 0;
      if (ids.length > 0) {
        const { count: c } = await supabase.from('students').select('id', { count: 'exact', head: true }).in('class_id', ids.map((c) => c.id));
        count = c ?? 0;
      }
      return { ...s, student_count: count };
    }));
    setRows(enriched);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveField(id: string, field: 'next_renewal_date' | 'monthly_amount', value: string) {
    setSaving(id); setErr(null);
    const patch: Record<string, string | number | null> = {};
    if (field === 'monthly_amount') patch[field] = value ? Number(value) : null;
    else patch[field] = value || null;
    const { error } = await supabase.from('schools').update(patch).eq('id', id);
    setSaving(null);
    if (error) { setErr(error.message); return; }
    load();
  }

  const filtered = rows.filter((s) => !query || s.name.toLowerCase().includes(query.toLowerCase()));
  const totalRevenue = rows.filter((s) => s.subscription_status === 'active' && s.monthly_amount).reduce((sum, s) => sum + Number(s.monthly_amount ?? 0), 0);

  return (
    <div className="space-y-5 lm-fade-up">
      <div className="flex items-center gap-2">
        <CreditCard size={20} className="text-[var(--terracotta)]" />
        <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Billing</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-5">
          <p className="text-xs font-extrabold uppercase text-[var(--ink-soft)]">Monthly revenue (active)</p>
          <p className="text-3xl font-extrabold text-[var(--sage-deep)] mt-1" style={{ fontFamily: 'Fraunces, serif' }}>
            <IndianRupee size={22} className="inline -mt-1" />{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-extrabold uppercase text-[var(--ink-soft)]">Active schools</p>
          <p className="text-3xl font-extrabold text-[var(--ink)] mt-1">{rows.filter((s) => s.subscription_status === 'active').length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-extrabold uppercase text-[var(--ink-soft)]">Total students</p>
          <p className="text-3xl font-extrabold text-[var(--ink)] mt-1">{rows.reduce((sum, s) => sum + s.student_count, 0)}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
          <input className="lm-input pl-9" placeholder="Search schools…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </Card>

      {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>}

      {loading ? <Spinner label="Loading billing…" /> : filtered.length === 0 ? (
        <Card className="p-5"><EmptyState title="No schools found" /></Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          {/* Desktop: table */}
          <div className="overflow-x-auto lm-responsive-table">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-[11px] font-extrabold uppercase text-[var(--ink-soft)]">
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Days unlocked</th>
                  <th className="px-4 py-3">Students</th>
                  <th className="px-4 py-3">Monthly amount</th>
                  <th className="px-4 py-3">Next renewal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--cream-deep)]/40">
                    <td className="px-4 py-3 font-bold text-[var(--ink)]">{s.name}</td>
                    <td className="px-4 py-3"><Badge tone={STATUS_TONE[s.subscription_status] ?? 'neutral'}>{s.subscription_status}</Badge></td>
                    <td className="px-4 py-3 text-[var(--ink-soft)]">{s.days_unlocked_up_to}</td>
                    <td className="px-4 py-3 text-[var(--ink-soft)]">{s.student_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <IndianRupee size={12} className="text-[var(--ink-soft)]" />
                        <input
                          className="lm-input py-1 px-2 w-24"
                          type="number"
                          defaultValue={s.monthly_amount ?? ''}
                          onBlur={(e) => saveField(s.id, 'monthly_amount', e.target.value)}
                          disabled={saving === s.id}
                          placeholder="0.00"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="lm-input py-1 px-2 w-36"
                        type="date"
                        defaultValue={s.next_renewal_date ?? ''}
                        onBlur={(e) => saveField(s.id, 'next_renewal_date', e.target.value)}
                        disabled={saving === s.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile: cards */}
          <div className="lm-responsive-cards divide-y divide-[var(--line)]">
            {filtered.map((s) => (
              <div key={s.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-[var(--ink)] truncate flex-1">{s.name}</p>
                  <Badge tone={STATUS_TONE[s.subscription_status] ?? 'neutral'}>{s.subscription_status}</Badge>
                </div>
                <div className="flex gap-4 text-xs text-[var(--ink-soft)]">
                  <span>Day {s.days_unlocked_up_to} unlocked</span>
                  <span>{s.student_count} students</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-[var(--ink-soft)] block mb-1">Monthly</span>
                    <div className="flex items-center gap-1">
                      <IndianRupee size={12} className="text-[var(--ink-soft)]" />
                      <input
                        className="lm-input py-1.5 px-2 text-sm flex-1"
                        type="number"
                        defaultValue={s.monthly_amount ?? ''}
                        onBlur={(e) => saveField(s.id, 'monthly_amount', e.target.value)}
                        disabled={saving === s.id}
                        placeholder="0.00"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-[var(--ink-soft)] block mb-1">Renewal</span>
                    <input
                      className="lm-input py-1.5 px-2 text-sm flex-1"
                      type="date"
                      defaultValue={s.next_renewal_date ?? ''}
                      onBlur={(e) => saveField(s.id, 'next_renewal_date', e.target.value)}
                      disabled={saving === s.id}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-xs text-[var(--ink-soft)]">This is for your own manual record-keeping. Edit any field by typing and clicking away — changes save automatically.</p>
    </div>
  );
}
