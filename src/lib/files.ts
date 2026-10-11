// Apertura dei PDF scelti dall'utente e salvataggio delle copie generate.
import { t } from './i18n.svelte';
import { closeFile, newFileId, openFile, PdfClientError } from './pdf/client';
import { askPassword } from './state.svelte';

export interface LoadedPdf {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  firstAspect: number;
}

export interface BuiltPdf {
  bytes: Uint8Array;
  filename: string;
  pages: number;
}

/** Errore già tradotto, pronto da mostrare all'utente. */
export class UserError extends Error {}

/**
 * Apre un file PDF, chiedendo la password se serve.
 * Restituisce null se l'utente annulla la richiesta di password.
 */
export async function loadPdf(file: File): Promise<LoadedPdf | null> {
  const bytes = await file.arrayBuffer();
  const id = newFileId();
  let password: string | undefined;

  for (;;) {
    try {
      const r = await openFile(id, bytes, password);
      return { id, name: file.name, size: file.size, pageCount: r.pageCount, firstAspect: r.firstAspect };
    } catch (e) {
      if (!(e instanceof PdfClientError)) throw e;
      switch (e.code) {
        case 'needs_password':
        case 'wrong_password': {
          const pw = await askPassword(file.name, e.code === 'wrong_password');
          if (pw === null) return null;
          password = pw;
          continue;
        }
        case 'not_pdf':
          throw new UserError(t('error.notPdf', { name: file.name }));
        case 'damaged':
          throw new UserError(t('error.damaged', { name: file.name }));
        case 'empty':
          throw new UserError(t('error.empty', { name: file.name }));
        case 'engine':
          throw new UserError(t('error.engine'));
        default:
          throw new UserError(t('error.generic', { message: e.message }));
      }
    }
  }
}

export function unloadPdf(pdf: LoadedPdf) {
  closeFile(pdf.id).catch(() => {});
}

export function errorText(e: unknown): string {
  if (e instanceof UserError) return e.message;
  if (e instanceof PdfClientError && e.code === 'engine') return t('error.engine');
  return t('error.generic', { message: e instanceof Error ? e.message : String(e) });
}

export function baseName(name: string): string {
  return name.replace(/\.pdf$/i, '');
}

/** Rende sicuro un nome di file e garantisce l'estensione .pdf. */
export function safeFilename(name: string, fallback: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  const base = baseName(cleaned) || fallback;
  return `${base}.pdf`;
}

export function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(pdfBlob(bytes));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function canShareFiles(): boolean {
  try {
    const probe = new File([new Uint8Array(1)], 'x.pdf', { type: 'application/pdf' });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export async function sharePdf(bytes: Uint8Array, filename: string) {
  const file = new File([bytes as BlobPart], filename, { type: 'application/pdf' });
  try {
    await navigator.share({ files: [file], title: filename });
  } catch (e) {
    if ((e as DOMException).name !== 'AbortError') throw e;
  }
}
