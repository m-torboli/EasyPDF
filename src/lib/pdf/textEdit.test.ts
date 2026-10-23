import * as mupdf from 'mupdf';
import { describe, expect, it } from 'vitest';
import { openPdf } from './engine';
import { applyTextEdits, getPageText, layoutRuns, standardFontName, type TextBlockInfo, type TextEdit, type TextRun } from './textEdit';

// Pagina di prova: titolo Helvetica-Bold rosso, paragrafo Times di 3 righe, data a destra.
// Il contenuto lascia apposta una trasformazione aperta (q senza Q).
// Con rotate=90 la pagina è ruotata e il contenuto è disegnato in modo da apparire dritto.
function samplePdf(opts: { rotate?: 0 | 90; mixed?: boolean } = {}): Uint8Array {
  const doc = new mupdf.PDFDocument();
  const fT = doc.addSimpleFont(new mupdf.Font('Times-Roman'));
  const fTB = doc.addSimpleFont(new mupdf.Font('Times-Bold'));
  const fH = doc.addSimpleFont(new mupdf.Font('Helvetica-Bold'));
  const res = doc.addObject({ Font: { T: fT, TB: fTB, H: fH } });
  const bianchi = opts.mixed ? '/TB 12 Tf (Bianchi) Tj /T 12 Tf' : '(Bianchi) Tj';
  const body = `BT /H 20 Tf 0.8 0.1 0.1 rg 72 760 Td (Contratto di fornitura) Tj ET
BT /T 12 Tf 0 0 0 rg 72 720 Td 14 TL (Il presente contratto e stipulato tra Mario Rossi e la ditta ) Tj ${bianchi} T* (S.r.l. con sede in Milano, per la fornitura di cento sedie) Tj T* (da ufficio.) Tj ET
BT /T 12 Tf 0 0 0 rg 420 600 Td (Milano, 11 ottobre 2026) Tj ET
BT /T 12 Tf 0 0 0 rg 72 500 Td (Firma del cliente) Tj 260 0 Td (Firma del fornitore) Tj ET
`;
  const rotate = opts.rotate ?? 0;
  const page = doc.addPage([0, 0, 595, 842], rotate, res, '');
  doc.insertPage(-1, page);
  let pre = 'q 1 0 0 1 0 0 cm\n';
  if (rotate) {
    // Il contenuto è scritto come su una pagina dritta alta 842 e poi riportato nello spazio PDF.
    const t = doc.loadPage(0).getTransform();
    const m = mupdf.Matrix.concat([1, 0, 0, -1, 0, 842], mupdf.Matrix.invert(t));
    pre = `q ${m.join(' ')} cm\n`;
  }
  doc.findPage(0).put('Contents', doc.addStream(pre + body, {}));
  return doc.saveToBuffer('').asUint8Array().slice();
}

const textOf = (doc: mupdf.PDFDocument, i = 0) => doc.loadPage(i).toStructuredText('').asText();

function replaceEdit(block: TextBlockInfo, text: string, overrides: Partial<TextBlockInfo['style']> = {}, sizeLocked = false): TextEdit {
  return { kind: 'replace', block, text, style: { ...block.style, ...overrides }, sizeLocked };
}

describe('getPageText', () => {
  it('riconosce paragrafi, stile, colore e allineamento', () => {
    const info = getPageText(openPdf(samplePdf()), 0);
    expect(info.width).toBe(595);
    expect(info.scanned).toBe(false);
    expect(info.blocks.map((b) => b.text)).toEqual([
      'Contratto di fornitura',
      'Il presente contratto e stipulato tra Mario Rossi e la ditta Bianchi S.r.l. con sede in Milano, per la fornitura di cento sedie da ufficio.',
      'Milano, 11 ottobre 2026',
      'Firma del cliente',
      'Firma del fornitore',
    ]);
    const [title, para] = info.blocks;
    expect(title.style).toMatchObject({ family: 'sans', bold: true, italic: false, size: 20 });
    expect(title.style.color[0]).toBeCloseTo(0.8, 2);
    expect(para.style).toMatchObject({ family: 'serif', bold: false, size: 12 });
    expect(para.lines.length).toBe(3);
    expect(para.lineHeight).toBeCloseTo(14, 1);
    expect(para.mixed).toBe(false);
  });

  it('separa i testi affiancati sulla stessa riga', () => {
    const blocks = getPageText(openPdf(samplePdf()), 0).blocks;
    const [a, b] = blocks.slice(-2);
    expect(a.bbox[2]).toBeLessThan(b.bbox[0]);
    expect(Math.abs(a.firstBaseline - b.firstBaseline)).toBeLessThan(0.5);
    // Modificarne uno non tocca l'altro.
    const doc = openPdf(samplePdf());
    const fresh = getPageText(doc, 0).blocks;
    applyTextEdits(doc, 0, [replaceEdit(fresh.at(-2)!, 'Firma di Mario Rossi')]);
    const after = getPageText(doc, 0).blocks.map((x) => x.text);
    expect(after).toContain('Firma di Mario Rossi');
    expect(after).toContain('Firma del fornitore');
  });

  it('riconosce una parola in grassetto dentro un paragrafo normale', () => {
    const para = getPageText(openPdf(samplePdf({ mixed: true })), 0).blocks[1];
    expect(para.style.bold).toBe(false);
    expect(para.runs.filter((r) => r.bold).map((r) => r.text.trim())).toEqual(['Bianchi']);
    expect(para.runs.map((r) => r.text).join('')).toBe(para.text);
    // Grassetto e corsivo si conservano: non è uno stile "misto" da segnalare.
    expect(para.mixed).toBe(false);
  });

  it('segnala come misti caratteri di dimensione diversa nello stesso paragrafo', () => {
    const doc = new mupdf.PDFDocument();
    const res = doc.addObject({ Font: { T: doc.addSimpleFont(new mupdf.Font('Times-Roman')) } });
    doc.insertPage(-1, doc.addPage([0, 0, 595, 842], 0, res, 'BT /T 12 Tf 72 700 Td (Testo normale e ) Tj /T 18 Tf (grande) Tj ET'));
    const info = getPageText(openPdf(doc.saveToBuffer('').asUint8Array().slice()), 0);
    expect(info.blocks[0].mixed).toBe(true);
  });

  it('riconosce le pagine scansionate', () => {
    const doc = new mupdf.PDFDocument();
    const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 100, 100], false);
    pix.clear(200);
    const img = doc.addImage(new mupdf.Image(pix));
    const res = doc.addObject({ XObject: { Im0: img } });
    doc.insertPage(-1, doc.addPage([0, 0, 595, 842], 0, res, 'q 595 0 0 842 0 0 cm /Im0 Do Q'));
    const info = getPageText(openPdf(doc.saveToBuffer('').asUint8Array().slice()), 0);
    expect(info.blocks).toEqual([]);
    expect(info.scanned).toBe(true);
  });
});

describe('applyTextEdits', () => {
  it('mette in grassetto una sola parola del paragrafo', () => {
    const doc = openPdf(samplePdf());
    const [, para] = getPageText(doc, 0).blocks;
    const runs: TextRun[] = [
      { text: 'Il contratto riguarda ', bold: false, italic: false },
      { text: 'cento', bold: true, italic: false },
      { text: ' sedie e un tavolo ', bold: false, italic: false },
      { text: 'in noce', bold: false, italic: true },
      { text: '.', bold: false, italic: false },
    ];
    applyTextEdits(doc, 0, [{ ...replaceEdit(para, runs.map((r) => r.text).join('')), runs }]);
    const saved = openPdf(doc.saveToBuffer('garbage=compact,compress').asUint8Array().slice());
    const edited = getPageText(saved, 0).blocks.find((b) => b.text.startsWith('Il contratto riguarda'))!;
    expect(edited.text).toBe('Il contratto riguarda cento sedie e un tavolo in noce.');
    expect(edited.runs.filter((r) => r.bold).map((r) => r.text.trim())).toEqual(['cento']);
    expect(edited.runs.filter((r) => r.italic).map((r) => r.text.trim())).toEqual(['in noce']);
    expect(edited.style.bold).toBe(false);
  });

  it('modificando un paragrafo conserva le parole già in grassetto', () => {
    const doc = openPdf(samplePdf({ mixed: true }));
    const para = getPageText(doc, 0).blocks[1];
    const runs = para.runs.map((r) => ({ ...r, text: r.text.replace('cento', 'duecento') }));
    applyTextEdits(doc, 0, [{ ...replaceEdit(para, runs.map((r) => r.text).join('')), runs }]);
    const edited = getPageText(doc, 0).blocks.find((b) => b.text.includes('duecento'))!;
    expect(edited.runs.filter((r) => r.bold).map((r) => r.text.trim())).toEqual(['Bianchi']);
  });

  it('sostituisce davvero il testo, lasciando intatti gli altri paragrafi', () => {
    const doc = openPdf(samplePdf());
    const [, para] = getPageText(doc, 0).blocks;
    const [report] = applyTextEdits(doc, 0, [replaceEdit(para, 'Contratto tra Mario Rossi e Verdi S.p.A. per 150 sedie.')]);
    const after = textOf(doc);
    expect(after).toContain('Contratto tra Mario Rossi e Verdi S.p.A. per 150 sedie.');
    expect(after).not.toContain('Bianchi');
    expect(after).not.toContain('cento');
    expect(after).toContain('Contratto di fornitura');
    expect(after).toContain('Milano, 11 ottobre 2026');
    expect(report).toMatchObject({ scale: 1, overflow: false, missing: [] });
    // Il testo nuovo inizia dove iniziava il vecchio.
    expect(report.bbox![0]).toBeCloseTo(para.bbox[0], 0);
  });

  it('il risultato sopravvive al salvataggio e si estrae correttamente (accenti e simboli)', () => {
    const doc = openPdf(samplePdf());
    const [title] = getPageText(doc, 0).blocks;
    applyTextEdits(doc, 0, [replaceEdit(title, 'Più “belle” – 1.000 €')]);
    const saved = new mupdf.PDFDocument(doc.saveToBuffer('garbage=compact,compress').asUint8Array().slice());
    expect(textOf(saved)).toContain('Più “belle” – 1.000 €');
    const again = getPageText(saved, 0).blocks.find((b) => b.text.startsWith('Più'))!;
    expect(again.style).toMatchObject({ family: 'sans', bold: true, size: 20 });
  });

  it('usa lo spazio libero sotto il paragrafo prima di rimpicciolire', () => {
    const doc = openPdf(samplePdf());
    const [, para] = getPageText(doc, 0).blocks;
    expect(para.room.bottom).toBeGreaterThan(para.bbox[3]);
    const longer = para.text + ' Le sedie saranno consegnate entro trenta giorni lavorativi presso la sede principale.';
    const [r] = applyTextEdits(doc, 0, [replaceEdit(para, longer)]);
    expect(r.scale).toBe(1);
    expect(r.bbox![3]).toBeGreaterThan(para.bbox[3]);
    expect(r.bbox![3]).toBeLessThanOrEqual(para.room.bottom + 1.5);
  });

  it('allarga di lato una riga singola invece di rimpicciolirla', () => {
    const doc = openPdf(samplePdf());
    const [title] = getPageText(doc, 0).blocks;
    const [r] = applyTextEdits(doc, 0, [replaceEdit(title, 'Contratto di fornitura 2027')]);
    expect(r.scale).toBe(1);
    expect(r.bbox![0]).toBeCloseTo(title.bbox[0], 0);
    expect(r.bbox![2]).toBeGreaterThan(title.bbox[2]);
    expect(r.bbox![2]).toBeLessThanOrEqual(title.room.right + 1);
  });

  it('rimpicciolisce il testo troppo lungo, fino al 75%', () => {
    const doc = openPdf(samplePdf());
    const [, para] = getPageText(doc, 0).blocks;
    const longer = `${para.text} ${para.text} ${para.text} Clausola aggiuntiva sulla garanzia.`;
    const [r] = applyTextEdits(doc, 0, [replaceEdit(para, longer)]);
    expect(r.scale).toBeLessThan(1);
    expect(r.scale).toBeGreaterThanOrEqual(0.75);
    expect(r.overflow).toBe(false);
    expect(r.bbox![3]).toBeLessThanOrEqual(para.room.bottom + 1.5);
  });

  it('segnala quando il testo non sta nemmeno ridotto', () => {
    const doc = openPdf(samplePdf());
    const [title] = getPageText(doc, 0).blocks;
    const [r] = applyTextEdits(doc, 0, [replaceEdit(title, 'Un titolo molto molto lungo che non potrà mai stare in una sola riga del titolo originale')]);
    expect(r.scale).toBe(0.75);
    expect(r.overflow).toBe(true);
  });

  it('non riduce il testo se l\'utente ha scelto la dimensione', () => {
    const doc = openPdf(samplePdf());
    const [title] = getPageText(doc, 0).blocks;
    const [r] = applyTextEdits(doc, 0, [replaceEdit(title, 'Contratto di fornitura sedie', { size: 24 }, true)]);
    expect(r.scale).toBe(1);
  });

  it('elimina un paragrafo quando il testo è vuoto', () => {
    const doc = openPdf(samplePdf());
    const blocks = getPageText(doc, 0).blocks;
    applyTextEdits(doc, 0, [replaceEdit(blocks[2], '')]);
    expect(textOf(doc)).not.toContain('ottobre');
    expect(textOf(doc)).toContain('Mario Rossi');
  });

  it('aggiunge testo nuovo nel punto scelto', () => {
    const doc = openPdf(samplePdf());
    const [r] = applyTextEdits(doc, 0, [
      { kind: 'add', x: 72, y: 400, width: 300, text: 'Firma: ______', style: { family: 'sans', bold: false, italic: false, size: 12, color: [0, 0, 0] } },
    ]);
    expect(textOf(doc)).toContain('Firma: ______');
    expect(r.bbox![1]).toBe(400);
  });

  it('segnala i caratteri che il carattere scelto non può disegnare', () => {
    const doc = openPdf(samplePdf());
    const [title] = getPageText(doc, 0).blocks;
    const [r] = applyTextEdits(doc, 0, [replaceEdit(title, 'Ciao 你好')]);
    expect(r.missing).toEqual(['你', '好']);
    expect(textOf(doc)).toContain('Ciao');
  });

  it('funziona anche sulle pagine ruotate', () => {
    const doc = openPdf(samplePdf({ rotate: 90 }));
    const info = getPageText(doc, 0);
    expect(info.width).toBe(842);
    expect(info.blocks.length).toBe(5);
    const para = info.blocks[1];
    const [r] = applyTextEdits(doc, 0, [replaceEdit(para, 'Testo nuovo sulla pagina ruotata')]);
    const after = getPageText(doc, 0).blocks.find((b) => b.text === 'Testo nuovo sulla pagina ruotata');
    expect(after).toBeDefined();
    // Il nuovo testo è orizzontale per chi guarda e sta dove stava il paragrafo.
    expect(after!.bbox[0]).toBeCloseTo(para.bbox[0], 0);
    expect(Math.abs(after!.bbox[1] - para.bbox[1])).toBeLessThan(3);
    expect(r.overflow).toBe(false);
  });
});

describe('utilità', () => {
  it('sceglie il carattere standard giusto', () => {
    expect(standardFontName({ family: 'serif', bold: false, italic: false })).toBe('Times-Roman');
    expect(standardFontName({ family: 'serif', bold: true, italic: true })).toBe('Times-BoldItalic');
    expect(standardFontName({ family: 'sans', bold: true, italic: false })).toBe('Helvetica-Bold');
    expect(standardFontName({ family: 'mono', bold: false, italic: true })).toBe('Courier-Oblique');
  });

  it('misura le parole in grassetto con il carattere grassetto', () => {
    const plain = layoutRuns([{ text: 'Contratto', bold: false, italic: false }], 'sans', 12, 1000)[0].width;
    const bold = layoutRuns([{ text: 'Contratto', bold: true, italic: false }], 'sans', 12, 1000)[0].width;
    expect(bold).toBeGreaterThan(plain);
  });

  it('va a capo rispettando larghezza e a capo voluti', () => {
    const lines = layoutRuns([{ text: 'uno due tre quattro cinque\nsei', bold: false, italic: false }], 'sans', 10, 60);
    expect(lines.length).toBeGreaterThan(2);
    for (const l of lines) expect(l.width * 10).toBeLessThanOrEqual(60);
    expect(lines.at(-1)!.glyphs.map((g) => g.ch).join('')).toBe('sei');
  });
});
