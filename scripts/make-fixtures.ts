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

make('relazione-12-pagine.pdf', 'Relazione', 12, { landscapeEvery: 5 });
make('allegato-3-pagine.pdf', 'Allegato', 3);
make('protetto-password-ciao.pdf', 'Riservato', 2, { password: 'ciao' });
writeFileSync(join(out, 'non-un-pdf.pdf'), 'Questo non è un PDF');
console.log('PDF di prova creati in', out);
