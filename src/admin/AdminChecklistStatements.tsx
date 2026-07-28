import { useEffect, useState } from 'react';
import { ListChecks, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Loader2, FolderPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ChecklistStatement, ChecklistDomainRow } from '@/lib/types';
import { renderDomainIcon, ICON_OPTIONS, COLOR_OPTIONS } from '@/lib/domainIcons';
import { Card, Button, Input, Spinner, EmptyState, Badge } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/Modal';

export function AdminChecklistStatements() {
  const [domains, setDomains] = useState<ChecklistDomainRow[]>([]);
  const [statements, setStatements] = useState<ChecklistStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ChecklistStatement | null>(null);
  const [domainId, setDomainId] = useState<string>('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ChecklistStatement | null>(null);

  const [showDomainForm, setShowDomainForm] = useState(false);
  const [dName, setDName] = useState('');
  const [dIcon, setDIcon] = useState('heart');
  const [dColor, setDColor] = useState('var(--coral)');
  const [dBusy, setDBusy] = useState(false);
  const [dErr, setDErr] = useState<string | null>(null);
  const [confirmDeleteDomain, setConfirmDeleteDomain] = useState<ChecklistDomainRow | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    const [domRes, stmtRes] = await Promise.all([
      supabase.from('checklist_domains').select('*').order('display_order', { ascending: true }),
      supabase.from('checklist_statements').select('*').order('display_order', { ascending: true }),
    ]);
    if (domRes.error) { setErr(domRes.error.message); setLoading(false); return; }
    if (stmtRes.error) { setErr(stmtRes.error.message); setLoading(false); return; }
    setDomains((domRes.data as ChecklistDomainRow[]) ?? []);
    setStatements((stmtRes.data as ChecklistStatement[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew(dId: string) {
    setEditing(null);
    setDomainId(dId);
    setText('');
    setFormErr(null);
    setShowForm(true);
  }
  function openEdit(s: ChecklistStatement) {
    setEditing(s);
    setDomainId(s.domain_id ?? domains[0]?.id ?? '');
    setText(s.statement_text);
    setFormErr(null);
    setShowForm(true);
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim()) { setFormErr('Statement text is required.'); return; }
    if (!domainId) { setFormErr('Please select a domain.'); return; }
    setBusy(true); setFormErr(null);
    const trimmed = text.trim();
    if (editing) {
      const { error } = await supabase.from('checklist_statements').update({ statement_text: trimmed, domain_id: domainId }).eq('id', editing.id);
      setBusy(false);
      if (error) { setFormErr(error.message); return; }
    } else {
      const domainStmts = statements.filter((s) => s.domain_id === domainId);
      const nextOrder = domainStmts.length > 0 ? Math.max(...domainStmts.map((s) => s.display_order)) + 1 : 1;
      const { error } = await supabase.from('checklist_statements').insert({ domain_id: domainId, statement_text: trimmed, display_order: nextOrder }).select();
      setBusy(false);
      if (error) { setFormErr(error.message); return; }
    }
    setShowForm(false);
    await load();
  }

  async function move(s: ChecklistStatement, dir: -1 | 1) {
    const domainStmts = [...statements].filter((x) => x.domain_id === s.domain_id).sort((a, b) => a.display_order - b.display_order);
    const idx = domainStmts.findIndex((x) => x.id === s.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= domainStmts.length) return;
    const other = domainStmts[swapIdx];
    await Promise.all([
      supabase.from('checklist_statements').update({ display_order: other.display_order }).eq('id', s.id),
      supabase.from('checklist_statements').update({ display_order: s.display_order }).eq('id', other.id),
    ]);
    load();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    await supabase.from('checklist_statements').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    load();
  }

  function openNewDomain() {
    setDName('');
    setDIcon('heart');
    setDColor('var(--coral)');
    setDErr(null);
    setShowDomainForm(true);
  }

  async function saveDomain(e?: React.FormEvent) {
    e?.preventDefault();
    if (!dName.trim()) { setDErr('Domain name is required.'); return; }
    setDBusy(true); setDErr(null);
    const nextOrder = domains.length > 0 ? Math.max(...domains.map((d) => d.display_order)) + 1 : 1;
    const { error } = await supabase.from('checklist_domains').insert({ name: dName.trim(), icon: dIcon, color: dColor, display_order: nextOrder }).select();
    setDBusy(false);
    if (error) { setDErr(error.message); return; }
    setShowDomainForm(false);
    await load();
  }

  async function deleteDomain() {
    if (!confirmDeleteDomain) return;
    await supabase.from('checklist_domains').delete().eq('id', confirmDeleteDomain.id);
    setConfirmDeleteDomain(null);
    load();
  }

  async function moveDomain(d: ChecklistDomainRow, dir: -1 | 1) {
    const sorted = [...domains].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((x) => x.id === d.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    await Promise.all([
      supabase.from('checklist_domains').update({ display_order: other.display_order }).eq('id', d.id),
      supabase.from('checklist_domains').update({ display_order: d.display_order }).eq('id', other.id),
    ]);
    load();
  }

  return (
    <div className="space-y-5 lm-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ListChecks size={20} className="text-[var(--terracotta)]" />
          <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Checklist Statements</h1>
        </div>
        <Button size="sm" variant="ghost" onClick={openNewDomain}><FolderPlus size={16} /> Add Domain</Button>
      </div>

      <p className="text-sm text-[var(--ink-soft)]">These statements appear in the monthly checklist teachers fill out for each student. Add, edit, or reorder them per domain — changes take effect immediately.</p>

      {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>}

      {loading ? <Spinner label="Loading statements…" /> : domains.length === 0 ? (
        <Card className="p-5">
          <EmptyState title="No domains yet" hint="Create a domain to start adding checklist statements." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {domains.map((d) => {
            const items = statements.filter((s) => s.domain_id === d.id).sort((a, b) => a.display_order - b.display_order);
            return (
              <Card key={d.id} className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col shrink-0">
                      <button onClick={() => moveDomain(d, -1)} className="p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)]"><ArrowUp size={13} /></button>
                      <button onClick={() => moveDomain(d, 1)} className="p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)]"><ArrowDown size={13} /></button>
                    </div>
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${d.color}1f`, color: d.color }}>{renderDomainIcon(d.icon)}</span>
                    <h3 className="font-extrabold text-[var(--ink)]">{d.name}</h3>
                    <Badge tone="neutral">{items.length}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openNew(d.id)}><Plus size={14} /> Add</Button>
                    <button onClick={() => setConfirmDeleteDomain(d)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={14} /></button>
                  </div>
                </div>
                {items.length === 0 ? (
                  <EmptyState title="No statements" hint="Add one to start the checklist." />
                ) : (
                  <div className="space-y-2">
                    {items.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 rounded-2xl border border-[var(--line)] p-3">
                        <div className="flex flex-col shrink-0">
                          <button onClick={() => move(s, -1)} className="p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)]"><ArrowUp size={13} /></button>
                          <button onClick={() => move(s, 1)} className="p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)]"><ArrowDown size={13} /></button>
                        </div>
                        <p className="flex-1 text-sm font-bold text-[var(--ink)]">{s.statement_text}</p>
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-[var(--ink-soft)] hover:bg-[var(--cream-deep)] hover:text-[var(--terracotta)]"><Pencil size={14} /></button>
                        <button onClick={() => setConfirmDelete(s)} className="p-1.5 rounded-lg text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit statement' : 'Add statement'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => save()} disabled={busy}>{busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save'}</Button>
          </>
        }
      >
        <form onSubmit={save} className="space-y-4">
          <label className="block">
            <span className="lm-label block mb-1.5">Domain</span>
            <select className="lm-input" value={domainId} onChange={(e) => setDomainId(e.target.value)}>
              {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <Input label="Statement" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Shows kindness to peers" autoFocus />
          {formErr && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{formErr}</p>}
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      <Modal
        open={showDomainForm}
        onClose={() => setShowDomainForm(false)}
        title="Add domain"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDomainForm(false)}>Cancel</Button>
            <Button onClick={() => saveDomain()} disabled={dBusy}>{dBusy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Create domain'}</Button>
          </>
        }
      >
        <form onSubmit={saveDomain} className="space-y-4">
          <Input label="Domain name" value={dName} onChange={(e) => setDName(e.target.value)} placeholder="e.g. Emotional Regulation" autoFocus />
          <div>
            <span className="lm-label block mb-1.5">Icon</span>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {ICON_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setDIcon(opt.value)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all ${dIcon === opt.value ? 'border-[var(--terracotta)] bg-[var(--cream-deep)] text-[var(--terracotta)]' : 'border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--ink-soft)]'}`}
                >
                  {renderDomainIcon(opt.value, 18)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="lm-label block mb-1.5">Color</span>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setDColor(opt.value)}
                  className={`w-9 h-9 rounded-xl border-2 transition-all ${dColor === opt.value ? 'border-[var(--ink)] scale-110' : 'border-transparent'}`}
                  style={{ background: opt.value }}
                  title={opt.label}
                />
              ))}
            </div>
          </div>
          {dErr && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{dErr}</p>}
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Delete statement?"
        message={`Delete "${confirmDelete?.statement_text}"? Past responses to this statement will also be removed.`}
        confirmLabel="Delete"
        danger
      />

      <ConfirmDialog
        open={!!confirmDeleteDomain}
        onClose={() => setConfirmDeleteDomain(null)}
        onConfirm={deleteDomain}
        title="Delete domain?"
        message={`Delete "${confirmDeleteDomain?.name}" and all its statements? Past responses to those statements will also be removed.`}
        confirmLabel="Delete domain"
        danger
      />
    </div>
  );
}
