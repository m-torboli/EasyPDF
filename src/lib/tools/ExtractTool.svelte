<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import DropZone from '../components/DropZone.svelte';
  import FileBar from '../components/FileBar.svelte';
  import Icon from '../components/Icon.svelte';
  import PagePreview from '../components/PagePreview.svelte';
  import ResultDialog from '../components/ResultDialog.svelte';
  import StepTitle from '../components/StepTitle.svelte';
  import Thumb from '../components/Thumb.svelte';
  import { baseName, errorText, loadPdf, unloadPdf, type BuiltPdf, type LoadedPdf } from '../files';
  import { i18n, t } from '../i18n.svelte';
  import { formatPageRanges, parsePageRanges, rangesForFilename, type RangeError } from '../pageRanges';
  import { build } from '../pdf/client';
  import { moveItem, sortable } from '../sortable';
  import { launchFiles, notify, router } from '../state.svelte';

  let pdf = $state<LoadedPdf | null>(null);
  let opening = $state(false);
  let building = $state(false);
  let order = $state<number[]>([]);
  let rotations = $state<number[]>([]);
  const selected = new SvelteSet<number>();
  let rangeText = $state('');
  let rangeError = $state<RangeError | null>(null);
  let showValidation = $state(false);
  let lastClicked: number | null = null;
  let result = $state<BuiltPdf | null>(null);
  let previewIndex = $state<number | null>(null);

  // Selezione a rettangolo (mouse e trackpad): coordinate relative all'area delle miniature.
  let zone = $state<HTMLDivElement>();
  let marquee = $state<{ left: number; top: number; width: number; height: number; remove: boolean } | null>(null);
  const hits = new SvelteSet<number>();

  const picks = $derived(order.filter((i) => selected.has(i)).map((i) => ({ index: i, rotate: rotations[i] })));
  const orderChanged = $derived(order.some((v, i) => v !== i));

  const selectedLabel = $derived(
    selected.size === 0
      ? t('extract.selectedNone')
      : selected.size === 1
        ? t('extract.selectedOne')
        : t('extract.selectedCount', { n: selected.size }),
  );

  const rangeErrorText = $derived.by(() => {
    const e = rangeError;
    if (!e) return '';
    return t(`range.${e.code}`, { token: e.token, page: e.page ?? '', max: e.max ?? '', suggestion: e.suggestion ?? '' });
  });

  const blocker = $derived(rangeError ? t('save.fixErrors') : picks.length === 0 ? t('save.needPages') : '');

  async function open(files: File[]) {
    if (!files.length || opening) return;
    opening = true;
    try {
      const loaded = await loadPdf(files[0]);
      if (!loaded) return;
      if (pdf) unloadPdf(pdf);
      pdf = loaded;
      order = Array.from({ length: loaded.pageCount }, (_, i) => i);
      rotations = new Array(loaded.pageCount).fill(0);
      selected.clear();
      rangeText = '';
      rangeError = null;
      showValidation = false;
      lastClicked = null;
    } catch (e) {
      notify('error', errorText(e));
    } finally {
      opening = false;
    }
  }

  // File aperti con "Apri con EasyPDF" dal sistema.
  $effect(() => {
    if (router.route === 'extract' && launchFiles.files.length === 1) {
      const files = launchFiles.files;
      launchFiles.files = [];
      open(files);
    }
  });

  function syncText() {
    rangeText = formatPageRanges([...selected].map((i) => i + 1));
    rangeError = null;
  }

  function toggle(index: number, e: MouseEvent) {
    if (e.shiftKey && lastClicked !== null) {
      // Maiuscole + clic: seleziona tutte le pagine comprese, nell'ordine mostrato.
      const a = order.indexOf(lastClicked);
      const b = order.indexOf(index);
      for (const i of order.slice(Math.min(a, b), Math.max(a, b) + 1)) selected.add(i);
    } else if (selected.has(index)) {
      selected.delete(index);
    } else {
      selected.add(index);
    }
    lastClicked = index;
    syncText();
  }

  function togglePage(index: number) {
    if (selected.has(index)) selected.delete(index);
    else selected.add(index);
    lastClicked = index;
    syncText();
  }

  function closePreview() {
    const index = previewIndex;
    previewIndex = null;
    // Il focus torna sulla miniatura da cui si era partiti.
    if (index !== null) zone?.querySelector<HTMLElement>(`li[data-index="${index}"] .select`)?.focus();
  }

  function startMarquee(ev: PointerEvent) {
    // Solo mouse e trackpad: col dito trascinare serve a scorrere la pagina.
    if (ev.pointerType === 'touch' || ev.button !== 0 || !zone) return;
    if ((ev.target as HTMLElement).closest('.page, button, input, a')) return;
    ev.preventDefault();

    const doc = (x: number, y: number) => [x + window.scrollX, y + window.scrollY] as const;
    const zr = zone.getBoundingClientRect();
    const [zoneX, zoneY] = doc(zr.left, zr.top);
    const [startX, startY] = doc(ev.clientX, ev.clientY);
    const items = [...zone.querySelectorAll<HTMLElement>('li[data-index]')].map((el) => {
      const r = el.getBoundingClientRect();
      const [x0, y0] = doc(r.left, r.top);
      return { index: Number(el.dataset.index), x0, y0, x1: x0 + r.width, y1: y0 + r.height };
    });
    let client = { x: ev.clientX, y: ev.clientY };
    let remove = ev.altKey;
    let moved = false;
    let frame = 0;

    const update = () => {
      const [cx, cy] = doc(client.x, client.y);
      if (!moved && Math.hypot(cx - startX, cy - startY) < 5) return;
      moved = true;
      const x0 = Math.min(startX, cx);
      const y0 = Math.min(startY, cy);
      const x1 = Math.max(startX, cx);
      const y1 = Math.max(startY, cy);
      hits.clear();
      for (const it of items) if (it.x0 < x1 && it.x1 > x0 && it.y0 < y1 && it.y1 > y0) hits.add(it.index);
      marquee = { left: x0 - zoneX, top: y0 - zoneY, width: x1 - x0, height: y1 - y0, remove };
    };
    // Vicino ai bordi della finestra la pagina scorre da sola, per selezionare anche ciò che non si vede.
    const autoscroll = () => {
      const edge = 70;
      const bottom = window.innerHeight - 120; // sopra la barra delle azioni
      const dy = client.y < edge ? -(edge - client.y) / 3 : client.y > bottom ? (client.y - bottom) / 3 : 0;
      if (dy && moved) {
        window.scrollBy(0, Math.max(-25, Math.min(25, dy)));
        update();
      }
      frame = requestAnimationFrame(autoscroll);
    };
    const move = (e: PointerEvent) => {
      client = { x: e.clientX, y: e.clientY };
      remove = e.altKey;
      update();
    };
    const end = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (moved) {
        for (const i of hits) {
          if (remove) selected.delete(i);
          else selected.add(i);
        }
        lastClicked = null;
        syncText();
      }
      hits.clear();
      marquee = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    frame = requestAnimationFrame(autoscroll);
  }

  function onRangeInput() {
    if (!pdf) return;
    const r = parsePageRanges(rangeText, pdf.pageCount);
    if (r.ok) {
      selected.clear();
      for (const p of r.pages) selected.add(p - 1);
      rangeError = null;
    } else {
      rangeError = r.error;
    }
  }

  function selectAll() {
    order.forEach((i) => selected.add(i));
    syncText();
  }

  function selectNone() {
    selected.clear();
    syncText();
  }

  function rotate(index: number, delta: number) {
    rotations[index] = (rotations[index] + delta + 360) % 360;
  }

  function rotateSelected(delta: number) {
    for (const i of selected) rotate(i, delta);
  }

  async function create() {
    showValidation = true;
    if (!pdf || blocker) return;
    building = true;
    try {
      const bytes = await build([{ fileId: pdf.id, pages: picks }]);
      const word = i18n.lang === 'it' ? 'pagine' : 'pages';
      const filename = `${baseName(pdf.name)}_${word}_${rangesForFilename(picks.map((p) => p.index + 1))}.pdf`;
      result = { bytes, filename, pages: picks.length };
      showValidation = false;
    } catch (e) {
      notify('error', errorText(e));
    } finally {
      building = false;
    }
  }

  function newJob() {
    result = null;
    if (pdf) unloadPdf(pdf);
    pdf = null;
    selected.clear();
    rangeText = '';
  }
</script>

{#if !pdf}
  <section class="card section">
    <StepTitle n={1} title={t('step.load')} />
    <DropZone busy={opening} onfiles={open} />
  </section>
{:else}
  <FileBar {pdf} busy={opening} onchange={open} />

  <section class="card section">
    <StepTitle n={2} title={t('step.pick')} done={picks.length > 0 && !rangeError}>
      {#snippet aside()}
        <button class="btn btn-ghost btn-sm" onclick={selectAll}><Icon name="squareCheck" size={16} /><span class="hide-sm">{t('extract.selectAll')}</span><span class="show-sm">{t('extract.selectAllShort')}</span></button>
        <button class="btn btn-ghost btn-sm" onclick={selectNone}><Icon name="square" size={16} /><span class="hide-sm">{t('extract.selectNone')}</span><span class="show-sm">{t('extract.selectNoneShort')}</span></button>
      {/snippet}
    </StepTitle>

    <div class="range">
      <label class="field-label" for="range-input">{t('extract.orTypePages')}</label>
      <input
        id="range-input"
        class="input range-input"
        inputmode="text"
        autocomplete="off"
        spellcheck="false"
        placeholder={t('extract.placeholder')}
        bind:value={rangeText}
        oninput={onRangeInput}
        onblur={() => {
          if (!rangeError) syncText();
        }}
        aria-invalid={rangeError !== null}
        aria-describedby="range-help"
      />
      <div id="range-help" class="legend" aria-live="polite">
        {#if rangeError}
          <p class="msg msg-error"><Icon name="alert" size={16} />{rangeErrorText}</p>
        {:else}
          <span><b>1-3</b> = {t('extract.legendRange')}</span>
          <span><b>5, 8</b> = {t('extract.legendList')}</span>
          <span><b>8-</b> = {t('extract.legendOpen')}</span>
        {/if}
      </div>
    </div>

    <div class="grid-head">
      <div class="hints">
        <p class="hint"><Icon name="info" size={15} />{t('extract.clickHint')}</p>
        <p class="hint desktop-only"><Icon name="zoomIn" size={15} />{t('extract.marqueeHint')}</p>
      </div>
      <div class="grid-tools">
        {#if selected.size > 0}
          <button class="btn btn-ghost btn-sm" onclick={() => rotateSelected(-90)} title={t('extract.rotateLeft')}>
            <Icon name="rotateLeft" size={16} />{t('extract.rotateSelected')}
          </button>
          <button class="btn btn-ghost btn-sm" onclick={() => rotateSelected(90)} aria-label={t('extract.rotateRight')} title={t('extract.rotateRight')}>
            <Icon name="rotateRight" size={16} />
          </button>
        {/if}
        {#if orderChanged}
          <button class="btn btn-ghost btn-sm" onclick={() => (order = order.slice().sort((a, b) => a - b))}>
            <Icon name="refresh" size={16} />{t('extract.resetOrder')}
          </button>
        {/if}
      </div>
    </div>
    {#if orderChanged}
      <p class="msg msg-info order-note"><Icon name="info" size={16} />{t('extract.orderChanged')}</p>
    {/if}

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="zone" class:dragging={marquee !== null} bind:this={zone} onpointerdown={startMarquee}>
    <ul class="grid" use:sortable={{ onSort: (from, to) => (order = moveItem(order, from, to)), filter: '.tools, .zoom' }}>
      {#each order as index (index)}
        {@const isSel = selected.has(index)}
        <li class="page" class:selected={isSel} class:hit={hits.has(index) && !marquee?.remove} class:hit-remove={hits.has(index) && marquee?.remove} data-index={index}>
          <button
            type="button"
            class="select"
            aria-pressed={isSel}
            aria-label={t('extract.selectPage', { n: index + 1 })}
            onclick={(e) => toggle(index, e)}
            ondblclick={() => (previewIndex = index)}
            onkeydown={(e) => {
              if (e.key === ' ') {
                e.preventDefault();
                previewIndex = index;
              }
            }}
          >
            <Thumb fileId={pdf.id} {index} width={150} rotation={rotations[index]} aspect={pdf.firstAspect} />
            <span class="check" aria-hidden="true"><Icon name="check" size={13} stroke={3} /></span>
          </button>
          <button type="button" class="zoom" onclick={() => (previewIndex = index)} aria-label={t('preview.open', { n: index + 1 })} title={t('preview.open', { n: index + 1 })}>
            <Icon name="zoomIn" size={16} />
          </button>
          <div class="tools">
            <button type="button" class="tool" onclick={() => rotate(index, -90)} aria-label="{t('extract.rotateLeft')} · {t('extract.pageLabel', { n: index + 1 })}" title={t('extract.rotateLeft')}>
              <Icon name="rotateLeft" size={15} />
            </button>
            <span class="num">{index + 1}</span>
            <button type="button" class="tool" onclick={() => rotate(index, 90)} aria-label="{t('extract.rotateRight')} · {t('extract.pageLabel', { n: index + 1 })}" title={t('extract.rotateRight')}>
              <Icon name="rotateRight" size={15} />
            </button>
          </div>
        </li>
      {/each}
    </ul>
    {#if marquee}
      <div class="marquee" class:remove={marquee.remove} style:left="{marquee.left}px" style:top="{marquee.top}px" style:width="{marquee.width}px" style:height="{marquee.height}px"></div>
    {/if}
    </div>
  </section>

  <PagePreview
    fileId={pdf.id}
    {order}
    current={previewIndex}
    {rotations}
    {selected}
    ontoggle={togglePage}
    onnavigate={(i) => (previewIndex = i)}
    onclose={closePreview}
  />

  <div class="actionbar-space"></div>
  <div class="actionbar">
    <div class="wrap actionbar-inner">
      <span class="num-badge" aria-hidden="true">3</span>
      <div class="status" aria-live="polite">
        {#if showValidation && blocker}
          <p class="msg msg-error"><Icon name="alert" size={16} />{blocker}</p>
        {:else if picks.length > 0}
          <p class="msg msg-ok"><Icon name="circleCheck" size={16} />{selectedLabel}</p>
          <p class="sub">{t('app.copyNote')}</p>
        {:else}
          <p class="msg msg-info">{selectedLabel}</p>
        {/if}
      </div>
      <button class="btn btn-primary btn-lg" onclick={create} aria-disabled={!!blocker || building}>
        <Icon name="sparkles" />
        {building ? t('save.working') : t('save.create')}
      </button>
    </div>
  </div>
{/if}

<ResultDialog {result} onclose={() => (result = null)} onnew={newJob} />

<style>
  .section {
    padding: 20px;
  }
  @media (max-width: 560px) {
    .section {
      padding: 16px 14px;
    }
    .select {
      padding: 8px 8px 2px;
    }
    .tool {
      width: 26px;
    }
  }
  .range {
    margin-bottom: 18px;
  }
  .range-input {
    max-width: 520px;
    font-size: 17px;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin-top: 8px;
    font-size: 13px;
    color: var(--ink-2);
    min-height: 20px;
  }
  .legend b {
    color: var(--violet);
    font-weight: 600;
  }

  .grid-head {
    min-height: 51px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
    margin-bottom: 10px;
  }
  .hint {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--ink-2);
  }
  .hint :global(svg) {
    flex: none;
    color: var(--violet);
  }
  .grid-tools {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .hints {
    display: grid;
    gap: 4px;
  }
  .desktop-only {
    display: none;
  }
  @media (hover: hover) and (pointer: fine) {
    .desktop-only {
      display: flex;
    }
  }
  .zone {
    position: relative;
    margin: -10px;
    padding: 10px;
  }
  .zone.dragging {
    user-select: none;
    -webkit-user-select: none;
    cursor: crosshair;
  }
  .marquee {
    position: absolute;
    z-index: 5;
    border: 1.5px solid var(--violet);
    border-radius: 3px;
    background: color-mix(in srgb, var(--violet) 12%, transparent);
    pointer-events: none;
  }
  .marquee.remove {
    border-color: var(--danger);
    background: color-mix(in srgb, var(--danger) 10%, transparent);
  }
  .page.hit {
    box-shadow: 0 0 0 2px var(--violet);
  }
  .page.hit-remove {
    box-shadow: 0 0 0 2px var(--danger);
    opacity: 0.75;
  }
  .zoom {
    position: absolute;
    top: 6px;
    left: 6px;
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    color: var(--ink-2);
    cursor: zoom-in;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .page:hover .zoom,
  .zoom:focus-visible {
    opacity: 1;
  }
  .zoom:hover {
    color: var(--violet);
    border-color: var(--violet);
  }
  @media (hover: none) {
    .zoom {
      opacity: 1;
      top: 4px;
      left: 4px;
      width: 26px;
      height: 26px;
    }
  }
  .order-note {
    margin-bottom: 10px;
  }

  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 10px;
  }
  @media (min-width: 720px) {
    .grid {
      grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
      gap: 16px;
    }
  }
  .page {
    position: relative;
    border-radius: var(--r);
    border: 1.5px solid var(--violet-line);
    background: var(--surface);
    transition:
      border-color 0.15s,
      background 0.15s,
      box-shadow 0.15s;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
  }
  .page:hover {
    border-color: var(--line-strong);
  }
  .page.selected {
    border-color: var(--violet);
    background: var(--violet-soft);
  }
  .select {
    display: block;
    width: 100%;
    padding: 10px 10px 4px;
    border: 0;
    background: none;
    cursor: pointer;
    border-radius: var(--r) var(--r) 0 0;
  }
  .check {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    border-radius: 6px;
    background: var(--surface);
    border: 1.5px solid var(--violet-line);
    color: transparent;
    transition: all 0.15s;
  }
  .selected .check {
    background: var(--violet);
    border-color: var(--violet);
    color: #fff;
  }
  .tools {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px 4px;
  }
  .num {
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-2);
  }
  .selected .num {
    color: var(--violet);
  }
  .tool {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--r-sm);
    background: none;
    color: var(--ink-3);
    cursor: pointer;
  }
  .tool:hover {
    background: var(--surface-2);
    color: var(--ink);
  }
  .show-sm {
    display: none;
  }
  @media (max-width: 560px) {
    .hide-sm {
      display: none;
    }
    .show-sm {
      display: inline;
    }
  }
</style>
