'use client';

// ─── PDF Text Extraction via CDN-loaded pdfjs-dist ────────────────────────────
// Loads pdfjs from CDN at runtime to avoid build-time module resolution issues

/* eslint-disable @typescript-eslint/no-explicit-any */

const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

let pdfjsLoaded = false;

async function loadPdfjsFromCDN(): Promise<any> {
  if (typeof window === 'undefined') throw new Error('PDF extraction requires browser environment');

  // Return cached global if already loaded
  if (pdfjsLoaded && (window as any).pdfjsLib) {
    return (window as any).pdfjsLib;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PDFJS_CDN;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) { reject(new Error('pdfjs-dist failed to load')); return; }
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
      pdfjsLoaded = true;
      resolve(lib);
    };
    script.onerror = () => reject(new Error('Failed to load PDF library from CDN'));
    document.head.appendChild(script);
  });
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await loadPdfjsFromCDN();

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items as Array<{ str?: string }>)
      .map((item) => item.str ?? '')
      .join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n');
}
