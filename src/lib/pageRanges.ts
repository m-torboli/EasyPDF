// Parsing e formattazione degli intervalli di pagine scritti dall'utente.
// Sintassi: "1-3, 5, 8-10". Le pagine sono numerate da 1.
// Varianti accettate: "-3" (dall'inizio alla 3), "8-" (dalla 8 alla fine),
// trattini tipografici (– —), punto e virgola come separatore.

export type RangeErrorCode = 'invalid' | 'zero' | 'out_of_range' | 'reversed';

export interface RangeError {
  code: RangeErrorCode;
  token: string;
  page?: number;
  max?: number;
  suggestion?: string;
}

export type ParseResult =
  | { ok: true; pages: number[] }
  | { ok: false; error: RangeError };

const SINGLE = /^\d+$/;
const RANGE = /^(\d*)\s*[-–—]\s*(\d*)$/;

export function parsePageRanges(input: string, pageCount: number): ParseResult {
  const selected = new Set<number>();
  const tokens = input.split(/[,;]/).map((t) => t.trim()).filter((t) => t.length > 0);

  for (const token of tokens) {
    let from: number;
    let to: number;

    if (SINGLE.test(token)) {
      from = to = Number(token);
    } else {
      const m = RANGE.exec(token);
      if (!m || (m[1] === '' && m[2] === '')) {
        return { ok: false, error: { code: 'invalid', token } };
      }
      from = m[1] === '' ? 1 : Number(m[1]);
      to = m[2] === '' ? pageCount : Number(m[2]);
    }

    for (const p of [from, to]) {
      if (p === 0) return { ok: false, error: { code: 'zero', token } };
      if (p > pageCount) {
        return { ok: false, error: { code: 'out_of_range', token, page: p, max: pageCount } };
      }
    }
    if (from > to) {
      return { ok: false, error: { code: 'reversed', token, suggestion: `${to}-${from}` } };
    }
    for (let p = from; p <= to; p++) selected.add(p);
  }

  return { ok: true, pages: [...selected].sort((a, b) => a - b) };
}

// Trasforma un elenco di pagine nella forma compatta: [1,2,3,5,8,9] -> "1-3, 5, 8-9"
export function formatPageRanges(pages: Iterable<number>): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j === i ? `${sorted[i]}` : `${sorted[i]}-${sorted[j]}`);
    i = j + 1;
  }
  return parts.join(', ');
}

// Versione adatta a un nome di file: [1,2,3,5] -> "1-3_5"
export function rangesForFilename(pages: Iterable<number>, maxLength = 40): string {
  const s = formatPageRanges(pages).replace(/, /g, '_');
  return s.length > maxLength ? s.slice(0, maxLength).replace(/[_-]\d*$/, '') + '_etc' : s;
}
