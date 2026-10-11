// Messaggi scambiati tra l'interfaccia e il Web Worker PDF.
import type { ImageEdit, ImageInfo } from './imageEdit';
import type { EditReport, PageTextInfo, TextEdit } from './textEdit';

export interface PageEdits {
  text: TextEdit[];
  images: ImageEdit[];
}

export type PageInfo = PageTextInfo & { images: ImageInfo[] };

export interface PickMsg {
  index: number;
  rotate: number;
}

export type Request =
  | { id: number; type: 'open'; fileId: string; bytes: ArrayBuffer; password?: string }
  | { id: number; type: 'render'; fileId: string; index: number; width: number }
  | { id: number; type: 'build'; parts: { fileId: string; pages: PickMsg[] }[] }
  | { id: number; type: 'close'; fileId: string }
  | { id: number; type: 'pageText'; fileId: string; index: number }
  | { id: number; type: 'renderEdited'; fileId: string; index: number; width: number; edits: PageEdits }
  | { id: number; type: 'buildEdited'; fileId: string; pages: { index: number; edits: PageEdits }[] }
  | { id: number; type: 'putImage'; imageId: string; bytes: ArrayBuffer; width: number; height: number };

export type ErrorCode = 'not_pdf' | 'damaged' | 'needs_password' | 'wrong_password' | 'empty' | 'generic' | 'engine';

export type Response =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: { code: ErrorCode; message: string } };

export interface OpenResult {
  pageCount: number;
  firstAspect: number;
}

export interface RenderResult {
  png: Uint8Array;
  width: number;
  height: number;
}

export interface RenderEditedResult extends RenderResult {
  reports: EditReport[];
}
