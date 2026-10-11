<script lang="ts">
  import { t } from '../i18n.svelte';
  import type { ImageInfo } from '../pdf/imageEdit';
  import Icon from './Icon.svelte';

  type Fit = 'contain' | 'fill';

  let {
    image,
    state,
    fit = 'contain',
    addedUrl,
    pageUrl,
    pageWidth,
    pageHeight,
    busy = false,
    onreplace,
    ondelete,
    onrestore,
    onfit,
    onclose,
  }: {
    /** Immagine esistente selezionata (assente per quelle aggiunte). */
    image: ImageInfo | null;
    state: 'original' | 'deleted' | 'replaced' | 'added';
    fit?: Fit;
    addedUrl?: string;
    pageUrl: string;
    pageWidth: number;
    pageHeight: number;
    busy?: boolean;
    onreplace: () => void;
    ondelete: () => void;
    onrestore: () => void;
    onfit: (fit: Fit) => void;
    onclose: () => void;
  } = $props();

  // Ritaglio dell'immagine dalla pagina mostrata, per riconoscerla a colpo d'occhio.
  const crop = $derived.by(() => {
    if (!image) return '';
    const [x0, y0, x1, y1] = image.bbox;
    const bw = Math.max(1, x1 - x0);
    const bh = Math.max(1, y1 - y0);
    const px = pageWidth - bw > 0.5 ? (x0 / (pageWidth - bw)) * 100 : 0;
    const py = pageHeight - bh > 0.5 ? (y0 / (pageHeight - bh)) * 100 : 0;
    return `background-image:url(${pageUrl});background-size:${(pageWidth / bw) * 100}% ${(pageHeight / bh) * 100}%;background-position:${px}% ${py}%;aspect-ratio:${bw} / ${bh}`;
  });
</script>

<div class="panel card" role="dialog" aria-labelledby="image-panel-title">
  <div class="panel-head">
    <h3 id="image-panel-title">{state === 'added' ? t('image.panelTitleNew') : t('image.panelTitle')}</h3>
    <button class="icon-btn" onclick={onclose} aria-label={t('edit.close')}><Icon name="x" size={18} /></button>
  </div>

  <div class="preview">
    {#if state === 'added' && addedUrl}
      <img src={addedUrl} alt="" />
    {:else if image}
      <div class="crop" class:deleted={state === 'deleted'} style={crop}></div>
    {/if}
  </div>

  {#if image}
    <p class="meta">{image.width > 0 ? t('image.size', { w: image.width, h: image.height }) : t('image.inlineInfo')}</p>
  {/if}

  {#if state === 'deleted'}
    <p class="status warn-del"><Icon name="trash" size={15} />{t('image.willDelete')}</p>
  {:else if state === 'replaced'}
    <p class="status"><Icon name="circleCheck" size={15} />{t('image.willReplace')}</p>
  {:else if state === 'added'}
    <p class="hint"><Icon name="info" size={15} />{t('image.moveHint')}</p>
  {/if}

  {#if state === 'replaced'}
    <p class="small-label">{t('image.fit')}</p>
    <div class="seg" role="group" aria-label={t('image.fit')}>
      <button class:on={fit === 'contain'} aria-pressed={fit === 'contain'} onclick={() => onfit('contain')}>{t('image.fitContain')}</button>
      <button class:on={fit === 'fill'} aria-pressed={fit === 'fill'} onclick={() => onfit('fill')}>{t('image.fitFill')}</button>
    </div>
  {/if}

  <div class="actions">
    {#if state !== 'added'}
      <button class="btn btn-primary" onclick={onreplace} disabled={busy}>
        <Icon name="photo" size={16} />
        {busy ? t('image.preparing') : state === 'replaced' ? t('image.replaceAgain') : t('image.replace')}
      </button>
    {/if}
    {#if state !== 'deleted'}
      <button class="btn" onclick={ondelete}><Icon name="trash" size={16} />{t('image.delete')}</button>
    {/if}
    {#if state === 'deleted' || state === 'replaced'}
      <button class="btn btn-ghost" onclick={onrestore}><Icon name="refresh" size={16} />{t('image.restore')}</button>
    {/if}
  </div>
</div>

<style>
  .panel {
    padding: 14px;
    box-shadow: var(--shadow-lift);
  }
  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .panel-head h3 {
    font-size: 15px;
    font-weight: 700;
  }
  .icon-btn {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--r-sm);
    background: none;
    color: var(--ink-3);
    cursor: pointer;
  }
  .icon-btn:hover {
    background: var(--surface-2);
    color: var(--ink);
  }
  .preview {
    display: grid;
    place-items: center;
    padding: 10px;
    border-radius: var(--r);
    background: var(--surface-2);
    border: 1px solid var(--line);
  }
  .preview img,
  .crop {
    max-width: 100%;
    max-height: 150px;
    border-radius: 2px;
  }
  .crop {
    width: 100%;
    max-width: 240px;
    background-repeat: no-repeat;
    background-color: #fff;
  }
  .crop.deleted {
    opacity: 0.35;
  }
  .meta {
    margin-top: 8px;
    font-size: 12px;
    color: var(--ink-3);
    text-align: center;
  }
  .status,
  .hint {
    display: flex;
    gap: 6px;
    align-items: flex-start;
    margin-top: 10px;
    padding: 8px 10px;
    border-radius: var(--r);
    font-size: 12px;
    line-height: 1.45;
    background: var(--mint-soft);
    color: var(--ink);
  }
  .status :global(svg) {
    color: var(--mint);
    flex: none;
    margin-top: 1px;
  }
  .warn-del {
    background: var(--danger-soft);
  }
  .warn-del :global(svg) {
    color: var(--danger);
  }
  .hint {
    background: var(--violet-soft);
  }
  .hint :global(svg) {
    color: var(--violet);
    flex: none;
    margin-top: 1px;
  }
  .small-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-2);
    margin: 12px 0 6px;
  }
  .seg {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border: 1px solid var(--line-strong);
    border-radius: var(--r);
    overflow: hidden;
  }
  .seg button {
    border: 0;
    border-right: 1px solid var(--line);
    background: var(--surface);
    padding: 8px 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-2);
    cursor: pointer;
  }
  .seg button:last-child {
    border-right: 0;
  }
  .seg button.on {
    background: var(--violet);
    color: #fff;
  }
  .actions {
    display: grid;
    gap: 8px;
    margin-top: 14px;
  }
  /* Su telefono il pannello sale dal basso (la posizione la gestisce lo strumento). */
  @media (max-width: 700px) {
    .panel {
      max-height: 52dvh;
      overflow-y: auto;
      border-radius: var(--r-xl) var(--r-xl) var(--r-lg) var(--r-lg);
    }
    .preview img,
    .crop {
      max-height: 90px;
    }
  }
</style>
