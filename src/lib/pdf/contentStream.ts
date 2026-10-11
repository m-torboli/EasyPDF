// Lettura delle istruzioni di disegno di una pagina PDF (content stream).
// Serve a trovare con precisione dove viene disegnata ogni immagine, per poterla
// eliminare o sostituire senza toccare nient'altro.

export type Matrix = [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Prima `a`, poi `b` (convenzione PDF: punto × a × b). */
export function concat(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

export function apply(m: Matrix, x: number, y: number): [number, number] {
  return [x * m[0] + y * m[2] + m[4], x * m[1] + y * m[3] + m[5]];
}

type TokenKind = 'num' | 'name' | 'str' | 'hex' | 'open' | 'close' | 'dopen' | 'dclose' | 'op' | 'inline';

export interface Token {
  kind: TokenKind;
  text: string;
  start: number;
  end: number;
}

const isWS = (c: number) => c === 0 || c === 9 || c === 10 || c === 12 || c === 13 || c === 32;
const DELIMS = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]); // ()<>[]{}/%
const isDelim = (c: number) => DELIMS.has(c);
const NUM_RE = /^[+-]?(\d+\.?\d*|\.\d+)$/;

function latin1(b: Uint8Array, s: number, e: number): string {
  let out = '';
  for (let i = s; i < e; i++) out += String.fromCharCode(b[i]);
  return out;
}

/** Suddivide il contenuto in elementi. I dati binari delle immagini in linea sono saltati. */
export function* tokenize(b: Uint8Array): Generator<Token> {
  const n = b.length;
  let i = 0;
  while (i < n) {
    const c = b[i];
    if (isWS(c)) {
      i++;
      continue;
    }
    if (c === 0x25) {
      // commento fino a fine riga
      while (i < n && b[i] !== 10 && b[i] !== 13) i++;
      continue;
    }
    const start = i;
    if (c === 0x28) {
      let depth = 1;
      i++;
      while (i < n && depth > 0) {
        const ch = b[i];
        if (ch === 0x5c) i += 2;
        else {
          if (ch === 0x28) depth++;
          else if (ch === 0x29) depth--;
          i++;
        }
      }
      yield { kind: 'str', text: '', start, end: i };
    } else if (c === 0x3c) {
      if (b[i + 1] === 0x3c) {
        i += 2;
        yield { kind: 'dopen', text: '<<', start, end: i };
      } else {
        i++;
        while (i < n && b[i] !== 0x3e) i++;
        i++;
        yield { kind: 'hex', text: '', start, end: i };
      }
    } else if (c === 0x3e && b[i + 1] === 0x3e) {
      i += 2;
      yield { kind: 'dclose', text: '>>', start, end: i };
    } else if (c === 0x5b) {
      i++;
      yield { kind: 'open', text: '[', start, end: i };
    } else if (c === 0x5d) {
      i++;
      yield { kind: 'close', text: ']', start, end: i };
    } else if (c === 0x2f) {
      i++;
      while (i < n && !isWS(b[i]) && !isDelim(b[i])) i++;
      yield { kind: 'name', text: latin1(b, start + 1, i), start, end: i };
    } else {
      while (i < n && !isWS(b[i]) && !isDelim(b[i])) i++;
      if (i === start) i++; // carattere isolato non valido: lo si salta
      const text = latin1(b, start, i);
      if (NUM_RE.test(text)) {
        yield { kind: 'num', text, start, end: i };
      } else if (text === 'ID') {
        // Dati dell'immagine in linea: un carattere di spazio, poi byte grezzi fino a "EI".
        let j = i + 1;
        while (j < n - 1) {
          if (b[j] === 0x45 && b[j + 1] === 0x49 && isWS(b[j - 1]) && (j + 2 >= n || isWS(b[j + 2]) || isDelim(b[j + 2]))) break;
          j++;
        }
        i = Math.min(n, j + 2);
        yield { kind: 'inline', text: 'EI', start, end: i };
      } else {
        yield { kind: 'op', text, start, end: i };
      }
    }
  }
}

export interface DrawCall {
  /** Immagine o modulo disegnato con "/Nome Do", oppure immagine in linea (BI … EI). */
  kind: 'xobject' | 'inline';
  name?: string;
  /** Posizione nel contenuto: da qui a `end` si trova l'istruzione completa. */
  start: number;
  end: number;
  /** Trasformazione attiva al momento del disegno. */
  ctm: Matrix;
}

/** Elenca le istruzioni che disegnano immagini o moduli, con la trasformazione attiva. */
export function findDrawCalls(content: Uint8Array, initial: Matrix = IDENTITY): DrawCall[] {
  const calls: DrawCall[] = [];
  const stack: Matrix[] = [];
  let ctm = initial;
  let operands: Token[] = [];
  let biStart = -1;

  for (const tok of tokenize(content)) {
    if (tok.kind === 'inline') {
      if (biStart >= 0) calls.push({ kind: 'inline', start: biStart, end: tok.end, ctm });
      biStart = -1;
      operands = [];
      continue;
    }
    if (tok.kind !== 'op') {
      operands.push(tok);
      continue;
    }
    switch (tok.text) {
      case 'q':
        stack.push(ctm);
        break;
      case 'Q':
        if (stack.length) ctm = stack.pop()!;
        break;
      case 'cm': {
        const nums = operands.filter((o) => o.kind === 'num').slice(-6).map((o) => Number(o.text));
        if (nums.length === 6) ctm = concat(nums as Matrix, ctm);
        break;
      }
      case 'Do': {
        const name = operands.filter((o) => o.kind === 'name').at(-1);
        if (name) calls.push({ kind: 'xobject', name: name.text, start: name.start, end: tok.end, ctm });
        break;
      }
      case 'BI':
        biStart = tok.start;
        break;
    }
    operands = [];
  }
  return calls;
}
