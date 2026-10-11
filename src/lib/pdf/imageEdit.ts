// Immagini nei PDF: individuazione, eliminazione, sostituzione e aggiunta.
// Ogni immagine è identificata dalla posizione esatta dell'istruzione che la disegna:
// le modifiche toccano solo quell'istruzione, lasciando invariati il resto della pagina,
// l'ordine di sovrapposizione e le altre immagini (anche se sovrapposte).
import * as mupdf from 'mupdf';
import { apply, concat, findDrawCalls, IDENTITY, type DrawCall, type Matrix } from './contentStream';

export type Rect = [number, number, number, number];

/** Un passo del percorso verso l'immagine: l'istruzione nel contenuto della pagina o di un modulo. */
export interface Locator {
  start: number;
  end: number;
  name?: string;
}

export interface ImageInfo {
  id: number;
  /** Area occupata sulla pagina visualizzata. */
  bbox: Rect;
  /** Lunghezza visibile dei lati dell'immagine (servono a mantenere le proporzioni). */
  sideX: number;
  sideY: number;
  /** Dimensioni in pixel (0 se non note). */
  width: number;
  height: number;
  path: Locator[];
}

export interface StoredImage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

export type ImageEdit =
  | { kind: 'deleteImage'; target: Pick<ImageInfo, 'path'> }
  | { kind: 'replaceImage'; target: Pick<ImageInfo, 'path' | 'sideX' | 'sideY'>; imageId: string; fit: 'contain' | 'fill' }
  | { kind: 'addImage'; rect: Rect; imageId: string };

const MAX_DEPTH = 4;

function readContents(obj: mupdf.PDFObject): Uint8Array {
  const parts: Uint8Array[] = [];
  const contents = obj.get('Contents');
  // Nota: i flussi vanno letti dal riferimento, non dall'oggetto risolto (che perde i dati).
  const push = (s: mupdf.PDFObject) => {
    if (s.isStream()) parts.push(s.readStream().asUint8Array().slice());
  };
  if (contents.isArray()) contents.forEach((c) => push(c));
  else if (!contents.isNull()) push(contents);
  const total = parts.reduce((n, p) => n + p.length + 1, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
    out[o++] = 10;
  }
  return out;
}

function matrixOf(obj: mupdf.PDFObject): Matrix {
  const m = obj.get('Matrix');
  if (!m.isArray() || m.length !== 6) return IDENTITY;
  return [0, 1, 2, 3, 4, 5].map((i) => m.get(i).asNumber()) as Matrix;
}

function bboxOf(m: Matrix): { bbox: Rect; sideX: number; sideY: number } {
  const pts = [apply(m, 0, 0), apply(m, 1, 0), apply(m, 0, 1), apply(m, 1, 1)];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return {
    bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    sideX: Math.hypot(m[0], m[1]),
    sideY: Math.hypot(m[2], m[3]),
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Elenca le immagini disegnate su una pagina, anche dentro i moduli (Form XObject). */
export function getPageImages(doc: mupdf.PDFDocument, index: number): ImageInfo[] {
  const pageTransform = doc.loadPage(index).getTransform() as Matrix;
  const pageObj = doc.findPage(index);
  const images: ImageInfo[] = [];
  const seenForms = new Set<number>();

  const visit = (content: Uint8Array, resources: mupdf.PDFObject, ctm: Matrix, path: Locator[], depth: number) => {
    for (const call of findDrawCalls(content, ctm)) {
      const loc: Locator = { start: call.start, end: call.end, name: call.name };
      if (call.kind === 'inline') {
        record(call, [...path, loc], 0, 0);
        continue;
      }
      const xobj = resources.get('XObject').get(call.name!);
      if (!xobj.isStream()) continue;
      const subtype = xobj.get('Subtype').asName();
      if (subtype === 'Image') {
        record(call, [...path, loc], xobj.get('Width').asNumber(), xobj.get('Height').asNumber());
      } else if (subtype === 'Form' && depth < MAX_DEPTH) {
        const num = xobj.isIndirect() ? xobj.asIndirect() : -1;
        if (num >= 0 && seenForms.has(num)) continue; // evita cicli
        if (num >= 0) seenForms.add(num);
        const formRes = xobj.get('Resources').isNull() ? resources : xobj.get('Resources');
        visit(xobj.readStream().asUint8Array().slice(), formRes, concat(matrixOf(xobj), call.ctm), [...path, loc], depth + 1);
        if (num >= 0) seenForms.delete(num);
      }
    }
  };

  const record = (call: DrawCall, path: Locator[], width: number, height: number) => {
    const { bbox, sideX, sideY } = bboxOf(concat(call.ctm, pageTransform));
    if (bbox[2] - bbox[0] < 3 || bbox[3] - bbox[1] < 3) return; // invisibili o puntini
    images.push({ id: images.length, bbox: bbox.map(round) as Rect, sideX: round(sideX), sideY: round(sideY), width, height, path });
  };

  visit(readContents(pageObj), pageObj.getInheritable('Resources'), IDENTITY, [], 0);
  return images;
}

// --- Modifiche -----------------------------------------------------------------

interface Action {
  kind: 'delete' | 'replace';
  imageId?: string;
  fit?: 'contain' | 'fill';
  sideX?: number;
  sideY?: number;
}

interface ModNode {
  mods: Map<number, { loc: Locator; action?: Action; child?: ModNode }>;
}

function xobjects(doc: mupdf.PDFDocument, resources: mupdf.PDFObject): mupdf.PDFObject {
  let x = resources.get('XObject');
  if (x.isNull()) {
    resources.put('XObject', doc.newDictionary());
    x = resources.get('XObject');
  }
  return x;
}

function uniqueName(dict: mupdf.PDFObject, base: string): string {
  let i = 1;
  while (!dict.get(`${base}${i}`).isNull()) i++;
  return `${base}${i}`;
}

const num = (n: number) => (Math.abs(n) < 1e-6 ? '0' : n.toFixed(4).replace(/\.?0+$/, ''));

function splice(content: Uint8Array, edits: { start: number; end: number; text: string }[]): Uint8Array {
  const enc = new TextEncoder();
  const sorted = edits.slice().sort((a, b) => a.start - b.start);
  const chunks: Uint8Array[] = [];
  let pos = 0;
  for (const e of sorted) {
    chunks.push(content.subarray(pos, e.start));
    chunks.push(enc.encode(` ${e.text} `));
    pos = e.end;
  }
  chunks.push(content.subarray(pos));
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/**
 * Applica le modifiche alle immagini di una pagina. Il documento viene modificato in
 * memoria: va usato su una copia aperta apposta, mai sul file dell'utente.
 */
export function applyImageEdits(doc: mupdf.PDFDocument, index: number, edits: ImageEdit[], store: Map<string, StoredImage>) {
  if (edits.length === 0) return;
  const pageObj = doc.findPage(index);
  const imageRefs = new Map<string, mupdf.PDFObject>();
  const imageRef = (id: string) => {
    let ref = imageRefs.get(id);
    if (!ref) {
      const img = store.get(id);
      if (!img) throw new Error(`image not found: ${id}`);
      ref = doc.addImage(new mupdf.Image(img.bytes));
      imageRefs.set(id, ref);
    }
    return ref;
  };

  // 1. Eliminazioni e sostituzioni: si riscrive solo l'istruzione dell'immagine scelta.
  const root: ModNode = { mods: new Map() };
  for (const e of edits) {
    if (e.kind === 'addImage') continue;
    let node = root;
    e.target.path.forEach((loc, i) => {
      const last = i === e.target.path.length - 1;
      let entry = node.mods.get(loc.start);
      if (!entry) {
        entry = { loc };
        node.mods.set(loc.start, entry);
      }
      if (last) {
        entry.action =
          e.kind === 'deleteImage'
            ? { kind: 'delete' }
            : { kind: 'replace', imageId: e.imageId, fit: e.fit, sideX: e.target.sideX, sideY: e.target.sideY };
      } else {
        entry.child ??= { mods: new Map() };
        node = entry.child;
      }
    });
  }

  const rewrite = (content: Uint8Array, resources: mupdf.PDFObject, node: ModNode): Uint8Array => {
    const changes: { start: number; end: number; text: string }[] = [];
    for (const { loc, action, child } of node.mods.values()) {
      if (child && loc.name) {
        // L'immagine è dentro un modulo: si crea una copia del modulo solo per questa
        // pagina, così le altre pagine che lo usano restano invariate.
        const xdict = xobjects(doc, resources);
        const form = xdict.get(loc.name);
        const formRes = form.get('Resources').isNull() ? resources : form.get('Resources');
        const newContent = rewrite(form.readStream().asUint8Array().slice(), formRes, child);
        const dict = doc.newDictionary();
        form.forEach((v, k) => {
          if (k !== 'Length' && k !== 'Filter' && k !== 'DecodeParms') dict.put(k, v);
        });
        if (form.get('Resources').isNull()) dict.put('Resources', resources);
        const copy = doc.addStream(newContent, dict);
        const name = uniqueName(xdict, 'EPForm');
        xdict.put(name, copy);
        changes.push({ start: loc.start, end: loc.end, text: `/${name} Do` });
      } else if (action?.kind === 'delete') {
        changes.push({ start: loc.start, end: loc.end, text: '' });
      } else if (action?.kind === 'replace') {
        const img = store.get(action.imageId!)!;
        const xdict = xobjects(doc, resources);
        const name = uniqueName(xdict, 'EPImg');
        xdict.put(name, imageRef(action.imageId!));
        // Nel sistema dell'immagine originale l'area è il quadrato unitario: la nuova
        // immagine lo riempie, oppure ci sta dentro centrata con le sue proporzioni.
        let [sx, sy, sw, sh] = [0, 0, 1, 1];
        if (action.fit === 'contain' && img.width > 0 && img.height > 0 && action.sideX! > 0 && action.sideY! > 0) {
          const a = img.width / img.height;
          const b = action.sideX! / action.sideY!;
          if (a > b) {
            sh = b / a;
            sy = (1 - sh) / 2;
          } else {
            sw = a / b;
            sx = (1 - sw) / 2;
          }
        }
        changes.push({ start: loc.start, end: loc.end, text: `q ${num(sw)} 0 0 ${num(sh)} ${num(sx)} ${num(sy)} cm /${name} Do Q` });
      }
    }
    return splice(content, changes);
  };

  if (root.mods.size > 0) {
    const resources = pageObj.getInheritable('Resources');
    const content = rewrite(readContents(pageObj), resources, root);
    pageObj.put('Contents', doc.addStream(content, {}));
  }

  // 2. Immagini aggiunte: disegnate sopra il contenuto esistente, nello spazio della
  // pagina visualizzata. Il contenuto originale viene racchiuso tra q/Q.
  const adds = edits.filter((e): e is Extract<ImageEdit, { kind: 'addImage' }> => e.kind === 'addImage');
  if (adds.length > 0) {
    let resources = pageObj.getInheritable('Resources');
    if (resources.isNull()) {
      pageObj.put('Resources', doc.newDictionary());
      resources = pageObj.get('Resources');
    }
    const xdict = xobjects(doc, resources);
    const inv = mupdf.Matrix.invert(doc.loadPage(index).getTransform());
    let ops = `q ${inv.map(num).join(' ')} cm\n`;
    for (const a of adds) {
      const name = uniqueName(xdict, 'EPImg');
      xdict.put(name, imageRef(a.imageId));
      const [x0, y0, x1, y1] = a.rect;
      ops += `q ${num(x1 - x0)} 0 0 ${num(-(y1 - y0))} ${num(x0)} ${num(y1)} cm /${name} Do Q\n`;
    }
    ops += 'Q\n';
    const contents = pageObj.get('Contents');
    const arr = doc.newArray();
    arr.push(doc.addStream('q\n', {}));
    if (contents.isArray()) contents.forEach((c) => arr.push(c));
    else if (!contents.isNull()) arr.push(contents);
    arr.push(doc.addStream(`Q\n${ops}`, {}));
    pageObj.put('Contents', arr);
  }
}
