import { useState, useRef } from 'react';
import { FileDown, Loader2, CheckCircle2, Download, Layers } from 'lucide-react';
import JSZip from 'jszip';
import type { Student, School, ClassRow } from '@/lib/types';
import { loadReportData } from '@/lib/reportData';
import { generatePdfBlobFromElement, reportFileName } from '@/lib/pdfGenerator';
import { PdfReportTemplate } from '@/components/PdfReportTemplate';
import { Button } from '@/components/ui';
import { Modal } from '@/components/Modal';

interface BulkProgress {
  current: number;
  total: number;
  currentName: string;
  done: boolean;
  results: { name: string; fileName: string; blob: Blob }[];
}

export function BulkReportGenerator({ students, school, classRow, onClose }: {
  students: Student[];
  school: School | null;
  classRow: ClassRow | null;
  onClose: () => void;
}) {
  const [progress, setProgress] = useState<BulkProgress>({ current: 0, total: students.length, currentName: '', done: false, results: [] });
  const [running, setRunning] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  async function generateAll() {
    setRunning(true);
    setProgress({ current: 0, total: students.length, currentName: '', done: false, results: [] });

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.zIndex = '-1';
    document.body.appendChild(container);

    const { createRoot } = await import('react-dom/client');
    const { createElement } = await import('react');
    const root = createRoot(container);

    const results: { name: string; fileName: string; blob: Blob }[] = [];

    try {
      for (let i = 0; i < students.length; i++) {
        const student = students[i];
        setProgress((p) => ({ ...p, current: i, currentName: student.name }));

        try {
          const data = await loadReportData(student.id);
          root.render(createElement(PdfReportTemplate, { data }));
          await new Promise((r) => setTimeout(r, 500));
          const el = container.querySelector('#pdf-report-root') as HTMLElement;
          if (!el) continue;
          const blob = await generatePdfBlobFromElement(el);
          results.push({ name: student.name, fileName: reportFileName(data), blob });
          setProgress((p) => ({ ...p, results: [...results] }));
        } catch (e) {
          console.error(`Failed for ${student.name}:`, e);
        }
      }

      setProgress((p) => ({ ...p, current: students.length, currentName: '', done: true }));
    } finally {
      root.unmount();
      document.body.removeChild(container);
      setRunning(false);
    }
  }

  async function downloadZip() {
    const zip = new JSZip();
    for (const r of progress.results) {
      zip.file(r.fileName, r.blob);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${classRow?.name ?? 'Class'}_Reports.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadOne(r: { name: string; fileName: string; blob: Blob }) {
    const url = URL.createObjectURL(r.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = r.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Generate All Reports"
      size="md"
      footer={
        !running && progress.done ? (
          <>
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button onClick={downloadZip}><Layers size={16} /> Download all as ZIP</Button>
          </>
        ) : !running && progress.results.length === 0 ? (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={generateAll}><FileDown size={16} /> Generate {students.length} reports</Button>
          </>
        ) : undefined
      }
    >
      <div ref={containerRef} className="space-y-4">
        {!running && progress.results.length === 0 && (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-2xl bg-[var(--coral-soft)] flex items-center justify-center mx-auto mb-4">
              <FileDown size={28} className="text-[var(--terracotta)]" />
            </div>
            <p className="font-bold text-[var(--ink)]">Generate PDF reports for all {students.length} students</p>
            <p className="text-sm text-[var(--ink-soft)] mt-1">This will create a branded yearly growth report for each student in {classRow?.name}. It may take a minute — please keep this tab open.</p>
          </div>
        )}

        {running && (
          <div className="py-4">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 size={20} className="animate-spin text-[var(--terracotta)]" />
              <div className="flex-1">
                <p className="text-sm font-bold text-[var(--ink)]">Generating report {progress.current + 1} of {progress.total}</p>
                <p className="text-xs text-[var(--ink-soft)]">{progress.currentName}</p>
              </div>
            </div>
            <div className="h-2 bg-[var(--cream-deep)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--terracotta)] rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
            </div>
          </div>
        )}

        {progress.done && (
          <div className="py-2">
            <div className="flex items-center gap-2 mb-4 text-[var(--sage-deep)]">
              <CheckCircle2 size={20} />
              <p className="font-bold">Generated {progress.results.length} of {students.length} reports</p>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {progress.results.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[var(--cream-deep)]">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 size={16} className="text-[var(--sage-deep)] shrink-0" />
                    <span className="text-sm font-semibold text-[var(--ink)] truncate">{r.name}</span>
                  </div>
                  <button onClick={() => downloadOne(r)} className="lm-chip bg-white text-[var(--terracotta)] hover:bg-[var(--coral-soft)] cursor-pointer shrink-0">
                    <Download size={13} /> Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
