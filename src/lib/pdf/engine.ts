// Operazioni PDF basate su MuPDF. Funzioni pure: girano nel Web Worker
// dell'app e, identiche, nei test con Node.
import * as mupdf from 'mupdf';

export type PdfErrorCode = 'not_pdf' | 'damaged' | 'needs_password' | 'wrong_password' | 'empty';

export class PdfError extends Error {
  code: PdfErrorCode;
  constructor(code: PdfErrorCode, message: string = code) {
    super(message);
    this.code = code;
  }
}

/** Una pagina da includere nel risultato: indice (da 0) e rotazione aggiuntiva in gradi. */
export interface PagePick {
  index: number;
  rotate: number;
}

export interface BuildPart {
  bytes: Uint8Array;
  password?: string;
  pages: PagePick[];
}

function looksLikePdf(bytes: Uint8Array): boolean {
  // L'intestazione "%PDF" deve trovarsi nei primi 1024 byte (specifica PDF, tolleranza inclusa).
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  return head.includes('%PDF');
}

/** Apre un PDF dai suoi byte. Lancia PdfError con un codice comprensibile. */
export function openPdf(bytes: Uint8Array, password?: string): mupdf.PDFDocument {
  if (!looksLikePdf(bytes)) throw new PdfError('not_pdf');

  let doc: mupdf.Document;
  try {
    doc = mupdf.Document.openDocument(bytes, 'application/pdf');
  } catch (e) {
    throw new PdfError('damaged', String(e));
  }
  const pdf = doc.asPDF();
  if (!pdf) throw new PdfError('not_pdf');

  if (pdf.needsPassword()) {
    if (password === undefined || password === '') throw new PdfError('needs_password');
    if (pdf.authenticatePassword(password) === 0) throw new PdfError('wrong_password');
  }

  let count: number;
  try {
    count = pdf.countPages();
  } catch (e) {
    throw new PdfError('damaged', String(e));
  }
  if (count === 0) throw new PdfError('empty');
  return pdf;
}

function normalizeRotation(deg: number): number {
  return ((Math.round(deg / 90) * 90) % 360 + 360) % 360;
}

function addRotation(pageObj: mupdf.PDFObject, extra: number) {
  if (normalizeRotation(extra) === 0) return;
  const current = pageObj.getInheritable('Rotate');
  const base = current.isNull() ? 0 : current.asNumber();
  pageObj.put('Rotate', normalizeRotation(base + extra));
}

/** Larghezza/altezza della pagina come appare (rotazione propria inclusa), in punti. */
export function pageSize(doc: mupdf.PDFDocument, index: number): { width: number; height: number } {
  const b = doc.loadPage(index).getBounds();
  return { width: b[2] - b[0], height: b[3] - b[1] };
}

/** Rende una pagina come PNG largo `targetWidth` pixel. */
export function renderPage(doc: mupdf.PDFDocument, index: number, targetWidth: number) {
  const page = doc.loadPage(index);
  const b = page.getBounds();
  const scale = targetWidth / Math.max(1, b[2] - b[0]);
  const pix = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
  try {
    return { png: pix.asPNG().slice(), width: pix.getWidth(), height: pix.getHeight() };
  } finally {
    pix.destroy();
  }
}

// Un link interno punta a una pagina del documento di origine: copiarlo trascinerebbe
// nel risultato l'intero albero delle pagine di origine, quindi viene scartato.
function isInternalLink(annot: mupdf.PDFObject): boolean {
  if (annot.get('Subtype').asName() !== 'Link') return false;
  if (!annot.get('Dest').isNull()) return true;
  const action = annot.get('A');
  return !action.isNull() && action.get('S').asName() !== 'URI';
}

function stripAnnotationPageRefs(src: mupdf.PDFDocument) {
  // Le annotazioni puntano alla propria pagina con /P. Rimuovendolo prima dell'innesto
  // si evita che MuPDF copi anche le pagine di origine come oggetti orfani.
  const n = src.countPages();
  for (let i = 0; i < n; i++) {
    const annots = src.findPage(i).get('Annots');
    if (!annots.isArray()) continue;
    annots.forEach((a) => {
      const obj = a.resolve();
      if (obj.isDictionary()) obj.delete('P');
    });
  }
}

function acroFormFields(dst: mupdf.PDFDocument, src: mupdf.PDFDocument, map: mupdf.PDFGraftMap) {
  const root = dst.getTrailer().get('Root');
  let form = root.get('AcroForm');
  if (!form.isDictionary()) {
    form = dst.newDictionary();
    root.put('AcroForm', dst.addObject(form));
    form = root.get('AcroForm');
  }
  let fields = form.get('Fields');
  if (!fields.isArray()) {
    form.put('Fields', dst.newArray());
    fields = form.get('Fields');
  }
  const srcForm = src.getTrailer().get('Root').get('AcroForm');
  if (srcForm.isDictionary()) {
    if (form.get('DR').isNull() && !srcForm.get('DR').isNull()) form.put('DR', map.graftObject(srcForm.get('DR')));
    if (form.get('DA').isNull() && !srcForm.get('DA').isNull()) form.put('DA', map.graftObject(srcForm.get('DA')));
  }
  return fields;
}

/**
 * Copia le annotazioni (note, evidenziazioni, campi modulo, link esterni) della pagina
 * di origine sulla pagina innestata: graftPage da solo non le porta con sé.
 */
function copyAnnotations(
  dst: mupdf.PDFDocument,
  src: mupdf.PDFDocument,
  map: mupdf.PDFGraftMap,
  srcPageObj: mupdf.PDFObject,
  dstPageObj: mupdf.PDFObject,
  registeredFields: Set<number>,
) {
  const annots = srcPageObj.get('Annots');
  if (!annots.isArray()) return;

  const copied = dst.newArray();
  let fields: mupdf.PDFObject | null = null;

  annots.forEach((a) => {
    const srcAnnot = a.resolve();
    if (!srcAnnot.isDictionary() || isInternalLink(srcAnnot)) return;

    const newAnnot = map.graftObject(a);
    newAnnot.resolve().put('P', dstPageObj);
    copied.push(newAnnot);

    if (srcAnnot.get('Subtype').asName() === 'Widget') {
      // Registra il campo di primo livello nell'AcroForm del documento di destinazione.
      let top = newAnnot;
      while (!top.resolve().get('Parent').isNull()) top = top.resolve().get('Parent');
      const num = top.isIndirect() ? top.asIndirect() : -1;
      if (!registeredFields.has(num)) {
        registeredFields.add(num);
        fields ??= acroFormFields(dst, src, map);
        fields.push(top);
      }
    }
  });

  if (copied.length > 0) dstPageObj.put('Annots', copied);
}

/**
 * Crea un nuovo PDF con le pagine scelte, nell'ordine dato, da uno o più documenti.
 * I byte di origine non vengono mai modificati: ogni documento è riaperto in memoria.
 */
export function buildPdf(parts: BuildPart[]): Uint8Array {
  const usable = parts.filter((p) => p.pages.length > 0);
  if (usable.length === 0) throw new Error('no pages selected');

  // Il primo documento fa da base: rearrangePages conserva annotazioni, moduli,
  // segnalibri e metadati delle pagine tenute.
  const [first, ...rest] = usable;
  const dst = openPdf(first.bytes, first.password);
  dst.rearrangePages(first.pages.map((p) => p.index));
  first.pages.forEach((p, i) => addRotation(dst.findPage(i), p.rotate));

  const registeredFields = new Set<number>();
  for (const part of rest) {
    const src = openPdf(part.bytes, part.password);
    stripAnnotationPageRefs(src);
    // Una mappa per documento: font e immagini condivisi tra pagine sono copiati una volta sola.
    const map = dst.newGraftMap();
    for (const pick of part.pages) {
      map.graftPage(-1, src, pick.index);
      const dstPageObj = dst.findPage(dst.countPages() - 1);
      copyAnnotations(dst, src, map, src.findPage(pick.index), dstPageObj, registeredFields);
      addRotation(dstPageObj, pick.rotate);
    }
    map.destroy();
    src.destroy();
  }

  // Il nuovo file è salvato senza password: è una copia creata da chi l'ha sbloccata.
  const out = dst.saveToBuffer('garbage=compact,compress,decrypt');
  const bytes = out.asUint8Array().slice();
  out.destroy();
  dst.destroy();
  return bytes;
}
