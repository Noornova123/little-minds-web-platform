import { useEffect, useState } from 'react';
import { LifeBuoy, HelpCircle, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { HelpSection } from '@/lib/types';
import { Card, Spinner, EmptyState } from '@/components/ui';

const FAQS = [
  { q: 'How do I switch between classes?', a: 'Use the class dropdown at the top of the Home page. Your selection is remembered for next time.' },
  { q: "What if today's activity isn't showing?", a: "Make sure attendance is marked first — today's activity appears after attendance. If it's still missing, your admin may not have added content for your grade level yet." },
  { q: 'Can I redo a day I already finished?', a: 'Yes. Open the Content Library, find the day, and run the activity again. The checkpoint will update with the latest results.' },
  { q: 'Where do monthly deep-check scores come from?', a: 'They come from your offline worksheet. Enter the focus, brain, and behaviour scores in the Monthly Check tab.' },
  { q: 'Who can see my class reports?', a: 'Only you and your school admin. Scores are never shared with students or parents automatically.' },
];

export function TeacherHelp() {
  const [sections, setSections] = useState<HelpSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from('help_sections').select('*').order('sort_order', { ascending: true });
      if (!active) return;
      setSections((data as HelpSection[]) ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-5 lm-fade-up max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <LifeBuoy size={20} className="text-[var(--terracotta)]" />
        <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>Help &amp; Resources</h1>
      </div>

      {loading ? <Spinner label="Loading guide…" /> : sections.length === 0 ? (
        <Card className="p-5"><EmptyState title="Guide coming soon" hint="Your admin is setting up the help content." /></Card>
      ) : (
        sections.map((s, i) => (
          <Card key={s.id} className="p-5">
            <h3 className="font-extrabold text-[var(--ink)] mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[var(--terracotta)] text-white text-xs flex items-center justify-center font-extrabold">{i + 1}</span>
              {s.title}
            </h3>
            <div className="text-sm text-[var(--ink-soft)] whitespace-pre-wrap leading-relaxed">{s.body}</div>
          </Card>
        ))
      )}

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle size={18} className="text-[var(--sage-deep)]" />
          <h3 className="font-extrabold text-[var(--ink)]">Frequently asked questions</h3>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {FAQS.map((f, i) => (
            <div key={i} className="py-3">
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between text-left">
                <span className="font-bold text-[var(--ink)] text-sm">{f.q}</span>
                <ChevronDown size={16} className={`text-[var(--ink-soft)] transition-transform shrink-0 ${openFaq === i ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === i && <p className="text-sm text-[var(--ink-soft)] mt-2 leading-relaxed">{f.a}</p>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
