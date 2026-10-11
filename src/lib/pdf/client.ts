// Interfaccia a promesse verso il Web Worker PDF.
import type { ErrorCode, OpenResult, PageEdits, PageInfo, PickMsg, RenderEditedResult, RenderResult, Request, Response } from './protocol';

export class PdfClientError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode, message: string = code) {
    super(message);
    this.code = code;
  }
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
type Pending = { resolve: (v: unknown) => void; reject: (e: unknown) => void };

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function start(): Promise<void> {
  if (ready) return ready;
  ready = new Promise<void>((resolve, reject) => {
    worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<Response>) => {
      const res = ev.data;
      if (res.id === 0) return resolve();
      const p = pending.get(res.id);
      if (!p) return;
      pending.delete(res.id);
      if (res.ok) p.resolve(res.result);
      else p.reject(new PdfClientError(res.error.code, res.error.message));
    };
    worker.onerror = (ev) => {
      const err = new PdfClientError('engine', ev.message || 'worker error');
      reject(err);
      for (const p of pending.values()) p.reject(err);
      pending.clear();
      ready = null;
      worker = null;
    };
  });
  return ready;
}

async function call<T>(req: DistributiveOmit<Request, 'id'>, transfer: Transferable[] = []): Promise<T> {
  await start();
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    worker!.postMessage({ ...req, id }, transfer);
  });
}

/** Avvia il motore in anticipo (scarica e compila il WebAssembly). */
export const warmUp = () => start();

let fileCounter = 0;
export const newFileId = () => `f${++fileCounter}`;

/** Apre un PDF. I byte vengono copiati: il File originale resta intatto. */
export async function openFile(fileId: string, bytes: ArrayBuffer, password?: string): Promise<OpenResult> {
  const copy = bytes.slice(0);
  return call<OpenResult>({ type: 'open', fileId, bytes: copy, password }, [copy]);
}

export function closeFile(fileId: string): Promise<void> {
  thumbnails.forEach((url, key) => {
    if (key.startsWith(`${fileId}:`)) {
      URL.revokeObjectURL(url);
      thumbnails.delete(key);
    }
  });
  return call<void>({ type: 'close', fileId });
}

const thumbnails = new Map<string, string>();

/** Restituisce l'URL di un'anteprima PNG della pagina, generata una volta sola. */
export async function thumbnail(fileId: string, index: number, width: number): Promise<string> {
  const key = `${fileId}:${index}:${width}`;
  const cached = thumbnails.get(key);
  if (cached) return cached;
  const r = await call<RenderResult>({ type: 'render', fileId, index, width });
  const url = URL.createObjectURL(new Blob([r.png as BlobPart], { type: 'image/png' }));
  thumbnails.set(key, url);
  return url;
}

export function build(parts: { fileId: string; pages: PickMsg[] }[]): Promise<Uint8Array> {
  return call<Uint8Array>({ type: 'build', parts });
}

// Gli oggetti di stato dell'interfaccia vanno copiati in dati semplici prima di passare al worker.
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Paragrafi e immagini modificabili di una pagina. */
export function pageInfo(fileId: string, index: number): Promise<PageInfo> {
  return call<PageInfo>({ type: 'pageText', fileId, index });
}

/** Consegna al motore un'immagine scelta dall'utente, da usare nelle modifiche. */
export function putImage(imageId: string, bytes: ArrayBuffer, width: number, height: number): Promise<void> {
  const copy = bytes.slice(0);
  return call<void>({ type: 'putImage', imageId, bytes: copy, width, height }, [copy]);
}

/** Rende una pagina con le modifiche al testo applicate (anteprima fedele al risultato). */
export async function renderEdited(fileId: string, index: number, width: number, edits: PageEdits) {
  const r = await call<RenderEditedResult>({ type: 'renderEdited', fileId, index, width, edits: plain(edits) });
  return { url: URL.createObjectURL(new Blob([r.png as BlobPart], { type: 'image/png' })), width: r.width, height: r.height, reports: r.reports };
}

export function buildEdited(fileId: string, pages: { index: number; edits: PageEdits }[]): Promise<Uint8Array> {
  return call<Uint8Array>({ type: 'buildEdited', fileId, pages: plain(pages) });
}
