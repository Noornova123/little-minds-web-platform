import { useRef, useState } from 'react';
import { Upload, Link as LinkIcon, Loader2, X, ImageIcon } from 'lucide-react';
import { uploadImage, type ImageFolder } from '@/lib/upload';

interface ImageUploadProps {
  folder: ImageFolder;
  /** Current image URL (controlled). */
  value: string;
  /** Called whenever the URL changes — via upload OR paste. */
  onChange: (url: string) => void;
  /** Optional label above the field. */
  label?: string;
  /** Compact mode — smaller preview (used in tight forms). */
  compact?: boolean;
}

type Mode = 'upload' | 'link';

export function ImageUpload({ folder, value, onChange, label, compact }: ImageUploadProps) {
  const [mode, setMode] = useState<Mode>('upload');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const { url } = await uploadImage(file, folder);
      onChange(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  function applyLink() {
    const u = linkInput.trim();
    if (!u) return;
    onChange(u);
    setLinkInput('');
  }

  function clearImage() {
    onChange('');
    setLinkInput('');
    setErr(null);
  }

  return (
    <div>
      {label && <span className="lm-label block mb-1.5">{label}</span>}

      {/* Mode toggle */}
      <div className="flex gap-1 bg-[var(--cream-deep)] rounded-xl p-0.5 w-fit mb-2">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${mode === 'upload' ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}
        >
          <Upload size={13} /> Upload
        </button>
        <button
          type="button"
          onClick={() => setMode('link')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${mode === 'link' ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}
        >
          <LinkIcon size={13} /> Paste link
        </button>
      </div>

      {/* Preview (shown when a URL is set, regardless of mode) */}
      {value && (
        <div className={`relative group rounded-xl overflow-hidden border border-[var(--line)] bg-[var(--cream-deep)] mb-2 ${compact ? 'h-24' : 'h-32'}`}>
          <img src={value} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
          <button
            type="button"
            onClick={clearImage}
            className="absolute top-1.5 right-1.5 bg-[var(--ink)]/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Upload zone */}
      {mode === 'upload' && !value && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-xl border-2 border-dashed cursor-pointer transition-colors flex flex-col items-center justify-center text-center px-4 ${compact ? 'py-4' : 'py-6'} ${dragOver ? 'border-[var(--terracotta)] bg-[var(--coral-soft)]/40' : 'border-[var(--line)] hover:border-[var(--terracotta)] hover:bg-[var(--cream-deep)]/50'}`}
        >
          {busy ? (
            <div className="flex items-center gap-2 text-[var(--ink-soft)]">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm font-bold">Uploading…</span>
            </div>
          ) : (
            <>
              <Upload size={22} className="text-[var(--ink-soft)] mb-1.5" />
              <p className="text-sm font-bold text-[var(--ink)]">Click to upload or drag &amp; drop</p>
              <p className="text-xs text-[var(--ink-soft)] mt-0.5">JPG, PNG, WebP · up to 5MB</p>
            </>
          )}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onInputChange} />
        </div>
      )}

      {/* Link paste zone */}
      {mode === 'link' && !value && (
        <div className="flex gap-2">
          <input
            className="lm-input"
            placeholder="https://images.pexels.com/…"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } }}
          />
          <button type="button" className="lm-btn lm-btn-ghost px-3 py-2 text-sm shrink-0" onClick={applyLink}>
            <ImageIcon size={15} /> Add
          </button>
        </div>
      )}

      {err && <p className="text-xs font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2 mt-2">{err}</p>}
    </div>
  );
}
