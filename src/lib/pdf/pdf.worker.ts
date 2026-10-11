// Web Worker: tutte le operazioni PDF girano qui, così l'interfaccia non si blocca mai.
import type * as mupdf from 'mupdf';
import { buildPdf, openPdf, PdfError, renderPage, type PagePick } from './engine';
import type { Request, Response } from './protocol';
import { applyImageEdits, getPageImages, type StoredImage } from './imageEdit';
import type { PageEdits } from './protocol';
import { applyTextEdits, getPageText } from './textEdit';

interface OpenFile {
  bytes: Uint8Array;
  password?: string;
  doc: mupdf.PDFDocument;
}

const files = new Map<string, OpenFile>();
const images = new Map<string, StoredImage>();

// Prima le immagini (riscrivono il contenuto), poi il testo (rimozione e scrittura).
function applyEdits(doc: mupdf.PDFDocument, index: number, edits: PageEdits) {
  applyImageEdits(doc, index, edits.images, images);
  return applyTextEdits(doc, index, edits.text);
}

function getFile(fileId: string): OpenFile {
  const f = files.get(fileId);
  if (!f) throw new Error(`file not open: ${fileId}`);
  return f;
}

function handle(req: Request): { result: unknown; transfer?: Transferable[] } {
  switch (req.type) {
    case 'open': {
      const bytes = new Uint8Array(req.bytes);
      const doc = openPdf(bytes, req.password);
      files.get(req.fileId)?.doc.destroy();
      files.set(req.fileId, { bytes, password: req.password, doc });
      const pageCount = doc.countPages();
      const b = doc.loadPage(0).getBounds();
      return { result: { pageCount, firstAspect: (b[3] - b[1]) / Math.max(1, b[2] - b[0]) } };
    }
    case 'render': {
      const r = renderPage(getFile(req.fileId).doc, req.index, req.width);
      return { result: r, transfer: [r.png.buffer] };
    }
    case 'build': {
      const bytes = buildPdf(
        req.parts.map((p) => {
          const f = getFile(p.fileId);
          return { bytes: f.bytes, password: f.password, pages: p.pages as PagePick[] };
        }),
      );
      return { result: bytes, transfer: [bytes.buffer] };
    }
    case 'pageText':
      return { result: { ...getPageText(getFile(req.fileId).doc, req.index), images: getPageImages(getFile(req.fileId).doc, req.index) } };
    case 'putImage':
      images.set(req.imageId, { bytes: new Uint8Array(req.bytes), width: req.width, height: req.height });
      return { result: null };
    case 'renderEdited': {
      // Le modifiche si applicano a una copia appena riaperta: annullarle è immediato.
      const f = getFile(req.fileId);
      const copy = openPdf(f.bytes, f.password);
      try {
        const reports = applyEdits(copy, req.index, req.edits);
        const r = renderPage(copy, req.index, req.width);
        return { result: { ...r, reports }, transfer: [r.png.buffer] };
      } finally {
        copy.destroy();
      }
    }
    case 'buildEdited': {
      const f = getFile(req.fileId);
      const copy = openPdf(f.bytes, f.password);
      try {
        for (const p of req.pages) applyEdits(copy, p.index, p.edits);
        const out = copy.saveToBuffer('garbage=compact,compress,decrypt');
        const bytes = out.asUint8Array().slice();
        out.destroy();
        return { result: bytes, transfer: [bytes.buffer] };
      } finally {
        copy.destroy();
      }
    }
    case 'close': {
      files.get(req.fileId)?.doc.destroy();
      files.delete(req.fileId);
      return { result: null };
    }
  }
}

self.onmessage = (ev: MessageEvent<Request>) => {
  const req = ev.data;
  let res: Response;
  let transfer: Transferable[] = [];
  try {
    const out = handle(req);
    res = { id: req.id, ok: true, result: out.result };
    transfer = out.transfer ?? [];
  } catch (e) {
    res = {
      id: req.id,
      ok: false,
      error: e instanceof PdfError ? { code: e.code, message: e.message } : { code: 'generic', message: String(e) },
    };
  }
  (self as unknown as Worker).postMessage(res, transfer);
};

(self as unknown as Worker).postMessage({ id: 0, ok: true, result: 'ready' } satisfies Response);
