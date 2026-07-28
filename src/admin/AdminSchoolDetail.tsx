import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Plus, Trash2, Upload, Users, GraduationCap, UserCog, KeyRound, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ImageUpload } from '@/components/ImageUpload';
import { navigate } from '@/lib/router';
import type { School, Teacher, ClassRow, Student, GradeLevel } from '@/lib/types';
import { Card, Button, Input, Spinner, EmptyState, Badge } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/Modal';

export function AdminSchoolDetail({ schoolId }: { schoolId: string }) {
  const [school, setSchool] = useState<School | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [studentsByClass, setStudentsByClass] = useState<Record<string, Student[]>>({});
  const [loading, setLoading] = useState(true);

  // modals
  const [showTeacher, setShowTeacher] = useState(false);
  const [showClass, setShowClass] = useState(false);
  const [showUpload, setShowUpload] = useState<string | null>(null); // class id
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'teacher' | 'class'; id: string; name: string } | null>(null);

  // teacher form
  const [tName, setTName] = useState('');
  const [tEmail, setTEmail] = useState('');
  const [tPassword, setTPassword] = useState('');
  const [tBusy, setTBusy] = useState(false);
  const [tErr, setTErr] = useState<string | null>(null);
  const [tGenerated, setTGenerated] = useState<string | null>(null);

  // class form
  const [cName, setCName] = useState('');
  const [cTeacher, setCTeacher] = useState<string>('');
  const [cGrade, setCGrade] = useState<string>('');
  const [cBusy, setCBusy] = useState(false);
  const [cErr, setCErr] = useState<string | null>(null);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);

  // upload
  const [uploadText, setUploadText] = useState('name,roll_number\nAarav Sharma,01\nDiya Patel,02');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // edit school details
  const [showEditSchool, setShowEditSchool] = useState(false);
  const [editContact, setEditContact] = useState('');
  const [editPrincipal, setEditPrincipal] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editBrandColor, setEditBrandColor] = useState('');
  const [editSchoolBusy, setEditSchoolBusy] = useState(false);
  const [editSchoolErr, setEditSchoolErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: s }, { data: t }, { data: c }, { data: gls }] = await Promise.all([
      supabase.from('schools').select('*').eq('id', schoolId).maybeSingle(),
      supabase.from('teachers').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('classes').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('grade_levels').select('*').order('sort_order', { ascending: true }),
    ]);
    setGradeLevels((gls as GradeLevel[]) ?? []);
    setSchool(s as School | null);
    setTeachers((t as Teacher[]) ?? []);
    const classRows = (c as ClassRow[]) ?? [];
    setClasses(classRows);

    const map: Record<string, Student[]> = {};
    await Promise.all(classRows.map(async (cl) => {
      const { data: st } = await supabase.from('students').select('*').eq('class_id', cl.id).order('roll_number');
      map[cl.id] = (st as Student[]) ?? [];
    }));
    setStudentsByClass(map);
    setLoading(false);
  }

  useEffect(() => { load(); }, [schoolId]);

  async function createTeacher(e: React.FormEvent) {
    e.preventDefault();
    setTBusy(true); setTErr(null); setTGenerated(null);
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-teacher`;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ school_id: schoolId, name: tName.trim(), email: tEmail.trim(), password: tPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create teacher');
      setTGenerated(`Teacher created. They can sign in at /login with ${tEmail.trim()} and the password you set.`);
      setTName(''); setTEmail(''); setTPassword('');
      load();
    } catch (err) {
      setTErr(err instanceof Error ? err.message : 'Failed to create teacher');
    } finally {
      setTBusy(false);
    }
  }

  async function createClass(e: React.FormEvent) {
    e.preventDefault();
    setCBusy(true); setCErr(null);
    const payload: Record<string, unknown> = { school_id: schoolId, name: cName };
    if (cTeacher) payload.teacher_id = cTeacher;
    if (cGrade) payload.grade_level = cGrade;
    const { error } = await supabase.from('classes').insert(payload);
    setCBusy(false);
    if (error) { setCErr(error.message); return; }
    setShowClass(false); setCName(''); setCTeacher(''); setCGrade('');
    load();
  }

  async function uploadStudents() {
    if (!showUpload) return;
    setUploadBusy(true); setUploadErr(null); setUploadResult(null);
    try {
      const lines = uploadText.trim().split(/\r?\n/);
      if (lines.length < 2) throw new Error('CSV needs a header row and at least one student.');
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const nameIdx = header.indexOf('name');
      const rollIdx = header.indexOf('roll_number');
      if (nameIdx === -1 || rollIdx === -1) throw new Error('CSV must have "name" and "roll_number" columns.');
      const rows: { name: string; roll_number: string }[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = parseCsvLine(lines[i]);
        const nm = (parts[nameIdx] ?? '').trim();
        const rl = (parts[rollIdx] ?? '').trim();
        if (nm) rows.push({ name: nm, roll_number: rl || String(i).padStart(2, '0') });
      }
      if (rows.length === 0) throw new Error('No valid student rows found.');
      const payload = rows.map((r) => ({ class_id: showUpload, name: r.name, roll_number: r.roll_number }));
      const { data, error } = await supabase.from('students').insert(payload).select();
      if (error) throw error;
      setUploadResult(`Added ${data?.length ?? rows.length} students.`);
      load();
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadBusy(false);
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    if (confirmDelete.kind === 'teacher') {
      await supabase.from('teachers').delete().eq('id', confirmDelete.id);
    } else {
      await supabase.from('classes').delete().eq('id', confirmDelete.id);
    }
    load();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setUploadText(String(reader.result || ''));
    reader.readAsText(f);
  }

  async function saveSchoolDetails() {
    setEditSchoolBusy(true); setEditSchoolErr(null);
    const { error } = await supabase.from('schools').update({
      contact_info: editContact.trim() || null,
      principal_name: editPrincipal.trim() || null,
      logo_url: editLogoUrl || null,
      brand_color: editBrandColor || null,
    }).eq('id', schoolId);
    setEditSchoolBusy(false);
    if (error) { setEditSchoolErr(error.message); return; }
    setShowEditSchool(false);
    load();
  }

  if (loading) return <Spinner label="Loading school…" />;
  if (!school) return <Card><EmptyState title="School not found" /></Card>;

  return (
    <div className="space-y-6 lm-fade-up">
      <button onClick={() => navigate('/admin/schools')} className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ink-soft)] hover:text-[var(--terracotta)]">
        <ArrowLeft size={16} /> All schools
      </button>

      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'Fraunces, serif' }}>{school.name}</h1>
            <p className="text-sm text-[var(--ink-soft)] mt-1">{school.contact_info || 'No contact info'}</p>
            {school.principal_name && <p className="text-sm font-semibold text-[var(--ink-soft)] mt-0.5">Principal: {school.principal_name}</p>}
            <div className="flex items-center gap-2 mt-2">
              <Badge tone={school.subscription_status === 'active' ? 'success' : school.subscription_status === 'trial' ? 'warning' : 'error'}>{school.subscription_status}</Badge>
              <Badge tone="neutral">Day {school.days_unlocked_up_to} unlocked</Badge>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => { setEditContact(school?.contact_info ?? ''); setEditPrincipal(school?.principal_name ?? ''); setEditLogoUrl(school?.logo_url ?? ''); setEditBrandColor(school?.brand_color ?? ''); setEditSchoolErr(null); setShowEditSchool(true); }}><Pencil size={14} /> Edit details</Button>
        </div>
      </Card>

      {/* Teachers */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserCog size={18} className="text-[var(--terracotta)]" />
            <h3 className="font-extrabold text-[var(--ink)]">Teachers</h3>
            <Badge tone="neutral">{teachers.length}</Badge>
          </div>
          <Button size="sm" onClick={() => { setShowTeacher(true); setTGenerated(null); setTErr(null); }}><Plus size={14} /> Add teacher</Button>
        </div>
        {teachers.length === 0 ? (
          <EmptyState title="No teachers yet" hint="Create a teacher account so staff can sign in." />
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {teachers.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-bold text-[var(--ink)]">{t.name}</p>
                  <p className="text-xs text-[var(--ink-soft)]">{t.email}</p>
                </div>
                <button onClick={() => setConfirmDelete({ kind: 'teacher', id: t.id, name: t.name })} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Classes */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GraduationCap size={18} className="text-[var(--sage-deep)]" />
            <h3 className="font-extrabold text-[var(--ink)]">Classes</h3>
            <Badge tone="neutral">{classes.length}</Badge>
          </div>
          <Button size="sm" variant="sage" onClick={() => { setShowClass(true); setCErr(null); }}><Plus size={14} /> Add class</Button>
        </div>
        {classes.length === 0 ? (
          <EmptyState title="No classes yet" hint="Add a class, then upload students." />
        ) : (
          <div className="space-y-3">
            {classes.map((c) => {
              const sts = studentsByClass[c.id] ?? [];
              const teacher = teachers.find((t) => t.id === c.teacher_id);
              return (
                <div key={c.id} className="rounded-xl border border-[var(--line)] p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[var(--ink)]">{c.name}</p>
                      <p className="text-xs text-[var(--ink-soft)]">{teacher ? teacher.name : 'Unassigned'} · {sts.length} students{c.grade_level ? ` · ${c.grade_level}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => { setShowUpload(c.id); setUploadErr(null); setUploadResult(null); }}><Upload size={14} /> <span className="hidden sm:inline">Upload CSV</span><span className="sm:hidden">CSV</span></Button>
                      <button onClick={() => setConfirmDelete({ kind: 'class', id: c.id, name: c.name })} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[#fef2f2] hover:text-[#dc2626]">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {sts.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {sts.slice(0, 12).map((s) => (
                        <span key={s.id} className="lm-chip bg-[var(--cream-deep)] text-[var(--ink-soft)]">{s.roll_number}. {s.name}</span>
                      ))}
                      {sts.length > 12 && <span className="lm-chip bg-[var(--cream-deep)] text-[var(--ink-soft)]">+{sts.length - 12} more</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add teacher modal */}
      <Modal
        open={showTeacher}
        onClose={() => setShowTeacher(false)}
        title="Create teacher account"
        footer={<Button variant="ghost" onClick={() => setShowTeacher(false)}>Close</Button>}
      >
        <form onSubmit={createTeacher} className="space-y-4">
          <Input label="Teacher name" value={tName} onChange={(e) => setTName(e.target.value)} required />
          <Input label="Email (used to sign in)" type="email" value={tEmail} onChange={(e) => setTEmail(e.target.value)} required />
          <Input label="Password" type="text" value={tPassword} onChange={(e) => setTPassword(e.target.value)} placeholder="Set a password for the teacher" required />
          {tErr && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{tErr}</p>}
          {tGenerated && (
            <div className="text-sm font-semibold text-[var(--sage-deep)] bg-[#f4f4f5] rounded-lg px-3 py-2 flex items-start gap-2">
              <KeyRound size={16} className="mt-0.5 shrink-0" /> <span>{tGenerated}</span>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={tBusy}>{tBusy ? 'Creating…' : 'Create teacher'}</Button>
        </form>
      </Modal>

      {/* Add class modal */}
      <Modal
        open={showClass}
        onClose={() => setShowClass(false)}
        title="Add class"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowClass(false)}>Cancel</Button>
            <Button onClick={createClass} disabled={cBusy || !cName}>{cBusy ? 'Adding…' : 'Add class'}</Button>
          </>
        }
      >
        <form onSubmit={createClass} className="space-y-4">
          <Input label="Class name" value={cName} onChange={(e) => setCName(e.target.value)} placeholder="e.g. Grade 3 - Stars" required />
          <label className="block">
            <span className="lm-label block mb-1.5">Assign teacher (optional)</span>
            <select className="lm-input" value={cTeacher} onChange={(e) => setCTeacher(e.target.value)}>
              <option value="">Unassigned</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="lm-label block mb-1.5">Grade level</span>
            <select className="lm-input" value={cGrade} onChange={(e) => setCGrade(e.target.value)}>
              <option value="">— (Not set)</option>
              {gradeLevels.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
            </select>
          </label>
          {cErr && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{cErr}</p>}
        </form>
      </Modal>

      {/* Upload CSV modal */}
      <Modal
        open={!!showUpload}
        onClose={() => setShowUpload(null)}
        title="Bulk upload students"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowUpload(null)}>Close</Button>
            <Button onClick={uploadStudents} disabled={uploadBusy}>{uploadBusy ? 'Uploading…' : 'Upload students'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
            <Users size={16} />
            <span>CSV must have <code className="font-bold">name</code> and <code className="font-bold">roll_number</code> columns.</span>
          </div>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}><Upload size={14} /> Choose .csv file</Button>
          </div>
          <textarea className="lm-input font-mono text-sm h-44" value={uploadText} onChange={(e) => setUploadText(e.target.value)} />
          {uploadErr && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{uploadErr}</p>}
          {uploadResult && <p className="text-sm font-semibold text-[var(--sage-deep)] bg-[#f4f4f5] rounded-lg px-3 py-2">{uploadResult}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title={`Delete ${confirmDelete?.kind}?`}
        message={confirmDelete?.kind === 'class'
          ? `Deleting "${confirmDelete?.name}" will also remove all its students, attendance, and progress. This cannot be undone.`
          : `Delete teacher "${confirmDelete?.name}"? They will no longer be able to sign in.`}
        confirmLabel="Delete"
        danger
      />

      {/* Edit school details modal */}
      <Modal
        open={showEditSchool}
        onClose={() => setShowEditSchool(false)}
        title="Edit school details"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowEditSchool(false)}>Cancel</Button>
            <Button onClick={saveSchoolDetails} disabled={editSchoolBusy}>{editSchoolBusy ? 'Saving…' : 'Save'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Contact info" value={editContact} onChange={(e) => setEditContact(e.target.value)} placeholder="Phone or address" />
          <Input label="Principal name" value={editPrincipal} onChange={(e) => setEditPrincipal(e.target.value)} placeholder="e.g. Mrs. Sharma" />

          {/* School branding */}
          <div className="pt-2 border-t border-[var(--line)]">
            <p className="lm-label mb-1">Report branding</p>
            <p className="text-xs text-[var(--ink-soft)] mb-3">Upload a logo and pick an accent color — these appear on generated PDF reports for this school.</p>
            <div className="mb-3">
              <ImageUpload folder="logos" value={editLogoUrl} onChange={setEditLogoUrl} label="School logo" compact />
            </div>
            <div>
              <span className="lm-label block mb-1.5">Accent color</span>
              <div className="flex items-center gap-2 flex-wrap">
                {['#c66b3d', '#5d7a58', '#6ba8c9', '#d99a2b', '#ee8a6b', '#7c9a76', '#3b5998', '#b85c8a'].map((c) => (
                  <button key={c} type="button" onClick={() => setEditBrandColor(c)} className={`w-8 h-8 rounded-full border-2 transition-transform ${editBrandColor === c ? 'border-[var(--ink)] scale-110' : 'border-[var(--line)]'}`} style={{ background: c }} />
                ))}
                <input className="lm-input w-24 text-sm" value={editBrandColor} onChange={(e) => setEditBrandColor(e.target.value)} placeholder="#c66b3d" />
              </div>
            </div>
          </div>

          <p className="text-xs text-[var(--ink-soft)]">The principal name shows in each teacher's top bar next to the school name.</p>
          {editSchoolErr && <p className="text-sm font-semibold text-[#dc2626] bg-[#fef2f2] rounded-lg px-3 py-2">{editSchoolErr}</p>}
        </div>
      </Modal>
    </div>
  );
}

// Simple CSV line parser that handles quoted commas.
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}
