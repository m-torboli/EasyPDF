// Crea alcuni PDF di prova in test-fixtures/ per provare l'app a mano.
// Esecuzione: node scripts/make-fixtures.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as mupdf from 'mupdf';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'test-fixtures');
mkdirSync(out, { recursive: true });

const palette = ['0.93 0.35 0.23', '0.36 0.25 0.84', '0.96 0.71 0.24', '0.09 0.55 0.45'];

function make(name: string, label: string, n: number, opts: { landscapeEvery?: number; password?: string } = {}) {
  const doc = new mupdf.PDFDocument();
  const font = doc.addSimpleFont(new mupdf.Font('Helvetica-Bold'));
  for (let i = 0; i < n; i++) {
    const landscape = opts.landscapeEvery && (i + 1) % opts.landscapeEvery === 0;
    const [w, h] = landscape ? [842, 595] : [595, 842];
    const color = palette[i % palette.length];
    const contents = [
      `q ${color} rg 40 ${h - 140} ${w - 80} 100 re f Q`,
      `BT /F1 40 Tf 1 1 1 rg 70 ${h - 105} Td (${label}) Tj ET`,
      `BT /F1 160 Tf 0.11 0.1 0.18 rg ${w / 2 - 90} ${h / 2 - 60} Td (${i + 1}) Tj ET`,
      `BT /F1 18 Tf 0.35 0.34 0.45 rg 70 60 Td (Pagina ${i + 1} di ${n}) Tj ET`,
    ].join('\n');
    const res = doc.addObject({ Font: { F1: font } });
    doc.insertPage(-1, doc.addPage([0, 0, w, h], 0, res, contents));
  }
  const options = opts.password
    ? `encrypt=aes-256,user-password=${opts.password},owner-password=${opts.password}`
    : 'compress';
  writeFileSync(join(out, name), doc.saveToBuffer(options).asUint8Array());
}

function contract() {
  const doc = new mupdf.PDFDocument();
  const f = {
    T: doc.addSimpleFont(new mupdf.Font('Times-Roman')),
    TB: doc.addSimpleFont(new mupdf.Font('Times-Bold')),
    H: doc.addSimpleFont(new mupdf.Font('Helvetica-Bold')),
    HR: doc.addSimpleFont(new mupdf.Font('Helvetica')),
  };
  const para = (y: number, lines: string[]) =>
    `BT /T 12 Tf 0.1 0.1 0.12 rg 72 ${y} Td 16 TL ${lines.map((l) => `(${l}) Tj T*`).join(' ')} ET`;
  const content = [
    'q 0.93 0.35 0.23 rg 0 812 595 30 re f Q',
    'BT /H 22 Tf 0.75 0.15 0.12 rg 72 760 Td (Contratto di fornitura) Tj ET',
    'BT /HR 11 Tf 0.4 0.4 0.45 rg 72 740 Td (Rif. 2026/118 - Ufficio acquisti) Tj ET',
    para(700, [
      'Il presente contratto viene stipulato tra Mario Rossi, residente in Milano,',
      'e la ditta Bianchi S.r.l., con sede legale in Torino, per la fornitura di',
      'cento sedie da ufficio secondo le specifiche indicate nell\'allegato A.',
    ]),
    'BT /TB 13 Tf 0.1 0.1 0.12 rg 72 630 Td (Art. 1 - Pagamento) Tj ET',
    para(606, [
      'Il pagamento avverra entro trenta giorni dalla consegna, tramite bonifico',
      'bancario sul conto corrente indicato dal fornitore.',
    ]),
    'BT /TB 13 Tf 0.1 0.1 0.12 rg 72 556 Td (Art. 2 - Consegna) Tj ET',
    para(532, ['La consegna avverra presso la sede del cliente entro il 30 novembre 2026.']),
    'BT /T 12 Tf 0.1 0.1 0.12 rg 400 440 Td (Milano, 11 ottobre 2026) Tj ET',
    'BT /T 12 Tf 0.1 0.1 0.12 rg 72 380 Td (Firma del cliente) Tj 260 0 Td (Firma del fornitore) Tj ET',
  ].join('\n');
  const res = doc.addObject({ Font: f });
  doc.insertPage(-1, doc.addPage([0, 0, 595, 842], 0, res, content));
  doc.insertPage(-1, doc.addPage([0, 0, 595, 842], 0, res, para(760, ['Allegato A - Specifiche tecniche delle sedie.', 'Seduta imbottita, braccioli regolabili, ruote piroettanti.'])));
  writeFileSync(join(out, 'contratto-da-modificare.pdf'), doc.saveToBuffer('compress').asUint8Array());
}

function gradient(w: number, h: number, a: number[], b: number[]): mupdf.Pixmap {
  const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, w, h], false);
  const px = pix.getPixels();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = (x + y) / (w + h);
      const i = (y * w + x) * 3;
      for (let c = 0; c < 3; c++) px[i + c] = a[c] + (b[c] - a[c]) * t;
    }
  return pix;
}

function flyer() {
  const doc = new mupdf.PDFDocument();
  const bg = doc.addImage(new mupdf.Image(gradient(60, 80, [255, 248, 236], [250, 225, 205])));
  const logo = doc.addImage(new mupdf.Image(gradient(80, 80, [238, 90, 58], [91, 63, 214])));
  const photo = doc.addImage(new mupdf.Image(gradient(300, 200, [40, 140, 120], [244, 182, 60])));
  const font = doc.addSimpleFont(new mupdf.Font('Helvetica-Bold'));
  const res = doc.addObject({ XObject: { Bg: bg, Logo: logo, Photo: photo }, Font: { F: font } });
  const content = [
    'q 595 0 0 842 0 0 cm /Bg Do Q',
    'q 90 0 0 90 72 700 cm /Logo Do Q',
    'BT /F 30 Tf 0.11 0.1 0.18 rg 190 735 Td (Festa d\'autunno) Tj ET',
    'q 451 0 0 300 72 330 cm /Photo Do Q',
    'BT /F 16 Tf 0.11 0.1 0.18 rg 72 290 Td (Sabato 25 ottobre, piazza centrale) Tj ET',
  ].join('\n');
  doc.insertPage(-1, doc.addPage([0, 0, 595, 842], 0, res, content));
  writeFileSync(join(out, 'volantino-con-immagini.pdf'), doc.saveToBuffer('compress').asUint8Array());
  writeFileSync(join(out, 'nuova-immagine.png'), gradient(240, 120, [91, 63, 214], [30, 200, 160]).asPNG());
}

contract();
flyer();
make('relazione-12-pagine.pdf', 'Relazione', 12, { landscapeEvery: 5 });
make('allegato-3-pagine.pdf', 'Allegato', 3);
make('protetto-password-ciao.pdf', 'Riservato', 2, { password: 'ciao' });
writeFileSync(join(out, 'non-un-pdf.pdf'), 'Questo non è un PDF');
console.log('PDF di prova creati in', out);
