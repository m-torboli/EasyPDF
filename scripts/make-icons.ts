// Genera le icone dell'app (PNG e SVG) in public/ partendo dal disegno in src/lib/brand.ts.
// La conversione SVG -> PNG usa Quick Look (qlmanage), incluso in macOS.
// Esecuzione (solo su Mac): npm run icons
import { execFileSync } from 'node:child_process';
import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pandaFace, pandaFull } from '../src/lib/brand.ts';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const tmp = mkdtempSync(join(tmpdir(), 'easypdf-icons-'));

function png(svg: string, size: number, name: string) {
  const sized = svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
  const src = join(tmp, `${name}.svg`);
  writeFileSync(src, sized);
  execFileSync('qlmanage', ['-t', '-s', String(size), '-o', tmp, src], { stdio: 'ignore' });
  renameSync(`${src}.png`, join(out, `${name}.png`));
}

const face = pandaFace();
const square = pandaFace({ rounded: false }); // iOS e macOS arrotondano gli angoli da soli
const maskable = pandaFace({ rounded: false, scale: 0.78 }); // area sicura per Android

writeFileSync(join(out, 'favicon.svg'), face);
writeFileSync(join(out, 'logo.svg'), pandaFull());
png(face, 192, 'icon-192');
png(face, 512, 'icon-512');
png(maskable, 512, 'icon-maskable-512');
png(square, 180, 'apple-touch-icon');
png(face, 32, 'favicon-32');
rmSync(tmp, { recursive: true });
console.log('Icone generate in', out);
