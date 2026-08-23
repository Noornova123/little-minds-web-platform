import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { uploadStudentPhoto, UploadError } from '@/lib/upload';

// A cheerful, high-contrast gradient pair for each student, picked
// deterministically from their id so the same student always gets the
// same colors across the app.
const GRADIENTS: [string, string][] = [
  ['#ff9a6c', '#ee5b7f'], // coral → pink
  ['#6fd3c7', '#4a9dd6'], // teal → blue
  ['#ffd166', '#f4845f'], // sunny → orange
  ['#a78bfa', '#6366f1'], // violet → indigo
  ['#5eead4', '#22b8a0'], // mint → teal
  ['#fca5a5', '#e0577e'], // rose → magenta
  ['#93c5fd', '#3b82f6'], // sky → blue
  ['#fbbf24', '#f97316'], // amber → orange
];

function gradientFor(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZES = { sm: 32, md: 44, lg: 64, xl: 96 } as const;

interface StudentAvatarProps {
  id: string;
  name: string;
  photoUrl?: string | null;
  size?: keyof typeof SIZES;
  editable?: boolean;
  onPhotoChange?: (url: string) => void;
  className?: string;
}

export function StudentAvatar({ id, name, photoUrl, size = 'md', editable, onPhotoChange, className = '' }: StudentAvatarProps) {
  const px = SIZES[size];
  const [from, to] = gradientFor(id);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const { url } = await uploadStudentPhoto(file, id);
      await supabase.from('students').update({ photo_url: url }).eq('id', id);
      onPhotoChange?.(url);
    } catch (error) {
      setErr(error instanceof UploadError ? error.message : 'Upload failed. Try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: px, height: px }}>
      <div
        className="w-full h-full rounded-2xl overflow-hidden flex items-center justify-center text-white font-extrabold shrink-0"
        style={{
          background: photoUrl ? undefined : `linear-gradient(135deg, ${from}, ${to})`,
          fontSize: px * 0.38,
          boxShadow: `0 3px 10px ${from}55`,
        }}
      >
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span>{initials(name)}</span>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl">
            <Loader2 size={px * 0.35} className="animate-spin text-white" />
          </div>
        )}
      </div>
      {editable && !uploading && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--terracotta)] text-white flex items-center justify-center border-2 border-white shadow-md hover:scale-110 transition-transform"
          aria-label={`Change photo for ${name}`}
        >
          <Camera size={12} />
        </button>
      )}
      {editable && (
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFile} />
      )}
      {err && <p className="absolute top-full left-0 mt-1 text-[10px] font-semibold text-[#dc2626] whitespace-nowrap z-10">{err}</p>}
    </div>
  );
}
