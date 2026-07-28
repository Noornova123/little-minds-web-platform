import { ChevronDown, Check } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import type { ClassRow } from '@/lib/types';

export function ClassSelector({ classes, selected, onSelect }: { classes: ClassRow[]; selected: ClassRow | null; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  if (classes.length === 0) return null;
  if (classes.length === 1) {
    return (
      <div className="lm-card px-4 py-2.5 flex items-center gap-2">
        <span className="lm-label">Class</span>
        <span className="font-extrabold text-[var(--ink)]">{classes[0].name}</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="lm-card px-4 py-2.5 flex items-center gap-2 w-full sm:w-auto"
      >
        <span className="lm-label">Class</span>
        <span className="font-extrabold text-[var(--ink)] flex-1 text-left">{selected?.name ?? 'Select class'}</span>
        <ChevronDown size={18} className={`text-[var(--ink-soft)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full sm:w-56 lm-card p-1 lm-fade-up max-h-72 overflow-y-auto">
          {classes.map((c) => (
            <button
              key={c.id}
              onClick={() => { onSelect(c.id); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left hover:bg-[var(--cream-deep)] transition-colors"
            >
              <span className="font-bold text-[var(--ink)] text-sm">{c.name}</span>
              {selected?.id === c.id && <Check size={16} className="text-[var(--terracotta)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
