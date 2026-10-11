import { createHash } from 'node:crypto';
import * as mupdf from 'mupdf';
import { describe, expect, it } from 'vitest';
import { findDrawCalls, tokenize } from './contentStream';
import { openPdf } from './engine';
import { applyImageEdits, getPageImages, type ImageInfo, type StoredImage } from './imageEdit';

function solid(w: number, h: number, rgb: [number, number, number]): mupdf.Pixmap {
  const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, w, h], false);
  const px = pix.getPixels();
  for (let i = 0; i < px.length; i += 3) {
    px[i] = rgb[0];
    px[i + 1] = rgb[1];
    px[i + 2] = rgb[2];
  }
  return pix;
}

const GRAY: [number, number, number] = [200, 200, 200];
const RED: [number, number, number] = [220, 30, 30];
const GREEN: [number, number, number] = [30, 180, 60];
const BLUE: [number, number, number] = [30, 60, 220];

/**
 * Pagina 1: sfondo grigio a tutta pagina, logo rosso 100x100 a (72, 642) nello spazio PDF,
 * testo sopra, un modulo con un'immagine verde, un'immagine in linea.
 * Pagina 2: usa lo stesso modulo con l'immagine verde.
 */
function samplePdf(): Uint8Array {
  const doc = new mupdf.PDFDocument();
  const bg = doc.addImage(new mupdf.Image(solid(10, 10, GRAY)));
  const logo = doc.addImage(new mupdf.Image(solid(20, 20, RED)));
  const green = doc.addImage(new mupdf.Image(solid(10, 10, GREEN)));
  const font = doc.addSimpleFont(new mupdf.Font('Helvetica'));
  const form = doc.addStream('q 80 0 0 40 0 0 cm /G Do Q', {
    Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 80, 40], Resources: { XObject: { G: green } },
  });
  const res = doc.addObject({ XObject: { Bg: bg, Logo: logo, Fm: form }, Font: { F: font } });
  const inline = 'q 30 0 0 30 400 100 cm BI /W 2 /H 2 /CS /G /BPC 8 ID \u0000\u0000\u0000\u0000 EI Q';
  const c1 = [
    'q 595 0 0 842 0 0 cm /Bg Do Q',
    'q 100 0 0 100 72 642 cm /Logo Do Q',
    'BT /F 14 Tf 72 600 Td (Testo della pagina) Tj ET',
    'q 1 0 0 1 300 300 cm /Fm Do Q',
    inline,
  ].join('\n');
  doc.insertPage(-1, doc.addPage([0, 0, 595, 842], 0, res, c1));
  doc.insertPage(-1, doc.addPage([0, 0, 595, 842], 0, res, 'q 1 0 0 1 300 300 cm /Fm Do Q'));
  return doc.saveToBuffer('').asUint8Array().slice();
}

function pngOf(w: number, h: number, rgb: [number, number, number]): StoredImage {
  return { bytes: solid(w, h, rgb).asPNG().slice(), width: w, height: h };
}

/** Colore del pixel nel punto (x, y) della pagina visualizzata. */
function pixel(doc: mupdf.PDFDocument, page: number, x: number, y: number): [number, number, number] {
  const pix = doc.loadPage(page).toPixmap(mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB, false, true);
  const i = (Math.floor(y) * pix.getWidth() + Math.floor(x)) * 3;
  const px = pix.getPixels();
  return [px[i], px[i + 1], px[i + 2]];
}

const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 25);
const find = (imgs: ImageInfo[], x: number, y: number) => imgs.find((i) => i.bbox[0] <= x && x <= i.bbox[2] && i.bbox[1] <= y && y <= i.bbox[3] && i.bbox[2] - i.bbox[0] < 500)!;

describe('lettura del contenuto', () => {
  it('riconosce operatori, stringhe con parentesi e immagini in linea', () => {
    const src = new TextEncoder().encode('q (a (b) \\) c) Tj 1 0 0 1 5 5 cm /Im Do Q BI /W 1 /H 1 ID \u0001 EI % commento\n/X Do');
    const kinds = [...tokenize(src)].map((t) => t.kind);
    expect(kinds).toEqual(['op', 'str', 'op', 'num', 'num', 'num', 'num', 'num', 'num', 'op', 'name', 'op', 'op', 'op', 'name', 'num', 'name', 'num', 'inline', 'name', 'op']);
    const calls = findDrawCalls(src);
    expect(calls.map((c) => c.kind)).toEqual(['xobject', 'inline', 'xobject']);
    expect(calls[0].ctm).toEqual([1, 0, 0, 1, 5, 5]);
    expect(calls[2].ctm).toEqual([1, 0, 0, 1, 0, 0]);
  });
});

describe('getPageImages', () => {
  it('trova tutte le immagini con la loro posizione sulla pagina', () => {
    const imgs = getPageImages(openPdf(samplePdf()), 0);
    expect(imgs.length).toBe(4);
    const logo = find(imgs, 120, 150);
    // Logo a (72, 642)-(172, 742) nello spazio PDF = (72, 100)-(172, 200) sulla pagina visualizzata.
    expect(logo.bbox).toEqual([72, 100, 172, 200]);
    expect(logo.width).toBe(20);
    expect(logo.path.length).toBe(1);
    const inForm = find(imgs, 340, 520);
    expect(inForm.path.length).toBe(2);
    expect(inForm.bbox).toEqual([300, 502, 380, 542]);
    expect(imgs.some((i) => i.width === 0)).toBe(true); // immagine in linea
  });
});

describe('applyImageEdits', () => {
  it('elimina solo l\'immagine scelta: lo sfondo sovrapposto resta', () => {
    const bytes = samplePdf();
    const before = createHash('sha256').update(bytes).digest('hex');
    const doc = openPdf(bytes);
    const logo = find(getPageImages(doc, 0), 120, 150);
    expect(near(pixel(doc, 0, 120, 150), RED)).toBe(true);
    applyImageEdits(doc, 0, [{ kind: 'deleteImage', target: logo }], new Map());
    expect(near(pixel(doc, 0, 120, 150), GRAY)).toBe(true);
    expect(getPageImages(doc, 0).length).toBe(3);
    expect(doc.loadPage(0).toStructuredText('').asText()).toContain('Testo della pagina');
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(before);
  });

  it('sostituisce un\'immagine mantenendo le proporzioni', () => {
    const doc = openPdf(samplePdf());
    const logo = find(getPageImages(doc, 0), 120, 150);
    const store = new Map([['wide', pngOf(40, 20, BLUE)]]);
    applyImageEdits(doc, 0, [{ kind: 'replaceImage', target: logo, imageId: 'wide', fit: 'contain' }], store);
    expect(near(pixel(doc, 0, 122, 150), BLUE)).toBe(true); // centro
    expect(near(pixel(doc, 0, 122, 110), GRAY)).toBe(true); // fascia libera in alto
    // Salvata e riaperta, la pagina resta valida.
    const saved = new mupdf.PDFDocument(doc.saveToBuffer('garbage=compact,compress').asUint8Array().slice());
    expect(near(pixel(saved, 0, 122, 150), BLUE)).toBe(true);
  });

  it('sostituisce un\'immagine riempiendo lo spazio', () => {
    const doc = openPdf(samplePdf());
    const logo = find(getPageImages(doc, 0), 120, 150);
    applyImageEdits(doc, 0, [{ kind: 'replaceImage', target: logo, imageId: 'w', fit: 'fill' }], new Map([['w', pngOf(40, 20, BLUE)]]));
    expect(near(pixel(doc, 0, 122, 110), BLUE)).toBe(true);
  });

  it('modifica un\'immagine dentro un modulo solo sulla pagina scelta', () => {
    const doc = openPdf(samplePdf());
    const inForm = find(getPageImages(doc, 0), 340, 520);
    applyImageEdits(doc, 0, [{ kind: 'deleteImage', target: inForm }], new Map());
    expect(near(pixel(doc, 0, 340, 520), GRAY)).toBe(true);
    expect(near(pixel(doc, 1, 340, 520), GREEN)).toBe(true);
  });

  it('elimina un\'immagine in linea', () => {
    const doc = openPdf(samplePdf());
    const imgs = getPageImages(doc, 0);
    const inline = imgs.find((i) => i.width === 0)!;
    applyImageEdits(doc, 0, [{ kind: 'deleteImage', target: inline }], new Map());
    expect(getPageImages(doc, 0).length).toBe(3);
  });

  it('aggiunge un\'immagine nel rettangolo scelto', () => {
    const doc = openPdf(samplePdf());
    applyImageEdits(doc, 0, [{ kind: 'addImage', rect: [400, 600, 500, 650], imageId: 'n' }], new Map([['n', pngOf(20, 10, BLUE)]]));
    expect(near(pixel(doc, 0, 450, 625), BLUE)).toBe(true);
    expect(near(pixel(doc, 0, 450, 660), GRAY)).toBe(true);
    expect(getPageImages(doc, 0).length).toBe(5);
  });

  it('più modifiche sulla stessa pagina insieme', () => {
    const doc = openPdf(samplePdf());
    const imgs = getPageImages(doc, 0);
    applyImageEdits(
      doc,
      0,
      [
        { kind: 'deleteImage', target: find(imgs, 340, 520) },
        { kind: 'replaceImage', target: find(imgs, 120, 150), imageId: 'b', fit: 'fill' },
        { kind: 'addImage', rect: [400, 600, 500, 650], imageId: 'b' },
      ],
      new Map([['b', pngOf(10, 10, BLUE)]]),
    );
    expect(near(pixel(doc, 0, 340, 520), GRAY)).toBe(true);
    expect(near(pixel(doc, 0, 120, 150), BLUE)).toBe(true);
    expect(near(pixel(doc, 0, 450, 625), BLUE)).toBe(true);
  });
});
