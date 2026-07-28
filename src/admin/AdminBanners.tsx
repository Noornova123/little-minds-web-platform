import { useEffect, useState } from 'react';
import { ImagePlus, Trash2, ArrowUp, ArrowDown, Plus, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Banner } from '@/lib/types';
import { Card, Button, Input, Spinner, EmptyState, Badge } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { ImageUpload } from '@/components/ImageUpload';

export function AdminBanners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Banner | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    const { data, error } = await supabase.from('banners').select('*').order('display_order', { ascending: true });
    if (error) { setErr(error.message); setLoading(false); return; }
    setBanners((data as Banner[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setImageUrl(''); setTitle(''); setLinkUrl(''); setFormErr(null); setShowForm(true);
  }

  async function save() {
    if (!imageUrl.trim()) { setFormErr('Image URL is required.'); return; }
    setBusy(true); setFormErr(null);
    const nextOrder = banners.length > 0 ? Math.max(...banners.map((b) => b.display_order)) + 1 : 1;
    const { error } = await supabase.from('banners').insert({
      image_url: imageUrl.trim(),
      title: title.trim() || null,
      link_url: linkUrl.trim() || null,
      display_order: nextOrder,
      is_active: true,
    });
    setBusy(false);
    if (error) { setFormErr(error.message); return; }
    setShowForm(false);
    load();
  }

  async function toggleActive(b: Banner) {
    await supabase.from('banners').update({ is_active: !b.is_active }).eq('id', b.id);
    load();
  }

  async function move(b: Banner, dir: -1 | 1) {
    const sorted = [...banners].sort((a, c) => a.display_order - c.display_order);
    const i = sorted.findIndex((x) => x.id === b.id);
    const swap = i + dir;
    if (swap < 0 || swap >= sorted.length) return;
    const other = sorted[swap];
    await Promise.all([
      supabase.from('banners').update({ display_order: other.display_order }).eq('id', b.id),
      supabase.from('banners').update({ display_order: b.display_order }).eq('id', other.id),
    ]);
    load();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    await supabase.from('banners').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    load();
  }

  return (
    <div className="space-y-5 lm-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ImagePlus size={20} className="text-[var(--terracotta)]" />
          <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Banners</h1>
        </div>
        <Button onClick={openNew}><Plus size={16} /> Add banner</Button>
      </div>

      <p className="text-sm text-[var(--ink-soft)]">These banners appear in a rotating carousel at the top of every teacher's class home. Paste an image URL, add an optional caption and link, then reorder and toggle them on or off.</p>

      {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>}

      {loading ? <Spinner label="Loading banners…" /> : banners.length === 0 ? (
        <Card className="p-5"><EmptyState icon={<ImagePlus size={36} />} title="No banners yet" hint="Add a banner image to feature it in the teacher carousel." /></Card>
      ) : (
        <div className="space-y-3">
          {banners.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex items-center gap-4">
                <img src={b.image_url} alt={b.title ?? 'Banner'} className="w-28 h-16 sm:w-36 sm:h-20 object-cover rounded-xl shrink-0 bg-[var(--cream-deep)]" />
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-[var(--ink)] truncate">{b.title ?? 'Untitled banner'}</p>
                  {b.link_url && (
                    <p className="text-xs text-[var(--ink-soft)] truncate flex items-center gap-1 mt-0.5">
                      <ExternalLink size={11} /> {b.link_url}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => toggleActive(b)}
                      className={`lm-chip cursor-pointer transition ${b.is_active ? 'bg-[#f4f4f5] text-[var(--sage-deep)]' : 'bg-[var(--cream-deep)] text-[var(--ink-soft)]'}`}
                    >
                      {b.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex flex-col">
                    <button onClick={() => move(b, -1)} className="p-1 text-[var(--ink-soft)] hover:text-[var(--ink)]"><ArrowUp size={14} /></button>
                    <button onClick={() => move(b, 1)} className="p-1 text-[var(--ink-soft)] hover:text-[var(--ink)]"><ArrowDown size={14} /></button>
                  </div>
                  <button onClick={() => setConfirmDelete(b)} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={15} /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Add banner"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Add banner'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <ImageUpload folder="banners" label="Banner image" value={imageUrl} onChange={setImageUrl} />
          <Input label="Title / caption (optional)" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New activities for Term 2" />
          <Input label="Link URL (optional)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
          {formErr && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{formErr}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Delete banner?"
        message="This will remove the banner from the teacher carousel."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
