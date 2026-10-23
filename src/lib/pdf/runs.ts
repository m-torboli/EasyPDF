// Porzioni di testo con stile (grassetto, corsivo). Modulo senza dipendenze dal motore
// PDF, così l'interfaccia lo può usare senza caricare MuPDF.

/** Porzione di testo con lo stesso stile (per esempio una parola in grassetto). */
export interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
}

/** Unisce porzioni con lo stesso stile, eliminando quelle vuote. */
export function normalizeRuns(runs: TextRun[]): TextRun[] {
  const out: TextRun[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const last = out.at(-1);
    if (last && last.bold === r.bold && last.italic === r.italic) last.text += r.text;
    else out.push({ ...r });
  }
  return out;
}

export const runsText = (runs: TextRun[]) => runs.map((r) => r.text).join('');
