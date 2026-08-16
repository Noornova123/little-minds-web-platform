import { useEffect, useRef, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Film, ImageIcon, HelpCircle, GripVertical, X, ArrowUp, ArrowDown, BookOpen, Library, Upload, Link as LinkIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Activity, QuizQuestion, ActivityCategory, ContentType, QuizType, StepBreakdownItem, LibraryCategory, CurriculumCategory, GradeLevel } from '@/lib/types';
import { Card, Button, Input, Textarea, Spinner, EmptyState, Badge } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/Modal';
import { uploadImage, UploadError } from '@/lib/upload';

const dailyCategoryTone: Record<string, 'focus' | 'brain' | 'behaviour'> = {
  focus: 'focus',
  brain: 'brain',
  behaviour: 'behaviour',
};

type Tab = 'curriculum' | 'library';

export function AdminContent() {
  const [tab, setTab] = useState<Tab>('curriculum');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [curriculumCategories, setCurriculumCategories] = useState<CurriculumCategory[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [dayFrom, setDayFrom] = useState('');
  const [dayTo, setDayTo] = useState('');

  const [editing, setEditing] = useState<Activity | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Activity | null>(null);

  async function load() {
    setLoading(true);
    const [acts, cats, curCats, gls] = await Promise.all([
      supabase.from('activities').select('*').order('day_number', { ascending: true, nullsFirst: false }),
      supabase.from('library_categories').select('*').order('sort_order', { ascending: true }),
      supabase.from('curriculum_categories').select('*').order('sort_order', { ascending: true }),
      supabase.from('grade_levels').select('*').order('sort_order', { ascending: true }),
    ]);
    setActivities((acts.data as Activity[]) ?? []);
    setCategories((cats.data as LibraryCategory[]) ?? []);
    setCurriculumCategories((curCats.data as CurriculumCategory[]) ?? []);
    setGradeLevels((gls.data as GradeLevel[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const curriculum = activities.filter((a) => a.content_type === 'daily_curriculum');
  const library = activities.filter((a) => a.content_type === 'library');

  function filteredCurriculum() {
    return curriculum.filter((a) => {
      if (catFilter !== 'all' && a.category !== catFilter) return false;
      if (gradeFilter !== 'all' && (a.grade_level ?? '—') !== gradeFilter) return false;
      if (query && !a.title.toLowerCase().includes(query.toLowerCase()) && !String(a.day_number).includes(query)) return false;
      if (dayFrom && (a.day_number ?? 0) < Number(dayFrom)) return false;
      if (dayTo && (a.day_number ?? 0) > Number(dayTo)) return false;
      return true;
    });
  }

  function filteredLibrary() {
    return library.filter((a) => {
      if (catFilter !== 'all' && a.category !== catFilter) return false;
      if (gradeFilter !== 'all' && (a.grade_level ?? '—') !== gradeFilter) return false;
      if (query && !a.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }

  function openAdd(type: ContentType) {
    setEditing(null);
    setShowForm(true);
    // seed default content type via a synthetic activity stub
    setFormType(type);
  }
  function openEdit(a: Activity) {
    setEditing(a);
    setFormType(a.content_type);
    setShowForm(true);
  }

  async function doDelete() {
    if (!confirmDelete) return;
    await supabase.from('activities').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    load();
  }

  const curriculumList = filteredCurriculum();
  const libraryList = filteredLibrary();
  const libraryByCat = categories.map((c) => ({ cat: c, items: libraryList.filter((a) => a.category === c.name) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5 lm-fade-up">
      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--cream-deep)] rounded-2xl p-1 w-fit">
        <TabBtn active={tab === 'curriculum'} onClick={() => { setTab('curriculum'); setQuery(''); setCatFilter('all'); setGradeFilter('all'); setDayFrom(''); setDayTo(''); }}>
          <BookOpen size={16} /> Daily Curriculum
        </TabBtn>
        <TabBtn active={tab === 'library'} onClick={() => { setTab('library'); setQuery(''); setCatFilter('all'); setGradeFilter('all'); setDayFrom(''); setDayTo(''); }}>
          <Library size={16} /> Library
        </TabBtn>
      </div>

      {tab === 'curriculum' ? (
        <>
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="relative md:col-span-2">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
                <input className="lm-input pl-9" placeholder="Search by title or day…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <select className="lm-input" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                <option value="all">All categories</option>
                {curriculumCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <select className="lm-input" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
                <option value="all">All grade levels</option>
                {gradeLevels.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
                <option value="—">— (Untagged)</option>
              </select>
              <div className="flex gap-2">
                <input className="lm-input" type="number" placeholder="Day from" value={dayFrom} onChange={(e) => setDayFrom(e.target.value)} />
                <input className="lm-input" type="number" placeholder="Day to" value={dayTo} onChange={(e) => setDayTo(e.target.value)} />
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-[var(--ink-soft)]">{curriculumList.length} activit{curriculumList.length === 1 ? 'y' : 'ies'}</p>
            <Button onClick={() => openAdd('daily_curriculum')}><Plus size={16} /> Add day</Button>
          </div>

          {loading ? <Spinner label="Loading activities…" /> : curriculumList.length === 0 ? (
            <Card><EmptyState icon={<BookOpen size={36} />} title="No daily activities" hint="Create the first day's activity to build the curriculum." /></Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="divide-y divide-[var(--line)]">
                {curriculumList.map((a) => (
                  <ActivityRow key={a.id} a={a} onEdit={() => openEdit(a)} onDelete={() => setConfirmDelete(a)} showDay />
                ))}
              </div>
            </Card>
          )}
        </>
      ) : (
        <>
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative md:col-span-2">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
                <input className="lm-input pl-9" placeholder="Search library activities…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <select className="lm-input" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                <option value="all">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <select className="lm-input" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
                <option value="all">All grade levels</option>
                {gradeLevels.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
                <option value="—">— (Untagged)</option>
              </select>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-[var(--ink-soft)]">{libraryList.length} activit{libraryList.length === 1 ? 'y' : 'ies'}</p>
            <Button onClick={() => openAdd('library')}><Plus size={16} /> Add library activity</Button>
          </div>

          {loading ? <Spinner label="Loading…" /> : libraryList.length === 0 ? (
            <Card><EmptyState icon={<Library size={36} />} title="No library activities" hint="Add supplementary activities teachers can run any time." /></Card>
          ) : (
            <div className="space-y-5">
              {libraryByCat.length === 0 ? (
                <Card><EmptyState title="No matches" hint="Try a different filter." /></Card>
              ) : libraryByCat.map((g) => (
                <div key={g.cat.id}>
                  <h3 className="font-extrabold text-[var(--ink)] mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[var(--terracotta)]" /> {g.cat.name} <Badge tone="neutral">{g.items.length}</Badge></h3>
                  <Card className="overflow-hidden">
                    <div className="divide-y divide-[var(--line)]">
                      {g.items.map((a) => (
                        <ActivityRow key={a.id} a={a} onEdit={() => openEdit(a)} onDelete={() => setConfirmDelete(a)} />
                      ))}
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showForm && <ActivityForm key={editing?.id ?? 'new'} activity={editing} categories={categories} curriculumCategories={curriculumCategories} gradeLevels={gradeLevels} forceType={formType} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Delete activity?"
        message={confirmDelete?.content_type === 'daily_curriculum'
          ? `Delete "${confirmDelete?.title}" (Day ${confirmDelete?.day_number})? This also removes its quiz questions. Teachers who already completed it keep their progress.`
          : `Delete "${confirmDelete?.title}"? This also removes its quiz questions and library completion logs.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

// formType is set before opening the form so the add button can seed the type.
let formType: ContentType = 'daily_curriculum';
function setFormType(t: ContentType) { formType = t; }

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${active ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}>
      {children}
    </button>
  );
}

function ActivityRow({ a, onEdit, onDelete, showDay }: { a: Activity; onEdit: () => void; onDelete: () => void; showDay?: boolean }) {
  const hasVideo = !!a.video_url;
  const hasImages = a.reference_images.length > 0;
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--cream-deep)] transition-colors">
      {showDay && (
        <div className="w-12 text-center shrink-0">
          <p className="text-[10px] font-bold uppercase text-[var(--ink-soft)]">Day</p>
          <p className="text-lg font-extrabold text-[var(--ink)]">{a.day_number}</p>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-[var(--ink)] truncate">{a.title}</p>
          <Badge tone={dailyCategoryTone[a.category] ?? 'neutral'}>{a.category}</Badge>
          {a.grade_level && <Badge tone="neutral">{a.grade_level}</Badge>}
        </div>
        <p className="text-xs text-[var(--ink-soft)]">{a.duration_minutes} min · {a.step_breakdown.length} steps</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span title={hasVideo ? 'Video set' : 'No video'} className={hasVideo ? 'text-[var(--sage-deep)]' : 'text-[var(--line)]'}><Film size={16} /></span>
        <span title={hasImages ? `${a.reference_images.length} image(s)` : 'No images'} className={hasImages ? 'text-[var(--sage-deep)]' : 'text-[var(--line)]'}><ImageIcon size={16} /></span>
        <span title={a.written_instructions ? 'Instructions set' : 'No instructions'} className={a.written_instructions ? 'text-[var(--sage-deep)]' : 'text-[var(--line)]'}><HelpCircle size={16} /></span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onEdit} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[var(--cream)]"><Edit2 size={16} /></button>
        <button onClick={onDelete} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={16} /></button>
      </div>
    </div>
  );
}

// ──────────────── Activity form (add/edit, both content types) ────────────────

function ActivityForm({ activity, categories, curriculumCategories, gradeLevels, forceType, onClose, onSaved }: {
  activity: Activity | null;
  categories: LibraryCategory[];
  curriculumCategories: CurriculumCategory[];
  gradeLevels: GradeLevel[];
  forceType: ContentType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const contentType: ContentType = activity?.content_type ?? forceType;
  const [day, setDay] = useState(activity?.day_number ?? 0);
  const [title, setTitle] = useState(activity?.title ?? '');
  const [category, setCategory] = useState(
    activity?.category ?? (contentType === 'library' ? (categories[0]?.name ?? '') : (curriculumCategories[0]?.name ?? ''))
  );
  const [duration, setDuration] = useState(activity?.duration_minutes ?? 10);
  const [gradeLevel, setGradeLevel] = useState(activity?.grade_level ?? '');
  const [instructions, setInstructions] = useState(activity?.written_instructions ?? '');
  const [videoUrl, setVideoUrl] = useState(activity?.video_url ?? '');
  const [images, setImages] = useState<string[]>(activity?.reference_images ?? []);
  const [imageUrl, setImageUrl] = useState('');
  const [imgUploadBusy, setImgUploadBusy] = useState(false);
  const [imgUploadErr, setImgUploadErr] = useState<string | null>(null);
  const imgFileRef = useRef<HTMLInputElement>(null);
  const [steps, setSteps] = useState<StepBreakdownItem[]>(activity?.step_breakdown ?? []);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!activity) return;
    supabase.from('quiz_questions').select('*').eq('activity_id', activity.id).then(({ data }) => {
      setQuiz((data as QuizQuestion[]) ?? []);
    });
  }, [activity]);

  function addImage() {
    const u = imageUrl.trim();
    if (!u) return;
    setImages((p) => [...p, u]);
    setImageUrl('');
  }
  function removeImage(i: number) {
    setImages((p) => p.filter((_, idx) => idx !== i));
  }

  async function uploadRefImage(file: File) {
    setImgUploadErr(null);
    setImgUploadBusy(true);
    try {
      const { url } = await uploadImage(file, 'reference-images');
      setImages((p) => [...p, url]);
    } catch (e) {
      setImgUploadErr(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setImgUploadBusy(false);
    }
  }
  function onImgFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) uploadRefImage(f);
    e.target.value = '';
  }

  function addStep() {
    setSteps((p) => [...p, { title: '', instruction: '' }]);
  }
  function updateStep(i: number, key: keyof StepBreakdownItem, val: string) {
    setSteps((p) => p.map((s, idx) => (idx === i ? { ...s, [key]: val } : s)));
  }
  function removeStep(i: number) {
    setSteps((p) => p.filter((_, idx) => idx !== i));
  }
  function moveStep(i: number, dir: -1 | 1) {
    setSteps((p) => {
      const n = [...p];
      const j = i + dir;
      if (j < 0 || j >= n.length) return n;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }

  function addQuiz() {
    setQuiz((p) => [...p, { id: '', activity_id: activity?.id ?? '', question_text: '', question_type: 'right_wrong', options: [], correct_answer: 'right', created_at: '' }]);
  }
  function updateQuiz(i: number, patch: Partial<QuizQuestion>) {
    setQuiz((p) => p.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function removeQuiz(i: number) {
    setQuiz((p) => p.filter((_, idx) => idx !== i));
  }

  async function save() {
    setBusy(true); setErr(null);
    if (!title.trim()) { setErr('Title is required.'); setBusy(false); return; }
    if (contentType === 'daily_curriculum' && !day) { setErr('Day number is required for daily curriculum.'); setBusy(false); return; }
    if (contentType === 'library' && !category.trim()) { setErr('Category is required for library activities.'); setBusy(false); return; }

    const payload = {
      content_type: contentType,
      day_number: contentType === 'daily_curriculum' ? Number(day) : null,
      grade_level: gradeLevel || null,
      title: title.trim(),
      category,
      duration_minutes: Number(duration) || 10,
      written_instructions: instructions.trim() || null,
      video_url: videoUrl.trim() || null,
      reference_images: images,
      step_breakdown: steps.filter((s) => s.title.trim() || s.instruction.trim()),
    };

    let activityId = activity?.id;
    if (activity) {
      const { error } = await supabase.from('activities').update(payload).eq('id', activity.id);
      if (error) { setErr(error.message); setBusy(false); return; }
    } else {
      const { data, error } = await supabase.from('activities').insert(payload).select().maybeSingle();
      if (error) { setErr(error.message); setBusy(false); return; }
      activityId = (data as Activity)?.id;
    }

    if (activityId) {
      const keptIds = quiz.filter((q) => q.id).map((q) => q.id);
      if (activity && keptIds.length === 0 && quiz.some((q) => q.id)) {
        await supabase.from('quiz_questions').delete().eq('activity_id', activityId);
      } else if (activity && keptIds.length > 0) {
        await supabase.from('quiz_questions').delete().eq('activity_id', activityId).not('id', 'in', `(${keptIds.join(',')})`);
      }
      for (const q of quiz) {
        if (!q.question_text.trim()) continue;
        const qPayload = {
          activity_id: activityId,
          question_text: q.question_text.trim(),
          question_type: q.question_type,
          options: q.question_type === 'multiple_choice' ? q.options.filter((o) => o.trim()) : [],
          correct_answer: q.correct_answer,
        };
        if (q.id) {
          await supabase.from('quiz_questions').update(qPayload).eq('id', q.id);
        } else {
          await supabase.from('quiz_questions').insert(qPayload);
        }
      }
    }

    setBusy(false);
    onSaved();
  }

  const isCurriculum = contentType === 'daily_curriculum';

  return (
    <Modal
      open
      onClose={onClose}
      title={activity ? `Edit ${isCurriculum ? `Day ${activity.day_number}` : 'library activity'}` : (isCurriculum ? 'Add daily activity' : 'Add library activity')}
      size="full"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save activity'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        {err && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{err}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {isCurriculum ? (
            <Input label="Day number" type="number" min={1} value={day} onChange={(e) => setDay(Number(e.target.value))} />
          ) : null}
          <div className={isCurriculum ? 'sm:col-span-2 md:col-span-2' : 'sm:col-span-2 md:col-span-3'}>
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mindful Breathing" />
          </div>
          <label className="block">
            <span className="lm-label block mb-1.5">{isCurriculum ? 'Category' : 'Library category'}</span>
            <select className="lm-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {isCurriculum ? (
                curriculumCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)
              ) : (
                categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)
              )}
            </select>
          </label>
          <label className="block">
            <span className="lm-label block mb-1.5">Grade level</span>
            <select className="lm-input" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}>
              <option value="">— (Any grade)</option>
              {gradeLevels.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Duration (minutes)" type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
        </div>

        <Textarea label="Written instructions" rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Rich guidance for the teacher running this activity…" />

        <div>
          <Input label="Video URL" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…" />
          {videoUrl && <VideoPreview url={videoUrl} />}
        </div>

        <div>
          <span className="lm-label block mb-1.5">Reference images</span>
          <p className="text-xs text-[var(--ink-soft)] mb-2">Upload from your device or paste an image link — mix and match as needed.</p>
          <div className="flex gap-2 mb-2">
            <input className="lm-input" placeholder="Paste image URL…" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addImage(); } }} />
            <Button variant="ghost" size="sm" onClick={addImage} className="shrink-0"><LinkIcon size={14} /> Add link</Button>
            <Button variant="ghost" size="sm" onClick={() => imgFileRef.current?.click()} disabled={imgUploadBusy} className="shrink-0">
              {imgUploadBusy ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Upload</>}
            </Button>
            <input ref={imgFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onImgFileChange} />
          </div>
          {imgUploadErr && <p className="text-xs font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2 mb-2">{imgUploadErr}</p>}
          {images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative group rounded-xl overflow-hidden border border-[var(--line)] aspect-square bg-[var(--cream-deep)]">
                  <img src={img} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2'; }} />
                  <button onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-[var(--ink)]/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="lm-label">Step breakdown</span>
            <Button variant="ghost" size="sm" onClick={addStep}><Plus size={14} /> Add step</Button>
          </div>
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={i} className="rounded-xl border border-[var(--line)] p-3 bg-[var(--cream)]/40">
                <div className="flex items-center gap-2 mb-2">
                  <GripVertical size={16} className="text-[var(--ink-soft)] shrink-0" />
                  <span className="text-xs font-extrabold text-[var(--ink-soft)]">Step {i + 1}</span>
                  <div className="flex-1" />
                  <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="p-1 rounded text-[var(--ink-soft)] hover:bg-[var(--cream-deep)] disabled:opacity-30"><ArrowUp size={14} /></button>
                  <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} className="p-1 rounded text-[var(--ink-soft)] hover:bg-[var(--cream-deep)] disabled:opacity-30"><ArrowDown size={14} /></button>
                  <button onClick={() => removeStep(i)} className="p-1 rounded text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]"><X size={14} /></button>
                </div>
                <input className="lm-input mb-2 font-bold" placeholder="Step title" value={s.title} onChange={(e) => updateStep(i, 'title', e.target.value)} />
                <textarea className="lm-input text-sm" rows={2} placeholder="Instruction text for the teacher" value={s.instruction} onChange={(e) => updateStep(i, 'instruction', e.target.value)} />
              </div>
            ))}
            {steps.length === 0 && <p className="text-sm text-[var(--ink-soft)] py-2">No steps yet. Add 3–4 steps the teacher walks through live.</p>}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="lm-label">Quiz questions</span>
            <Button variant="ghost" size="sm" onClick={addQuiz}><Plus size={14} /> Add question</Button>
          </div>
          <div className="space-y-3">
            {quiz.map((q, i) => (
              <div key={i} className="rounded-xl border border-[var(--line)] p-3 bg-[var(--cream)]/40">
                <div className="flex items-center gap-2 mb-2">
                  <HelpCircle size={16} className="text-[var(--ink-soft)] shrink-0" />
                  <span className="text-xs font-extrabold text-[var(--ink-soft)]">Question {i + 1}</span>
                  <div className="flex-1" />
                  <button onClick={() => removeQuiz(i)} className="p-1 rounded text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]"><X size={14} /></button>
                </div>
                <input className="lm-input mb-2" placeholder="Question text" value={q.question_text} onChange={(e) => updateQuiz(i, { question_text: e.target.value })} />
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <label className="block">
                    <span className="lm-label block mb-1">Type</span>
                    <select className="lm-input" value={q.question_type} onChange={(e) => {
                      const t = e.target.value as QuizType;
                      updateQuiz(i, { question_type: t, options: t === 'multiple_choice' ? q.options.length ? q.options : ['', ''] : [], correct_answer: t === 'right_wrong' ? 'right' : q.correct_answer });
                    }}>
                      <option value="right_wrong">Right / Wrong</option>
                      <option value="multiple_choice">Multiple choice</option>
                    </select>
                  </label>
                </div>
                {q.question_type === 'multiple_choice' ? (
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex gap-2">
                        <input className="lm-input" placeholder={`Option ${oi + 1}`} value={opt} onChange={(e) => updateQuiz(i, { options: q.options.map((o, idx) => idx === oi ? e.target.value : o) })} />
                        <button onClick={() => updateQuiz(i, { options: q.options.filter((_, idx) => idx !== oi) })} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]"><X size={14} /></button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={() => updateQuiz(i, { options: [...q.options, ''] })}><Plus size={14} /> Add option</Button>
                    <label className="block mt-2">
                      <span className="lm-label block mb-1">Correct answer</span>
                      <select className="lm-input" value={q.correct_answer} onChange={(e) => updateQuiz(i, { correct_answer: e.target.value })}>
                        {q.options.filter((o) => o.trim()).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                  </div>
                ) : (
                  <label className="block">
                    <span className="lm-label block mb-1">Correct answer</span>
                    <select className="lm-input" value={q.correct_answer} onChange={(e) => updateQuiz(i, { correct_answer: e.target.value })}>
                      <option value="right">Right</option>
                      <option value="wrong">Wrong</option>
                    </select>
                  </label>
                )}
              </div>
            ))}
            {quiz.length === 0 && <p className="text-sm text-[var(--ink-soft)] py-2">No quiz yet. Add a question for the checkpoint.</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function VideoPreview({ url }: { url: string }) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  const vm = url.match(/vimeo\.com\/(\d+)/);
  let embed: string | null = null;
  if (yt) embed = `https://www.youtube.com/embed/${yt[1]}`;
  if (vm) embed = `https://player.vimeo.com/video/${vm[1]}`;
  if (!embed) {
    return <p className="mt-2 text-xs text-[var(--ink-soft)]">Live preview available for YouTube/Vimeo links. <a href={url} target="_blank" rel="noreferrer" className="text-[var(--terracotta)] font-bold underline">Open link →</a></p>;
  }
  return (
    <div className="mt-2 aspect-video rounded-xl overflow-hidden border border-[var(--line)] bg-black">
      <iframe src={embed} title="Video preview" className="w-full h-full" allowFullScreen frameBorder="0" />
    </div>
  );
}
