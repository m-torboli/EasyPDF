// Preparazione delle immagini scelte dall'utente prima di inserirle nel PDF.
// Il browser decodifica il file (JPG, PNG, HEIC su iPhone, WebP…) e applica la
// rotazione delle foto scattate col telefono; poi l'immagine viene ricodificata in
// JPG (o PNG se ha parti trasparenti), con un limite di dimensione ragionevole.
import { UserError } from './files';
import { t } from './i18n.svelte';
import { putImage } from './pdf/client';

const MAX_SIDE = 3000;

export interface PreparedImage {
  id: string;
  width: number;
  height: number;
  url: string;
}

let counter = 0;

function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  // Controllo a campione: basta per distinguere foto e loghi con sfondo trasparente.
  const data = ctx.getImageData(0, 0, w, h).data;
  const step = Math.max(4, Math.floor(data.length / 4 / 200_000) * 4);
  for (let i = 3; i < data.length; i += step) if (data[i] < 250) return true;
  return false;
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new UserError(t('image.unsupported'));
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const png = hasTransparency(ctx, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, png ? 'image/png' : 'image/jpeg', 0.9));
  if (!blob) throw new UserError(t('image.unsupported'));
  const bytes = await blob.arrayBuffer();
  const id = `img${++counter}`;
  await putImage(id, bytes, w, h);
  return { id, width: w, height: h, url: URL.createObjectURL(blob) };
}
