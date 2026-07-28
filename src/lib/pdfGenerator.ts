import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { ReportData } from '@/lib/reportData';

const A4_WIDTH_PX = 794;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

// Renders a DOM element to a multi-page A4 PDF.
// The element should contain one or more full-page (794px wide) children.
export async function generatePdfFromElement(element: HTMLElement, fileName: string): Promise<void> {
  // Render the entire report at 2x scale for crisp text
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: A4_WIDTH_PX,
    windowWidth: A4_WIDTH_PX,
  });

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageHeightPx = (A4_HEIGHT_MM / A4_WIDTH_MM) * canvas.width;
  const totalPages = Math.ceil(canvas.height / pageHeightPx);

  for (let i = 0; i < totalPages; i++) {
    const offsetY = i * pageHeightPx;
    const sliceHeight = Math.min(pageHeightPx, canvas.height - offsetY);

    // Create a temp canvas for this page slice
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;
    const ctx = pageCanvas.getContext('2d');
    if (!ctx) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

    const imgData = pageCanvas.toDataURL('image/jpeg', 0.92);
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, (sliceHeight / canvas.width) * A4_WIDTH_MM);
  }

  pdf.save(fileName);
}

export async function generatePdfBlobFromElement(element: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: A4_WIDTH_PX,
    windowWidth: A4_WIDTH_PX,
  });

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageHeightPx = (A4_HEIGHT_MM / A4_WIDTH_MM) * canvas.width;
  const totalPages = Math.ceil(canvas.height / pageHeightPx);

  for (let i = 0; i < totalPages; i++) {
    const offsetY = i * pageHeightPx;
    const sliceHeight = Math.min(pageHeightPx, canvas.height - offsetY);

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;
    const ctx = pageCanvas.getContext('2d');
    if (!ctx) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

    const imgData = pageCanvas.toDataURL('image/jpeg', 0.92);
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, (sliceHeight / canvas.width) * A4_WIDTH_MM);
  }

  return pdf.output('blob');
}

export function reportFileName(data: ReportData): string {
  const safe = data.student.name.replace(/[^a-zA-Z0-9]/g, '_');
  return `${safe}_Yearly_Report_${data.academicYear}.pdf`;
}
