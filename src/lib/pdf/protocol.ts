// Messaggi scambiati tra l'interfaccia e il Web Worker PDF.
import type { EditReport, TextEdit } from './textEdit';

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
  | { id: number; type: 'renderEdited'; fileId: string; index: number; width: number; edits: TextEdit[] }
  | { id: number; type: 'buildEdited'; fileId: string; pages: { index: number; edits: TextEdit[] }[] };

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
