import { createHash } from 'node:crypto';
import * as mupdf from 'mupdf';
import { describe, expect, it } from 'vitest';
import { buildPdf, openPdf, PdfError, renderPage } from './engine';

interface FixtureOptions {
  note?: boolean; // annotazione "Text" sulla prima pagina
  internalLink?: boolean; // link dalla prima pagina all'ultima
  field?: string; // campo modulo di testo sulla prima pagina
  rotateFirst?: number;
}

// Crea un PDF di prova con `n` pagine, ognuna con il testo "<label> <numero>".
function makePdf(n: number, label: string, opts: FixtureOptions = {}): Uint8Array {
  const doc = new mupdf.PDFDocument();
  const font = doc.addSimpleFont(new mupdf.Font('Helvetica'));
  for (let i = 0; i < n; i++) {
    const res = doc.addObject({ Font: { F1: font } });
    const page = doc.addPage([0, 0, 595, 842], i === 0 ? (opts.rotateFirst ?? 0) as 0 : 0, res, `BT /F1 36 Tf 72 700 Td (${label} ${i + 1}) Tj ET`);
    doc.insertPage(-1, page);
  }
  if (opts.note) {
    const a = doc.loadPage(0).createAnnotation('Text');
    a.setContents(`nota ${label}`);
    a.update();
  }
  const first = doc.findPage(0);
  if (opts.internalLink) {
    const link = doc.addObject({
      Type: 'Annot', Subtype: 'Link', Rect: [0, 0, 100, 100],
      Dest: [doc.findPage(n - 1), 'Fit'],
    });
    if (first.get('Annots').isNull()) first.put('Annots', doc.newArray());
    first.get('Annots').push(link);
  }
  if (opts.field) {
    const widget = doc.addObject({
      Type: 'Annot', Subtype: 'Widget', FT: 'Tx', T: doc.newString(opts.field),
      V: doc.newString('valore'), Rect: [72, 600, 300, 630], P: first,
    });
    if (first.get('Annots').isNull()) first.put('Annots', doc.newArray());
    first.get('Annots').push(widget);
    const fields = doc.newArray();
    fields.push(widget);
    doc.getTrailer().get('Root').put('AcroForm', doc.addObject({ Fields: fields }));
  }
  return doc.saveToBuffer('').asUint8Array().slice();
}

const pageTexts = (bytes: Uint8Array) => {
  const doc = openPdf(bytes);
  return Array.from({ length: doc.countPages() }, (_, i) =>
    doc.loadPage(i).toStructuredText('').asText().trim(),
  );
};

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const all = (n: number) => Array.from({ length: n }, (_, index) => ({ index, rotate: 0 }));

describe('openPdf', () => {
  it('riconosce i file che non sono PDF', () => {
    expect(() => openPdf(new TextEncoder().encode('ciao mondo'))).toThrow(PdfError);
    try {
      openPdf(new TextEncoder().encode('ciao mondo'));
    } catch (e) {
      expect((e as PdfError).code).toBe('not_pdf');
    }
  });

  it('gestisce i PDF protetti da password', () => {
    const plain = new mupdf.PDFDocument(makePdf(2, 'P'));
    const locked = plain.saveToBuffer('encrypt=aes-256,user-password=segreta,owner-password=segreta').asUint8Array().slice();
    const code = (fn: () => unknown) => {
      try {
        fn();
        return 'ok';
      } catch (e) {
        return (e as PdfError).code;
      }
    };
    expect(code(() => openPdf(locked))).toBe('needs_password');
    expect(code(() => openPdf(locked, 'sbagliata'))).toBe('wrong_password');
    expect(openPdf(locked, 'segreta').countPages()).toBe(2);
  });
});

describe('estrazione pagine', () => {
  it('tiene solo le pagine scelte, nell\'ordine dato', () => {
    const src = makePdf(5, 'A');
    const out = buildPdf([{ bytes: src, pages: [{ index: 3, rotate: 0 }, { index: 0, rotate: 0 }, { index: 1, rotate: 0 }] }]);
    expect(pageTexts(out)).toEqual(['A 4', 'A 1', 'A 2']);
  });

  it('non modifica mai i byte originali', () => {
    const src = makePdf(4, 'A', { note: true });
    const before = sha(src);
    buildPdf([{ bytes: src, pages: [{ index: 0, rotate: 90 }] }]);
    expect(sha(src)).toBe(before);
  });

  it('ruota le pagine sommando alla rotazione esistente', () => {
    const src = makePdf(2, 'R', { rotateFirst: 90 });
    const out = openPdf(buildPdf([{ bytes: src, pages: [{ index: 0, rotate: 90 }, { index: 1, rotate: -90 }] }]));
    expect(out.findPage(0).get('Rotate').asNumber()).toBe(180);
    expect(out.findPage(1).get('Rotate').asNumber()).toBe(270);
    const b = out.loadPage(1).getBounds();
    expect(b[2] - b[0]).toBeCloseTo(842);
  });

  it('conserva le annotazioni', () => {
    const src = makePdf(3, 'A', { note: true });
    const out = openPdf(buildPdf([{ bytes: src, pages: [{ index: 2, rotate: 0 }, { index: 0, rotate: 0 }] }]));
    const annots = out.loadPage(1).getAnnotations();
    expect(annots.map((a) => a.getContents())).toEqual(['nota A']);
  });
});

describe('unione PDF', () => {
  it('unisce più documenti nell\'ordine dato', () => {
    const a = makePdf(3, 'A');
    const b = makePdf(2, 'B');
    const c = makePdf(1, 'C');
    const out = buildPdf([
      { bytes: b, pages: all(2) },
      { bytes: a, pages: [{ index: 2, rotate: 0 }, { index: 0, rotate: 0 }] },
      { bytes: c, pages: all(1) },
    ]);
    expect(pageTexts(out)).toEqual(['B 1', 'B 2', 'A 3', 'A 1', 'C 1']);
  });

  it('ignora i documenti senza pagine scelte', () => {
    const out = buildPdf([
      { bytes: makePdf(2, 'A'), pages: [] },
      { bytes: makePdf(2, 'B'), pages: [{ index: 1, rotate: 0 }] },
    ]);
    expect(pageTexts(out)).toEqual(['B 2']);
  });

  it('conserva le annotazioni anche dei documenti successivi al primo', () => {
    const out = openPdf(buildPdf([
      { bytes: makePdf(1, 'A'), pages: all(1) },
      { bytes: makePdf(2, 'B', { note: true }), pages: all(2) },
    ]));
    const page = out.loadPage(1);
    expect(page.getAnnotations().map((a) => a.getContents())).toEqual(['nota B']);
    // l'annotazione deve puntare alla nuova pagina
    const annot = out.findPage(1).get('Annots').get(0).resolve();
    expect(annot.get('P').asIndirect()).toBe(out.findPage(1).asIndirect());
  });

  it('conserva i campi dei moduli e li registra nel modulo del nuovo PDF', () => {
    const out = openPdf(buildPdf([
      { bytes: makePdf(1, 'A'), pages: all(1) },
      { bytes: makePdf(1, 'B', { field: 'Nome' }), pages: all(1) },
    ]));
    const widgets = out.loadPage(1).getWidgets();
    expect(widgets.length).toBe(1);
    expect(widgets[0].getValue()).toBe('valore');
    const fields = out.getTrailer().get('Root').get('AcroForm').get('Fields');
    expect(fields.length).toBe(1);
  });

  it('non trascina pagine orfane tramite i link interni', () => {
    const out = buildPdf([
      { bytes: makePdf(1, 'A'), pages: all(1) },
      { bytes: makePdf(30, 'B', { internalLink: true }), pages: [{ index: 0, rotate: 0 }] },
    ]);
    const doc = openPdf(out);
    expect(doc.countPages()).toBe(2);
    let pageObjects = 0;
    for (let i = 1; i < doc.countObjects(); i++) {
      const obj = doc.newIndirect(i).resolve();
      if (obj.isDictionary() && obj.get('Type').asName() === 'Page') pageObjects++;
    }
    expect(pageObjects).toBe(2);
  });

  it('il risultato di un PDF protetto si apre senza password', () => {
    const locked = new mupdf.PDFDocument(makePdf(2, 'L'))
      .saveToBuffer('encrypt=aes-256,user-password=x,owner-password=x').asUint8Array().slice();
    const out = buildPdf([
      { bytes: makePdf(1, 'A'), pages: all(1) },
      { bytes: locked, password: 'x', pages: all(2) },
    ]);
    expect(pageTexts(out)).toEqual(['A 1', 'L 1', 'L 2']);
  });
});

describe('renderPage', () => {
  it('produce un PNG della larghezza richiesta', () => {
    const doc = openPdf(makePdf(1, 'A'));
    const r = renderPage(doc, 0, 200);
    expect(r.width).toBe(200);
    expect(Math.abs(r.height - 283)).toBeLessThanOrEqual(1);
    expect([...r.png.subarray(1, 4)].map((c) => String.fromCharCode(c)).join('')).toBe('PNG');
  });
});
