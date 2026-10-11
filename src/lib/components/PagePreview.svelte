<script lang="ts">
  // Anteprima grande di una pagina, per leggerne il contenuto prima di selezionarla.
  import type { SvelteSet } from 'svelte/reactivity';
  import { t } from '../i18n.svelte';
  import { thumbnail } from '../pdf/client';
  import Dialog from './Dialog.svelte';
  import Icon from './Icon.svelte';

  let {
    fileId,
    order,
    current,
    rotations,
    selected,
    ontoggle,
    onnavigate,
    onclose,
  }: {
    fileId: string;
    /** Pagine nell'ordine mostrato (indici da 0). */
    order: number[];
    /** Pagina aperta, oppure null se l'anteprima è chiusa. */
    current: number | null;
    rotations: number[];
    selected: SvelteSet<number>;
    ontoggle: (index: number) => void;
    onnavigate: (index: number) => void;
    onclose: () => void;
  } = $props();

  let url = $state<string | null>(null);
  let natural = $state<{ w: number; h: number } | null>(null);
  let stageW = $state(0);
  let stageH = $state(0);
  let seq = 0;

  const pos = $derived(current === null ? -1 : order.indexOf(current));
  const rotation = $derived(current === null ? 0 : rotations[current]);
  const isSel = $derived(current !== null && selected.has(current));

  // La pagina viene generata in alta risoluzione solo quando la si apre.
  $effect(() => {
    const index = current;
    const w = Math.max(stageW, stageH);
    if (index === null || w === 0) return;
    const width = Math.min(1800, Math.max(600, Math.round((w * Math.min(2, window.devicePixelRatio || 1)) / 100) * 100));
    const mine = ++seq;
    url = null;
    natural = null;
    thumbnail(fileId, index, width).then((u) => {
      if (mine === seq) url = u;
    });
  });

  // Dimensioni dell'immagine per stare tutta nello spazio, anche se la pagina è ruotata.
  const size = $derived.by(() => {
    if (!natural || stageW === 0 || stageH === 0) return null;
    const rotated = rotation % 180 !== 0;
    const ratio = rotated ? natural.h / natural.w : natural.w / natural.h;
    const vw = Math.min(stageW, stageH * ratio);
    const vh = vw / ratio;
    return rotated ? { w: vh, h: vw } : { w: vw, h: vh };
  });

  function go(delta: number) {
    const next = order[pos + delta];
    if (next !== undefined) onnavigate(next);
  }

  function onkeydown(e: KeyboardEvent) {
    if (current === null) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      go(1);
    } else if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
      // Come in Anteprima di Apple: la barra spaziatrice chiude.
      e.preventDefault();
      onclose();
    }
  }
</script>

<svelte:window {onkeydown} />

<Dialog open={current !== null} {onclose} labelledby="preview-title" wide>
  {#if current !== null}
    <div class="head">
      <h2 id="preview-title">{t('preview.title', { n: current + 1 })}</h2>
      <span class="pos">{t('preview.position', { i: pos + 1, total: order.length })}</span>
      <button class="icon-btn" onclick={onclose} aria-label={t('preview.close')}><Icon name="x" size={20} /></button>
    </div>

    <div class="stage" bind:clientWidth={stageW} bind:clientHeight={stageH}>
      {#if url}
        <img
          src={url}
          alt={t('preview.title', { n: current + 1 })}
          draggable="false"
          onload={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            natural = { w: img.naturalWidth, h: img.naturalHeight };
          }}
          style:width={size ? `${size.w}px` : 'auto'}
          style:height={size ? `${size.h}px` : 'auto'}
          style:visibility={size ? 'visible' : 'hidden'}
          style:transform="translate(-50%, -50%) rotate({rotation}deg)"
        />
      {:else}
        <span class="spinner" aria-hidden="true"></span>
      {/if}
    </div>

    <div class="foot">
      <button class="btn" onclick={() => go(-1)} disabled={pos <= 0} aria-label={t('preview.prev')} title={t('preview.prev')}>
        <Icon name="arrowLeft" size={18} />
      </button>
      <button class="btn btn-lg toggle" class:on={isSel} onclick={() => ontoggle(current!)} aria-pressed={isSel}>
        <Icon name={isSel ? 'squareCheck' : 'square'} size={18} />
        {isSel ? t('preview.unselect') : t('preview.select')}
      </button>
      <button class="btn" onclick={() => go(1)} disabled={pos >= order.length - 1} aria-label={t('preview.next')} title={t('preview.next')}>
        <Icon name="arrowRight" size={18} />
      </button>
    </div>
    <p class="keys">{t('preview.keys')}</p>
  {/if}
</Dialog>

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: -8px 0 12px;
  }
  h2 {
    font-size: 18px;
    font-weight: 700;
  }
  .pos {
    font-size: 13px;
    color: var(--ink-3);
    font-weight: 500;
  }
  .icon-btn {
    margin-left: auto;
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--r);
    background: none;
    color: var(--ink-3);
    cursor: pointer;
  }
  .icon-btn:hover {
    background: var(--surface-2);
    color: var(--ink);
  }
  .stage {
    position: relative;
    height: calc(100dvh - 230px);
    min-height: 260px;
    border-radius: var(--r);
    background: var(--surface-2);
    overflow: hidden;
  }
  .stage img {
    position: absolute;
    left: 50%;
    top: 50%;
    background: var(--thumb-paper);
    box-shadow:
      0 0 0 1px rgb(28 26 46 / 0.08),
      0 6px 24px rgb(28 26 46 / 0.12);
    transition: transform 0.2s ease;
  }
  .spinner {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 28px;
    height: 28px;
    margin: -14px 0 0 -14px;
    border-radius: 50%;
    border: 3px solid var(--violet-line);
    border-top-color: var(--violet);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .foot {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
  }
  .toggle {
    min-width: 230px;
  }
  .toggle.on {
    background: var(--violet);
    border-color: var(--violet);
    color: #fff;
  }
  .keys {
    margin-top: 8px;
    text-align: center;
    font-size: 12px;
    color: var(--ink-3);
  }
  @media (hover: none) {
    .keys {
      display: none;
    }
  }
  @media (max-width: 560px) {
    .stage {
      height: calc(100dvh - 210px);
    }
    .toggle {
      min-width: 0;
      flex: 1;
    }
  }
</style>
