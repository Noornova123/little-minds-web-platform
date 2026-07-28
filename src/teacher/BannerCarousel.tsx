import { useEffect, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Banner } from '@/lib/types';

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const count = banners.length;
  const current = banners[idx];

  useEffect(() => {
    if (count <= 1 || paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % count), 4500);
    return () => clearInterval(t);
  }, [count, paused]);

  // Reset index if banners change and idx is out of range.
  useEffect(() => { if (idx >= count) setIdx(0); }, [count, idx]);

  if (count === 0) return null;

  const goTo = (n: number) => setIdx((n + count) % count);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > 40) goTo(idx - 1);
    else if (dx < -40) goTo(idx + 1);
    touchStartX.current = null;
  }

  const inner = (
    <>
      <img
        src={current.image_url}
        alt={current.title ?? 'Banner'}
        className="w-full h-40 sm:h-48 object-cover"
        draggable={false}
      />
      {current.title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
          <p className="text-white font-extrabold text-sm sm:text-base drop-shadow" style={{ fontFamily: 'Fraunces, serif' }}>{current.title}</p>
        </div>
      )}
    </>
  );

  return (
    <div
      className="relative rounded-2xl overflow-hidden lm-fade-up"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative" style={{ minHeight: '10rem' }}>
        {current.link_url ? (
          <a href={current.link_url} target="_blank" rel="noopener noreferrer" className="block relative">
            {inner}
          </a>
        ) : (
          <div className="relative">{inner}</div>
        )}
      </div>

      {count > 1 && (
        <>
          <button
            onClick={() => goTo(idx - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-[var(--ink)] shadow-sm transition"
            aria-label="Previous"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => goTo(idx + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-[var(--ink)] shadow-sm transition"
            aria-label="Next"
          >
            <ChevronRight size={18} />
          </button>

          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all ${i === idx ? 'w-5 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'}`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
