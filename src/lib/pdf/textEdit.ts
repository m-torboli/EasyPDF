// Modifica del testo nei PDF con MuPDF.
// Strategia: il testo originale viene rimosso davvero (redazione del solo testo, non delle
// immagini né della grafica) e il testo nuovo viene scritto con un carattere standard simile,
// nella stessa posizione, dimensione e colore, andando a capo nella larghezza originale.
import * as mupdf from 'mupdf';

export type Rect = [number, number, number, number];
export type RGB = [number, number, number];
export type FontFamily = 'serif' | 'sans' | 'mono';
export type Align = 'left' | 'center' | 'right';

export interface TextStyle {
  family: FontFamily;
  bold: boolean;
  italic: boolean;
  size: number;
  color: RGB;
}

/** Spazio libero attorno a un paragrafo, utilizzabile se il testo nuovo è più lungo. */
export interface Room {
  left: number;
  right: number;
  bottom: number;
}

export interface TextBlockInfo {
  id: number;
  bbox: Rect;
  room: Room;
  lines: Rect[];
  text: string;
  style: TextStyle;
  fontName: string;
  align: Align;
  lineHeight: number;
  firstBaseline: number;
  mixed: boolean;
}

export interface PageTextInfo {
  width: number;
  height: number;
  blocks: TextBlockInfo[];
  /** Pagina senza testo ma con immagini: probabilmente una scansione. */
  scanned: boolean;
}

export type TextEdit =
  | {
      kind: 'replace';
      block: Pick<TextBlockInfo, 'bbox' | 'room' | 'lines' | 'align' | 'lineHeight' | 'firstBaseline' | 'style'>;
      text: string;
      style: TextStyle;
      /** true se l'utente ha cambiato la dimensione: niente adattamento automatico. */
      sizeLocked: boolean;
    }
  | {
      kind: 'add';
      x: number;
      y: number;
      width: number;
      text: string;
      style: TextStyle;
    };

export interface EditReport {
  /** Fattore di riduzione applicato per far stare il testo (1 = nessuna riduzione). */
  scale: number;
  /** Il testo esce dallo spazio originale anche dopo la riduzione massima. */
  overflow: boolean;
  /** Caratteri che il carattere scelto non sa disegnare (sono stati omessi). */
  missing: string[];
  /** Area occupata dal testo scritto, in coordinate della pagina. */
  bbox: Rect | null;
}

export const MIN_SCALE = 0.75;

// --- Lettura dei paragrafi ---------------------------------------------------

const MONO_RE = /courier|mono|consol|menlo|typewriter/i;
const SERIF_RE = /times|serif|georgia|garamond|roman|minion|cambria|book|palatino|baskerville|caslon|didot|bodoni|century|cmr|tinos|liberationserif/i;
const BOLD_RE = /bold|black|heavy|semibold|demi|,b$/i;
const ITALIC_RE = /italic|oblique|,i$/i;

function classifyFont(font: mupdf.Font): { family: FontFamily; bold: boolean; italic: boolean; name: string } {
  const name = font.getName().replace(/^[A-Z]{6}\+/, ''); // via il prefisso dei sottoinsiemi (ABCDEF+)
  const family: FontFamily =
    font.isMono() || MONO_RE.test(name) ? 'mono' : /sans/i.test(name) ? 'sans' : font.isSerif() || SERIF_RE.test(name) ? 'serif' : 'sans';
  return { family, bold: font.isBold() || BOLD_RE.test(name), italic: font.isItalic() || ITALIC_RE.test(name), name };
}

function toRGB(color: number[] | undefined): RGB {
  if (!color || color.length === 0) return [0, 0, 0];
  if (color.length === 1) return [color[0], color[0], color[0]];
  if (color.length === 4) {
    const [c, m, y, k] = color;
    return [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)];
  }
  return [color[0], color[1], color[2]];
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const median = (xs: number[]) => {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

type StyleCounts = Map<string, { count: number; style: TextStyle; name: string }>;

interface RawLine {
  bbox: Rect;
  text: string;
  baseline: number;
  styles: StyleCounts;
  lastRight: number;
  pendingSpace: string;
}

/** Elenca i paragrafi modificabili di una pagina (solo il contenuto, non le annotazioni). */
export function getPageText(doc: mupdf.PDFDocument, index: number): PageTextInfo {
  const page = doc.loadPage(index);
  const bounds = page.getBounds();
  const list = page.toDisplayList(false);
  const stext = list.toStructuredText('preserve-ligatures,preserve-images');

  const blocks: TextBlockInfo[] = [];
  let imageArea = 0;
  let lines: RawLine[] = [];
  let segments: RawLine[] = [];
  let lineBox: Rect = [0, 0, 0, 0];
  let horizontal = true;
  let blockOk = true;

  stext.walk({
    onImageBlock(bbox) {
      imageArea += Math.max(0, bbox[2] - bbox[0]) * Math.max(0, bbox[3] - bbox[1]);
    },
    beginTextBlock() {
      lines = [];
      blockOk = true;
    },
    beginLine(bbox, _wmode, dir) {
      lineBox = bbox as Rect;
      segments = [];
      horizontal = Math.abs(dir[0] - 1) < 0.01 && Math.abs(dir[1]) < 0.01;
      if (!horizontal) blockOk = false;
    },
    onChar(c, origin, font, size, quad, color) {
      if (!horizontal) return;
      const cx0 = Math.min(quad[0], quad[4]);
      const cx1 = Math.max(quad[2], quad[6]);
      let seg = segments.at(-1);
      if (c.trim() === '') {
        if (seg) seg.pendingSpace += c;
        return;
      }
      // Un salto orizzontale ampio sulla stessa riga separa testi distinti
      // (per esempio due firme affiancate o le colonne di una tabella).
      if (!seg || cx0 - seg.lastRight > Math.max(size * 1.8, 12)) {
        seg = { bbox: [cx0, lineBox[1], cx1, lineBox[3]], text: '', baseline: origin[1], styles: new Map(), lastRight: cx1, pendingSpace: '' };
        segments.push(seg);
      } else {
        seg.text += seg.pendingSpace;
      }
      seg.pendingSpace = '';
      seg.text += c;
      seg.lastRight = cx1;
      seg.bbox[0] = Math.min(seg.bbox[0], cx0);
      seg.bbox[2] = Math.max(seg.bbox[2], cx1);

      const f = classifyFont(font);
      const rgb = toRGB(color as number[]).map((v) => round(v, 3)) as RGB;
      const key = `${f.name}|${round(size, 1)}|${rgb.join(',')}`;
      const entry = seg.styles.get(key);
      if (entry) entry.count++;
      else seg.styles.set(key, { count: 1, name: f.name, style: { family: f.family, bold: f.bold, italic: f.italic, size: round(size, 2), color: rgb } });
    },
    endLine() {
      lines.push(...segments);
      segments = [];
    },
    endTextBlock() {
      if (!blockOk) return;
      for (const cluster of clusterLines(lines)) blocks.push(makeBlock(cluster, blocks.length));
    },
  });
  stext.destroy();
  list.destroy();

  const width = bounds[2] - bounds[0];
  const height = bounds[3] - bounds[1];
  computeRoom(blocks, width, height);
  return { width, height, blocks, scanned: blocks.length === 0 && imageArea > width * height * 0.3 };
}

// Raggruppa le righe che si sovrappongono in orizzontale: testi affiancati diventano
// paragrafi separati, righe una sotto l'altra restano nello stesso paragrafo.
function clusterLines(lines: RawLine[]): RawLine[][] {
  const clusters: { x0: number; x1: number; lines: RawLine[] }[] = [];
  for (const l of lines) {
    const hits = clusters.filter((c) => l.bbox[0] < c.x1 - 1 && c.x0 < l.bbox[2] - 1);
    if (hits.length === 0) {
      clusters.push({ x0: l.bbox[0], x1: l.bbox[2], lines: [l] });
      continue;
    }
    const target = hits[0];
    for (const other of hits.slice(1)) {
      target.lines.push(...other.lines);
      target.x0 = Math.min(target.x0, other.x0);
      target.x1 = Math.max(target.x1, other.x1);
      clusters.splice(clusters.indexOf(other), 1);
    }
    target.lines.push(l);
    target.x0 = Math.min(target.x0, l.bbox[0]);
    target.x1 = Math.max(target.x1, l.bbox[2]);
  }
  return clusters.map((c) => c.lines.sort((a, b) => a.baseline - b.baseline));
}

function makeBlock(lines: RawLine[], id: number): TextBlockInfo {
  const styles: StyleCounts = new Map();
  for (const l of lines) {
    for (const [k, v] of l.styles) {
      const e = styles.get(k);
      if (e) e.count += v.count;
      else styles.set(k, { ...v });
    }
  }
  const ranked = [...styles.values()].sort((a, b) => b.count - a.count);
  const total = ranked.reduce((s, r) => s + r.count, 0);
  const main = ranked[0];
  const mixed = ranked.length > 1 && main.count < total;

  const baselines = lines.map((l) => l.baseline);
  const gaps = baselines.slice(1).map((b, i) => b - baselines[i]).filter((g) => g > 0);
  const lineHeight = gaps.length ? median(gaps) : main.style.size * 1.2;

  const bbox: Rect = [
    Math.min(...lines.map((l) => l.bbox[0])),
    Math.min(...lines.map((l) => l.bbox[1])),
    Math.max(...lines.map((l) => l.bbox[2])),
    Math.max(...lines.map((l) => l.bbox[3])),
  ];
  const x0s = lines.map((l) => l.bbox[0]);
  const x1s = lines.map((l) => l.bbox[2]);
  const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
  let align: Align = 'left';
  if (lines.length > 1 && spread(x0s) > 2) {
    if (spread(x1s) <= 2) align = 'right';
    else if (spread(lines.map((l) => (l.bbox[0] + l.bbox[2]) / 2)) <= 3) align = 'center';
  }

  return {
    id,
    bbox: bbox.map((v) => round(v)) as Rect,
    room: { left: 0, right: 0, bottom: 0 },
    lines: lines.map((l) => l.bbox.map((v) => round(v)) as Rect),
    text: joinLines(lines, bbox),
    style: main.style,
    fontName: main.name,
    align,
    lineHeight: round(lineHeight),
    firstBaseline: round(baselines[0]),
    mixed,
  };
}

// Unisce le righe di un paragrafo: le righe piene si uniscono con uno spazio (il testo
// andrà a capo da solo), quelle che finiscono molto prima del margine sono a capo voluti.
function joinLines(lines: RawLine[], bbox: Rect): string {
  const width = bbox[2] - bbox[0];
  let out = '';
  lines.forEach((l, i) => {
    const text = l.text.trim();
    if (i === 0) {
      out = text;
      return;
    }
    const prev = lines[i - 1];
    const prevFull = prev.bbox[2] - bbox[0] >= width * 0.8;
    if (!prevFull) out += '\n' + text;
    else if (/[a-zà-ÿ]-$/i.test(out) && /^[a-zà-ÿ]/.test(text)) out = out.slice(0, -1) + text;
    else out += ' ' + text;
  });
  return out;
}

// Calcola fin dove ogni paragrafo può allargarsi senza invadere gli altri: a destra e a
// sinistra fino al testo vicino o al margine della pagina, in basso fino al paragrafo
// successivo lasciando comunque uno stacco visibile.
function computeRoom(blocks: TextBlockInfo[], width: number, height: number) {
  if (blocks.length === 0) return;
  const marginL = Math.max(18, Math.min(...blocks.map((b) => b.bbox[0])));
  const marginR = Math.max(18, width - Math.max(...blocks.map((b) => b.bbox[2])));
  const marginB = Math.max(18, height - Math.max(...blocks.map((b) => b.bbox[3])));
  const overlapsV = (a: Rect, b: Rect) => a[1] < b[3] - 1 && b[1] < a[3] - 1;
  const overlapsH = (a: Rect, b: Rect) => a[0] < b[2] - 1 && b[0] < a[2] - 1;

  for (const b of blocks) {
    const [x0, , x1, y1] = b.bbox;
    let right = Math.max(x1, width - Math.min(marginL, marginR));
    let left = Math.min(x0, Math.min(marginL, marginR));
    let bottom = Math.max(y1, height - marginB);
    for (const o of blocks) {
      if (o === b) continue;
      if (overlapsV(b.bbox, o.bbox)) {
        if (o.bbox[0] >= x1 - 1) right = Math.min(right, o.bbox[0] - 8);
        if (o.bbox[2] <= x0 + 1) left = Math.max(left, o.bbox[2] + 8);
      }
      if (o.bbox[1] >= y1 - 1 && overlapsH([left, 0, right, 0], [o.bbox[0], 0, o.bbox[2], 0])) {
        const gap = o.bbox[1] - y1;
        bottom = Math.min(bottom, y1 + Math.max(0, gap - Math.max(b.lineHeight, gap * 0.5)));
      }
    }
    b.room = { left: round(Math.min(left, x0)), right: round(Math.max(right, x1)), bottom: round(Math.max(bottom, y1)) };
  }
}

// --- Caratteri standard ------------------------------------------------------

export function standardFontName(s: Pick<TextStyle, 'family' | 'bold' | 'italic'>): string {
  const base = { serif: 'Times', sans: 'Helvetica', mono: 'Courier' }[s.family];
  if (s.family === 'serif') {
    if (s.bold && s.italic) return 'Times-BoldItalic';
    if (s.bold) return 'Times-Bold';
    if (s.italic) return 'Times-Italic';
    return 'Times-Roman';
  }
  const suffix = s.bold && s.italic ? '-BoldOblique' : s.bold ? '-Bold' : s.italic ? '-Oblique' : '';
  return base + suffix;
}

const fontCache = new Map<string, mupdf.Font>();
function loadFont(name: string): mupdf.Font {
  let f = fontCache.get(name);
  if (!f) {
    f = new mupdf.Font(name);
    fontCache.set(name, f);
  }
  return f;
}

// --- Impaginazione -------------------------------------------------------------

interface Glyphed {
  gids: number[];
  width: number; // in em
}

function glyphs(font: mupdf.Font, text: string, missing: Set<string>): Glyphed {
  const gids: number[] = [];
  let width = 0;
  for (const ch of text) {
    const gid = font.encodeCharacter(ch.codePointAt(0)!);
    if (gid <= 0 && ch !== ' ') {
      missing.add(ch);
      continue;
    }
    gids.push(gid);
    width += font.advanceGlyph(gid);
  }
  return { gids, width };
}

/** Divide il testo in righe che stanno in `maxWidth` punti. Gli a capo esistenti sono rispettati. */
export function wrapText(font: mupdf.Font, text: string, size: number, maxWidth: number, missing = new Set<string>()): Glyphed[] {
  const out: Glyphed[] = [];
  const measure = (s: string) => glyphs(font, s, missing);
  for (const para of text.split('\n')) {
    const words = para.split(/ +/);
    let current = '';
    for (const word of words) {
      const candidate = current === '' ? word : `${current} ${word}`;
      if (measure(candidate).width * size <= maxWidth || current === '') {
        // Una parola più lunga dell'intera riga viene spezzata a forza.
        if (current === '' && measure(word).width * size > maxWidth) {
          let piece = '';
          for (const ch of word) {
            if (piece && measure(piece + ch).width * size > maxWidth) {
              out.push(measure(piece));
              piece = '';
            }
            piece += ch;
          }
          current = piece;
        } else {
          current = candidate;
        }
      } else {
        out.push(measure(current));
        current = word;
      }
    }
    out.push(measure(current));
  }
  return out;
}

// --- Applicazione delle modifiche ------------------------------------------------

function fontResourceName(fonts: mupdf.PDFObject, fontName: string): string {
  const base = `EPF${fontName.replace(/[^A-Za-z]/g, '')}`;
  let name = base;
  let i = 1;
  while (!fonts.get(name).isNull()) name = `${base}${i++}`;
  return name;
}

function pageFonts(doc: mupdf.PDFDocument, pageObj: mupdf.PDFObject): mupdf.PDFObject {
  let res = pageObj.getInheritable('Resources');
  if (res.isNull()) {
    pageObj.put('Resources', doc.newDictionary());
    res = pageObj.get('Resources');
  }
  let fonts = res.get('Font');
  if (fonts.isNull()) {
    res.put('Font', doc.newDictionary());
    fonts = res.get('Font');
  }
  return fonts;
}

const num = (n: number) => (Math.abs(n) < 1e-6 ? '0' : n.toFixed(3).replace(/\.?0+$/, ''));

/**
 * Applica le modifiche al testo di una pagina. Il documento viene modificato in memoria:
 * va usato su una copia aperta apposta, mai sul file dell'utente.
 */
export function applyTextEdits(doc: mupdf.PDFDocument, index: number, edits: TextEdit[]): EditReport[] {
  if (edits.length === 0) return [];
  const page = doc.loadPage(index);

  // 1. Rimozione vera del testo originale dei paragrafi sostituiti o eliminati.
  let redactions = 0;
  for (const e of edits) {
    if (e.kind !== 'replace') continue;
    for (const r of e.block.lines) {
      const inset = (r[3] - r[1]) * 0.2;
      const annot = page.createAnnotation('Redact');
      annot.setRect([r[0] - 0.5, r[1] + inset, r[2] + 0.5, r[3] - inset]);
      redactions++;
    }
  }
  if (redactions > 0) {
    page.applyRedactions(false, mupdf.PDFPage.REDACT_IMAGE_NONE, mupdf.PDFPage.REDACT_LINE_ART_NONE, mupdf.PDFPage.REDACT_TEXT_REMOVE);
  }

  // 2. Scrittura del testo nuovo, nello spazio di coordinate della pagina visualizzata.
  const pageObj = doc.findPage(index);
  const fonts = pageFonts(doc, pageObj);
  const usedFonts = new Map<string, string>(); // nome carattere -> nome risorsa
  const inv = mupdf.Matrix.invert(doc.loadPage(index).getTransform());
  let ops = `q ${inv.map(num).join(' ')} cm\n`;
  const reports: EditReport[] = [];

  for (const e of edits) {
    const missing = new Set<string>();
    const text = e.text.replace(/\r/g, '').replace(/\t/g, '    ');
    if (text.trim() === '') {
      reports.push({ scale: 1, overflow: false, missing: [], bbox: null });
      continue;
    }
    const fontName = standardFontName(e.style);
    const font = loadFont(fontName);
    let res = usedFonts.get(fontName);
    if (!res) {
      res = fontResourceName(fonts, fontName);
      fonts.put(res, doc.addFont(font));
      usedFonts.set(fontName, res);
    }

    let x0: number, x1: number, top: number, firstBaseline: number, lineHeight: number, align: Align;
    let maxHeight = Infinity;
    let room: Room | null = null;
    let singleLine = false;
    if (e.kind === 'replace') {
      const b = e.block;
      [x0, top, x1] = [b.bbox[0], b.bbox[1], b.bbox[2]];
      maxHeight = b.bbox[3] - b.bbox[1];
      room = b.room;
      singleLine = b.lines.length === 1;
      align = b.align;
      // Interlinea e posizione della prima riga in proporzione alla dimensione scelta.
      const ratio = e.style.size / b.style.size;
      lineHeight = b.lineHeight * ratio;
      firstBaseline = top + (b.firstBaseline - top) * ratio;
    } else {
      [x0, top, x1] = [e.x, e.y, e.x + e.width];
      align = 'left';
      lineHeight = e.style.size * 1.2;
      firstBaseline = top + e.style.size * 0.9;
    }
    let maxWidth = (x1 - x0) * 1.02 + 0.5;
    const fits = (n: number, s: number) => (firstBaseline - top) * s + (n - 1) * lineHeight * s + e.style.size * s * 0.25 <= maxHeight + 1;

    let scale = 1;
    let lines = wrapText(font, text, e.style.size, maxWidth, missing);
    if (room && !fits(lines.length, 1)) {
      // Prima di rimpicciolire si usa lo spazio libero: una riga singola (titolo, data,
      // etichetta) si allarga di lato; ogni paragrafo può scendere nello spazio vuoto sotto.
      if (singleLine) {
        const extra = (room.right - x1) + (x0 - room.left);
        const wanted = Math.min(glyphs(font, text, new Set()).width * e.style.size - (x1 - x0), extra);
        if (wanted > 0) {
          if (align === 'right') x0 = Math.max(room.left, x0 - wanted);
          else if (align === 'center') {
            const half = wanted / 2;
            x0 = Math.max(room.left, x0 - half);
            x1 = Math.min(room.right, x1 + half);
          } else x1 = Math.min(room.right, x1 + wanted);
          // Se a destra non c'è abbastanza spazio, la riga si allarga anche a sinistra.
          const still = glyphs(font, text, new Set()).width * e.style.size - (x1 - x0);
          if (still > 0 && align === 'left' && x1 >= room.right) x0 = Math.max(room.left, x0 - still);
          maxWidth = (x1 - x0) * 1.02 + 0.5;
        }
      }
      maxHeight = Math.max(maxHeight, room.bottom - top);
      lines = wrapText(font, text, e.style.size, maxWidth, missing);
    }
    if (e.kind === 'replace' && !e.sizeLocked) {
      while (!fits(lines.length, scale) && scale > MIN_SCALE + 1e-6) {
        scale = Math.max(MIN_SCALE, round(scale - 0.025, 3));
        lines = wrapText(font, text, e.style.size * scale, maxWidth, missing);
      }
    }
    const overflow = e.kind === 'replace' && !fits(lines.length, scale);
    const size = e.style.size * scale;
    const baseline0 = top + (firstBaseline - top) * scale;
    const lh = lineHeight * scale;

    const [r, g, bl] = e.style.color;
    ops += `BT /${res} ${num(size)} Tf ${num(r)} ${num(g)} ${num(bl)} rg\n`;
    let left = Infinity;
    let right = -Infinity;
    lines.forEach((l, i) => {
      const w = l.width * size;
      const x = align === 'right' ? x1 - w : align === 'center' ? (x0 + x1 - w) / 2 : x0;
      left = Math.min(left, x);
      right = Math.max(right, x + w);
      const hex = l.gids.map((gid) => gid.toString(16).padStart(4, '0')).join('');
      ops += `1 0 0 -1 ${num(x)} ${num(baseline0 + i * lh)} Tm <${hex}> Tj\n`;
    });
    ops += 'ET\n';

    const bottom = baseline0 + (lines.length - 1) * lh + size * 0.25;
    reports.push({
      scale,
      overflow,
      missing: [...missing],
      bbox: [round(left), round(top), round(right), round(bottom)],
    });
  }
  ops += 'Q\n';

  // Il contenuto originale viene racchiuso tra q/Q: eventuali trasformazioni lasciate
  // aperte dal file non spostano il testo nuovo.
  const contents = pageObj.get('Contents');
  const arr = doc.newArray();
  arr.push(doc.addStream('q\n', {}));
  if (contents.isArray()) contents.forEach((c) => arr.push(c));
  else if (!contents.isNull()) arr.push(contents);
  arr.push(doc.addStream(`Q\n${ops}`, {}));
  pageObj.put('Contents', arr);
  return reports;
}
