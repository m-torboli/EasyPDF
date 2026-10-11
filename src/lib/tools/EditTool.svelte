<script lang="ts">
  import { tick } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import DropZone from '../components/DropZone.svelte';
  import FileBar from '../components/FileBar.svelte';
  import Icon from '../components/Icon.svelte';
  import ImagePanel from '../components/ImagePanel.svelte';
  import ResultDialog from '../components/ResultDialog.svelte';
  import StepTitle from '../components/StepTitle.svelte';
  import Thumb from '../components/Thumb.svelte';
  import { baseName, errorText, loadPdf, unloadPdf, type BuiltPdf, type LoadedPdf } from '../files';
  import { i18n, t } from '../i18n.svelte';
  import { prepareImage, type PreparedImage } from '../images';
  import { buildEdited, pageInfo, renderEdited, thumbnail } from '../pdf/client';
  import type { ImageEdit, ImageInfo, Rect } from '../pdf/imageEdit';
  import type { PageEdits, PageInfo } from '../pdf/protocol';
  import type { EditReport, FontFamily, TextBlockInfo, TextEdit, TextStyle } from '../pdf/textEdit';
  import { editMode, notify } from '../state.svelte';

  interface TextEntry {
    key: string;
    kind: 'replace' | 'add';
    blockId?: number;
    text: string;
    style: TextStyle;
    sizeLocked: boolean;
    x?: number;
    y?: number;
    width?: number;
  }

  interface ImageEntry {
    key: string;
    kind: 'imgDelete' | 'imgReplace' | 'imgAdd';
    /** Indice dell'immagine esistente sulla pagina (eliminazione e sostituzione). */
    imageIdx?: number;
    /** Immagine scelta dall'utente (sostituzione e aggiunta). */
    imageId?: string;
    fit?: 'contain' | 'fill';
    rect?: Rect;
  }

  type Entry = TextEntry | ImageEntry;
  const isText = (e: Entry): e is TextEntry => e.kind === 'replace' || e.kind === 'add';

  interface Draft {
    page: number;
    entry: TextEntry;
    isNew: boolean;
  }

  let pdf = $state<LoadedPdf | null>(null);
  let opening = $state(false);
  let building = $state(false);
  let pageIndex = $state(0);
  const infos = new SvelteMap<number, PageInfo>();
  // Modifiche confermate: pagina -> chiave -> modifica.
  let edits = $state<Record<number, Record<string, Entry>>>({});
  let history = $state<{ page: number; key: string; before: Entry | null }[]>([]);
  let draft = $state<Draft | null>(null);
  let adding = $state(false);
  let addCounter = 0;
  let showValidation = $state(false);
  let result = $state<BuiltPdf | null>(null);

  // Immagini
  const prepared = new SvelteMap<string, PreparedImage>();
  let selImage = $state<string | null>(null);
  let placing = $state<PreparedImage | null>(null);
  let preparingImage = $state(false);
  let imageInput = $state<HTMLInputElement>();
  let imagePurpose: 'add' | 'replace' = 'add';
  let drag = $state<{ key: string; rect: Rect } | null>(null);

  const mode = $derived(editMode.mode);

  // Anteprima della pagina corrente.
  let view = $state<{ page: number; url: string; owned: boolean; reports: Record<string, EditReport> } | null>(null);
  let rendering = $state(false);
  let renderSeq = 0;
  let stageWidth = $state(600);
  let textarea = $state<HTMLTextAreaElement>();
  let sheetEl = $state<HTMLDivElement>();

  const info = $derived(infos.get(pageIndex) ?? null);
  const pageEdits = (p: number) => Object.values(edits[p] ?? {});
  const totalEdits = $derived(Object.values(edits).reduce((n, m) => n + Object.keys(m).length, 0));
  const countLabel = $derived(totalEdits === 0 ? t('edit.countNone') : totalEdits === 1 ? t('edit.countOne') : t('edit.count', { n: totalEdits }));
  const draftBlock = $derived(draft?.entry.blockId !== undefined ? (info?.blocks[draft.entry.blockId] ?? null) : null);
  const draftReport = $derived(draft && view?.page === draft.page ? (view.reports[draft.entry.key] ?? null) : null);
  const selEntry = $derived(selImage ? ((edits[pageIndex]?.[selImage] as ImageEntry | undefined) ?? null) : null);
  const selInfo = $derived.by(() => {
    if (!selImage || !info) return null;
    const idx = selImage.startsWith('i') ? Number(selImage.slice(1)) : selEntry?.imageIdx;
    return idx !== undefined ? (info.images[idx] ?? null) : null;
  });

  async function open(files: File[]) {
    if (!files.length || opening) return;
    opening = true;
    try {
      const loaded = await loadPdf(files[0]);
      if (!loaded) return;
      reset();
      pdf = loaded;
      await showPage(0);
    } catch (e) {
      notify('error', errorText(e));
    } finally {
      opening = false;
    }
  }

  function reset() {
    if (pdf) unloadPdf(pdf);
    if (view?.owned) URL.revokeObjectURL(view.url);
    pdf = null;
    view = null;
    infos.clear();
    edits = {};
    history = [];
    draft = null;
    adding = false;
    selImage = null;
    placing = null;
    pageIndex = 0;
    showValidation = false;
  }

  async function showPage(index: number) {
    if (!pdf) return;
    if (draft) commitDraft();
    adding = false;
    placing = null;
    selImage = null;
    pageIndex = index;
    if (!infos.has(index)) {
      try {
        infos.set(index, await pageInfo(pdf.id, index));
      } catch (e) {
        notify('error', errorText(e));
      }
    }
    await render();
  }

  function setMode(m: 'text' | 'images') {
    if (draft) commitDraft();
    adding = false;
    placing = null;
    selImage = null;
    editMode.mode = m;
  }

  // --- Conversione in modifiche per il motore -------------------------------------------

  function toPageEdits(entries: Entry[], page: PageInfo, forPreview: boolean): { edits: PageEdits; textKeys: string[] } {
    const text: TextEdit[] = [];
    const textKeys: string[] = [];
    const images: ImageEdit[] = [];
    for (const e of entries) {
      if (isText(e)) {
        if (e.kind === 'add') {
          if (e.text.trim() === '') continue;
          text.push({ kind: 'add', x: e.x!, y: e.y!, width: e.width!, text: e.text, style: e.style });
        } else {
          const block = page.blocks[e.blockId!];
          if (!block) continue;
          text.push({ kind: 'replace', block, text: e.text, style: e.style, sizeLocked: e.sizeLocked });
        }
        textKeys.push(e.key);
      } else if (e.kind === 'imgAdd') {
        // Durante la modifica le immagini aggiunte sono mostrate sopra la pagina, per
        // poterle spostare con fluidità; nel PDF finale vengono disegnate davvero.
        if (!forPreview) images.push({ kind: 'addImage', rect: e.rect!, imageId: e.imageId! });
      } else {
        const target = page.images[e.imageIdx!];
        if (!target) continue;
        if (e.kind === 'imgDelete') images.push({ kind: 'deleteImage', target });
        else images.push({ kind: 'replaceImage', target, imageId: e.imageId!, fit: e.fit ?? 'contain' });
      }
    }
    return { edits: { text, images }, textKeys };
  }

  /** Modifiche della pagina, inclusa quella di testo in corso nel pannello. */
  function entriesFor(page: number): Entry[] {
    const map = { ...(edits[page] ?? {}) };
    if (draft && draft.page === page) map[draft.entry.key] = draft.entry;
    return Object.values(map);
  }

  // --- Anteprima -------------------------------------------------------------------

  async function render() {
    if (!pdf) return;
    const page = pageIndex;
    const pi = infos.get(page);
    const seq = ++renderSeq;
    const width = Math.min(2000, Math.round((Math.max(320, stageWidth) * Math.min(2, window.devicePixelRatio || 1)) / 50) * 50);
    rendering = true;
    try {
      let next: NonNullable<typeof view>;
      const { edits: pe, textKeys } = pi ? toPageEdits(entriesFor(page), pi, true) : { edits: { text: [], images: [] }, textKeys: [] };
      if (pe.text.length === 0 && pe.images.length === 0) {
        next = { page, url: await thumbnail(pdf.id, page, width), owned: false, reports: {} };
      } else {
        const r = await renderEdited(pdf.id, page, width, pe);
        const reports: Record<string, EditReport> = {};
        textKeys.forEach((k, i) => (reports[k] = r.reports[i]));
        next = { page, url: r.url, owned: true, reports };
      }
      if (seq !== renderSeq) {
        if (next.owned) URL.revokeObjectURL(next.url);
        return;
      }
      if (view?.owned) URL.revokeObjectURL(view.url);
      view = next;
    } catch (e) {
      if (seq === renderSeq) notify('error', errorText(e));
    } finally {
      if (seq === renderSeq) rendering = false;
    }
  }

  let renderTimer: ReturnType<typeof setTimeout> | undefined;
  function scheduleRender(delay = 350) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, delay);
  }

  // Ridisegna quando cambia la larghezza disponibile (rotazione del telefono, finestra).
  let lastWidth = 0;
  $effect(() => {
    const w = stageWidth;
    if (pdf && Math.abs(w - lastWidth) > 80) {
      lastWidth = w;
      scheduleRender(250);
    }
  });

  // --- Modifiche del testo ------------------------------------------------------------

  function selectBlock(block: TextBlockInfo) {
    if (draft?.entry.key === `b${block.id}`) return;
    if (draft) commitDraft();
    const existing = edits[pageIndex]?.[`b${block.id}`] as TextEntry | undefined;
    draft = {
      page: pageIndex,
      isNew: !existing,
      entry: existing
        ? structuredClone($state.snapshot(existing))
        : { key: `b${block.id}`, kind: 'replace', blockId: block.id, text: block.text, style: { ...block.style }, sizeLocked: false },
    };
    focusTextarea();
  }

  function selectAdded(entry: TextEntry) {
    if (draft?.entry.key === entry.key) return;
    if (draft) commitDraft();
    draft = { page: pageIndex, isNew: false, entry: structuredClone($state.snapshot(entry)) };
    focusTextarea();
  }

  function pagePoint(ev: MouseEvent): [number, number] {
    const rect = sheetEl!.getBoundingClientRect();
    return [((ev.clientX - rect.left) / rect.width) * info!.width, ((ev.clientY - rect.top) / rect.height) * info!.height];
  }

  function onSheetClick(ev: MouseEvent) {
    if (!info) return;
    if (placing) placeImage(ev);
    else if (adding) placeText(ev);
  }

  function placeText(ev: MouseEvent) {
    const [x, y] = pagePoint(ev);
    adding = false;
    if (draft) commitDraft();
    draft = {
      page: pageIndex,
      isNew: true,
      entry: {
        key: `a${++addCounter}`,
        kind: 'add',
        text: '',
        style: { family: 'sans', bold: false, italic: false, size: 12, color: [0, 0, 0] },
        sizeLocked: true,
        x,
        y: Math.max(0, y - 8),
        width: Math.max(80, Math.min(320, info!.width - x - 20)),
      },
    };
    focusTextarea();
  }

  async function focusTextarea() {
    await tick();
    const phone = window.innerWidth <= 700;
    textarea?.focus({ preventScroll: phone });
    if (phone) {
      // Il pannello occupa la metà bassa dello schermo: il paragrafo va portato in alto.
      const box = document.querySelector('.tool:not([hidden]) .box.selected');
      if (box) window.scrollBy({ top: box.getBoundingClientRect().top - 120, behavior: 'smooth' });
    }
  }

  function isNoop(e: TextEntry): boolean {
    if (e.kind === 'add') return e.text.trim() === '';
    const block = infos.get(draft?.page ?? pageIndex)?.blocks[e.blockId!];
    return !!block && e.text === block.text && !e.sizeLocked && JSON.stringify(e.style) === JSON.stringify(block.style);
  }

  function setEntry(page: number, key: string, entry: Entry | null) {
    const before = edits[page]?.[key] ?? null;
    const pageMap = { ...(edits[page] ?? {}) };
    if (entry) pageMap[key] = entry;
    else delete pageMap[key];
    edits = { ...edits, [page]: pageMap };
    history = [...history, { page, key, before: before ? ($state.snapshot(before) as Entry) : null }];
  }

  function commitDraft() {
    if (!draft) return;
    const { page, entry } = draft;
    const had = !!edits[page]?.[entry.key];
    const entrySnap = $state.snapshot(entry) as TextEntry;
    if (isNoop(entrySnap)) {
      if (had) setEntry(page, entry.key, null);
    } else {
      setEntry(page, entry.key, entrySnap);
    }
    draft = null;
    scheduleRender(0);
  }

  function cancelDraft() {
    draft = null;
    scheduleRender(0);
  }

  function restoreOriginal() {
    if (!draft) return;
    if (edits[draft.page]?.[draft.entry.key]) setEntry(draft.page, draft.entry.key, null);
    draft = null;
    scheduleRender(0);
  }

  function deleteText() {
    if (!draft) return;
    const { page, entry } = draft;
    if (entry.kind === 'add') {
      if (edits[page]?.[entry.key]) setEntry(page, entry.key, null);
    } else {
      setEntry(page, entry.key, { ...($state.snapshot(entry) as TextEntry), text: '' });
    }
    draft = null;
    scheduleRender(0);
  }

  function undo() {
    if (draft) {
      cancelDraft();
      return;
    }
    const last = history.at(-1);
    if (!last) return;
    history = history.slice(0, -1);
    const pageMap = { ...(edits[last.page] ?? {}) };
    if (last.before) pageMap[last.key] = last.before;
    else delete pageMap[last.key];
    edits = { ...edits, [last.page]: pageMap };
    if (last.page !== pageIndex) showPage(last.page);
    else scheduleRender(0);
  }

  function changeSize(delta: number) {
    if (!draft) return;
    draft.entry.style.size = Math.max(4, Math.min(96, Math.round((draft.entry.style.size + delta) * 2) / 2));
    draft.entry.sizeLocked = true;
    scheduleRender(150);
  }

  function setFamily(f: FontFamily) {
    if (!draft) return;
    draft.entry.style.family = f;
    scheduleRender(0);
  }

  // --- Modifiche delle immagini ------------------------------------------------------

  function selectImage(key: string) {
    if (draft) commitDraft();
    selImage = key;
    if (window.innerWidth <= 700) {
      tick().then(() => {
        const box = document.querySelector('.tool:not([hidden]) .imgbox.selected');
        if (box) window.scrollBy({ top: box.getBoundingClientRect().top - 120, behavior: 'smooth' });
      });
    }
  }

  function chooseImage(purpose: 'add' | 'replace') {
    imagePurpose = purpose;
    imageInput?.click();
  }

  async function onImageFile(file: File | undefined) {
    if (!file) return;
    preparingImage = true;
    try {
      const img = await prepareImage(file);
      prepared.set(img.id, img);
      if (imagePurpose === 'replace' && selImage?.startsWith('i')) {
        const prev = edits[pageIndex]?.[selImage] as ImageEntry | undefined;
        setEntry(pageIndex, selImage, { key: selImage, kind: 'imgReplace', imageIdx: Number(selImage.slice(1)), imageId: img.id, fit: prev?.fit ?? 'contain' });
        scheduleRender(0);
      } else {
        placing = img;
        selImage = null;
      }
    } catch (e) {
      notify('error', errorText(e));
    } finally {
      preparingImage = false;
    }
  }

  function placeImage(ev: MouseEvent) {
    const img = placing!;
    placing = null;
    const [x, y] = pagePoint(ev);
    // Larghezza iniziale: quella naturale dell'immagine (circa 150 dpi), al massimo il 40% della pagina.
    const w = Math.min(info!.width * 0.4, img.width * 0.48);
    const h = (w * img.height) / img.width;
    const x0 = Math.max(0, Math.min(info!.width - w, x - w / 2));
    const y0 = Math.max(0, Math.min(info!.height - h, y - h / 2));
    const key = `n${++addCounter}`;
    setEntry(pageIndex, key, { key, kind: 'imgAdd', imageId: img.id, rect: [x0, y0, x0 + w, y0 + h] });
    selImage = key;
  }

  function deleteImage() {
    if (!selImage) return;
    if (selImage.startsWith('n')) {
      setEntry(pageIndex, selImage, null);
      selImage = null;
    } else {
      setEntry(pageIndex, selImage, { key: selImage, kind: 'imgDelete', imageIdx: Number(selImage.slice(1)) });
    }
    scheduleRender(0);
  }

  function restoreImage() {
    if (!selImage) return;
    setEntry(pageIndex, selImage, null);
    scheduleRender(0);
  }

  function setFit(fit: 'contain' | 'fill') {
    if (!selImage || !selEntry || selEntry.kind !== 'imgReplace') return;
    setEntry(pageIndex, selImage, { ...($state.snapshot(selEntry) as ImageEntry), fit });
    scheduleRender(0);
  }

  // Spostamento e ridimensionamento delle immagini aggiunte (mouse e dito).
  function startDrag(ev: PointerEvent, entry: ImageEntry, resize: boolean) {
    ev.preventDefault();
    ev.stopPropagation();
    if (draft) commitDraft();
    selImage = entry.key;
    const target = ev.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(ev.pointerId);
    } catch {
      // non disponibile: il movimento viene seguito comunque sulla finestra
    }
    const sheet = sheetEl!.getBoundingClientRect();
    const k = info!.width / sheet.width;
    const start = entry.rect!;
    const [sx, sy] = [ev.clientX, ev.clientY];
    const aspect = (start[3] - start[1]) / (start[2] - start[0]);
    let moved = false;

    const move = (e: PointerEvent) => {
      const dx = (e.clientX - sx) * k;
      const dy = (e.clientY - sy) * k;
      if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 3) moved = true;
      let r: Rect;
      if (resize) {
        const w = Math.max(16, Math.min(info!.width - start[0], start[2] - start[0] + dx));
        r = [start[0], start[1], start[0] + w, start[1] + w * aspect];
      } else {
        const w = start[2] - start[0];
        const h = start[3] - start[1];
        const x0 = Math.max(-w / 2, Math.min(info!.width - w / 2, start[0] + dx));
        const y0 = Math.max(-h / 2, Math.min(info!.height - h / 2, start[1] + dy));
        r = [x0, y0, x0 + w, y0 + h];
      }
      drag = { key: entry.key, rect: r };
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (moved && drag) setEntry(pageIndex, entry.key, { ...($state.snapshot(entry) as ImageEntry), rect: drag.rect });
      drag = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  // --- Creazione del PDF ------------------------------------------------------------

  async function create() {
    if (draft) commitDraft();
    showValidation = true;
    if (!pdf || totalEdits === 0) return;
    building = true;
    try {
      const pages: { index: number; edits: PageEdits }[] = [];
      for (const [p, map] of Object.entries(edits)) {
        const index = Number(p);
        let pi = infos.get(index);
        if (!pi) {
          pi = await pageInfo(pdf.id, index);
          infos.set(index, pi);
        }
        const { edits: pe } = toPageEdits(Object.values(map), pi, false);
        if (pe.text.length || pe.images.length) pages.push({ index, edits: pe });
      }
      const bytes = await buildEdited(pdf.id, pages);
      const word = i18n.lang === 'it' ? 'modificato' : 'edited';
      result = { bytes, filename: `${baseName(pdf.name)}_${word}.pdf`, pages: pdf.pageCount };
      showValidation = false;
    } catch (e) {
      notify('error', errorText(e));
    } finally {
      building = false;
    }
  }

  // --- Utilità di visualizzazione -----------------------------------------------------

  function boxStyle(r: Rect, pad = 2) {
    if (!info) return '';
    const [x0, y0, x1, y1] = [r[0] - pad, r[1] - pad, r[2] + pad, r[3] + pad];
    return `left:${(x0 / info.width) * 100}%;top:${(y0 / info.height) * 100}%;width:${((x1 - x0) / info.width) * 100}%;height:${((y1 - y0) / info.height) * 100}%`;
  }

  function addedRect(e: TextEntry): Rect {
    const r = view?.page === pageIndex ? view.reports[e.key]?.bbox : null;
    return r ?? [e.x!, e.y!, e.x! + e.width!, e.y! + e.style.size * 1.4];
  }

  const addedTexts = $derived.by(() => {
    const list = Object.values(edits[pageIndex] ?? {}).filter((e): e is TextEntry => e.kind === 'add');
    if (draft && draft.page === pageIndex && draft.entry.kind === 'add' && !list.some((e) => e.key === draft!.entry.key)) list.push(draft.entry);
    return list;
  });

  const addedImages = $derived(Object.values(edits[pageIndex] ?? {}).filter((e): e is ImageEntry => e.kind === 'imgAdd'));

  const editedKeys = $derived(new Set(Object.keys(edits[pageIndex] ?? {})));

  function imageState(img: ImageInfo): 'original' | 'deleted' | 'replaced' {
    const e = edits[pageIndex]?.[`i${img.id}`];
    return e?.kind === 'imgDelete' ? 'deleted' : e?.kind === 'imgReplace' ? 'replaced' : 'original';
  }

  const colorName = (c: [number, number, number]) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
</script>

{#if !pdf}
  <section class="card section">
    <StepTitle n={1} title={t('step.load')} />
    <DropZone busy={opening} onfiles={open} />
  </section>
{:else}
  <FileBar {pdf} busy={opening} onchange={open} />

  <section class="card section">
    <StepTitle n={2} title={mode === 'text' ? t('step.editPick') : t('step.editPickImages')} done={totalEdits > 0}>
      {#snippet aside()}
        <div class="mode" role="group" aria-label={t('edit.modeLabel')}>
          <button class:on={mode === 'text'} aria-pressed={mode === 'text'} onclick={() => setMode('text')}><Icon name="pencil" size={15} />{t('edit.modeText')}</button>
          <button class:on={mode === 'images'} aria-pressed={mode === 'images'} onclick={() => setMode('images')}><Icon name="photo" size={15} />{t('edit.modeImages')}</button>
        </div>
        {#if mode === 'text'}
          <button class="btn btn-sm" class:active-add={adding} onclick={() => (adding = !adding)} aria-pressed={adding}>
            <Icon name={adding ? 'x' : 'plus'} size={16} />{adding ? t('edit.stopAdd') : t('edit.addText')}
          </button>
        {:else if placing}
          <button class="btn btn-sm active-add" onclick={() => (placing = null)}><Icon name="x" size={16} />{t('image.cancelPlace')}</button>
        {:else}
          <button class="btn btn-sm" onclick={() => chooseImage('add')} disabled={preparingImage}>
            <Icon name="plus" size={16} />{preparingImage ? t('image.preparing') : t('image.add')}
          </button>
        {/if}
        <button class="btn btn-ghost btn-sm" onclick={undo} disabled={!draft && history.length === 0} title={t('edit.undo')} aria-label={t('edit.undo')}>
          <Icon name="rotateLeft" size={16} /><span class="hide-sm">{t('edit.undo')}</span>
        </button>
      {/snippet}
    </StepTitle>
    <input
      bind:this={imageInput}
      type="file"
      accept="image/*"
      hidden
      onchange={(e) => {
        onImageFile(e.currentTarget.files?.[0]);
        e.currentTarget.value = '';
      }}
    />

    <div class="layout">
      <nav class="pages" aria-label={t('edit.pagesLabel')}>
        {#each { length: pdf.pageCount } as _, i}
          {@const n = pageEdits(i).length}
          <button class="page-btn" class:current={i === pageIndex} onclick={() => showPage(i)} aria-current={i === pageIndex ? 'page' : undefined} aria-label={t('extract.pageLabel', { n: i + 1 })}>
            <Thumb fileId={pdf.id} index={i} width={80} aspect={pdf.firstAspect} />
            <span class="page-num">{i + 1}</span>
            {#if n > 0}<span class="page-badge">{n}</span>{/if}
          </button>
        {/each}
      </nav>

      <div class="stage">
        <div class="stage-head">
          <button class="btn btn-ghost btn-sm" onclick={() => showPage(pageIndex - 1)} disabled={pageIndex === 0} aria-label={t('edit.prevPage')}><Icon name="arrowLeft" size={16} /></button>
          <span class="page-of">{t('edit.pageOf', { n: pageIndex + 1, total: pdf.pageCount })}</span>
          <button class="btn btn-ghost btn-sm flip" onclick={() => showPage(pageIndex + 1)} disabled={pageIndex >= pdf.pageCount - 1} aria-label={t('edit.nextPage')}><Icon name="arrowLeft" size={16} /></button>
          {#if rendering}<span class="updating"><span class="spinner"></span>{t('edit.updating')}</span>{/if}
        </div>

        {#if mode === 'text'}
          {#if adding}
            <p class="msg msg-info note add-note"><Icon name="info" size={16} />{t('edit.addHint')}</p>
          {:else if info?.scanned}
            <p class="msg msg-info note"><Icon name="photo" size={16} />{t('edit.scanned')}</p>
          {:else if info && info.blocks.length === 0}
            <p class="msg msg-info note"><Icon name="info" size={16} />{t('edit.noText')}</p>
          {:else}
            <p class="msg msg-info note"><Icon name="pencil" size={16} />{t('edit.hint')}</p>
          {/if}
        {:else if placing}
          <p class="msg msg-info note add-note"><Icon name="info" size={16} />{t('image.placeHint')}</p>
        {:else if info && info.images.length === 0}
          <p class="msg msg-info note"><Icon name="info" size={16} />{t('image.none')}</p>
        {:else}
          <p class="msg msg-info note"><Icon name="photo" size={16} />{t('image.hint')}</p>
        {/if}

        <div class="sheet-wrap" bind:clientWidth={stageWidth}>
          {#if view && info}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div bind:this={sheetEl} class="sheet" class:adding={adding || !!placing} style:aspect-ratio="{info.width} / {info.height}" onclick={onSheetClick}>
              <img src={view.url} alt={t('extract.pageLabel', { n: pageIndex + 1 })} draggable="false" />

              {#if mode === 'text' && !adding}
                {#each info.blocks as block (block.id)}
                  {@const key = `b${block.id}`}
                  <button
                    class="box"
                    class:edited={editedKeys.has(key)}
                    class:selected={draft?.entry.key === key && draft.page === pageIndex}
                    style={boxStyle(block.bbox)}
                    onclick={(e) => {
                      e.stopPropagation();
                      selectBlock(block);
                    }}
                    aria-label={t('edit.blockLabel', { text: block.text.slice(0, 60) })}
                  >
                    {#if draft?.entry.key === key && draft.page === pageIndex}
                      <span class="tag editing">{t('edit.editingBadge')}</span>
                    {:else if editedKeys.has(key)}
                      <span class="tag">{t('edit.editedBadge')}</span>
                    {/if}
                  </button>
                {/each}
                {#each addedTexts as entry (entry.key)}
                  <button
                    class="box added"
                    class:selected={draft?.entry.key === entry.key}
                    style={boxStyle(addedRect(entry))}
                    onclick={(e) => {
                      e.stopPropagation();
                      selectAdded(entry);
                    }}
                    aria-label={t('edit.blockLabel', { text: entry.text.slice(0, 60) })}
                  >
                    <span class="tag" class:editing={draft?.entry.key === entry.key}>{draft?.entry.key === entry.key ? t('edit.editingBadge') : t('edit.editedBadge')}</span>
                  </button>
                {/each}
              {/if}

              {#if mode === 'images' && !placing}
                {#each info.images as img (img.id)}
                  {@const key = `i${img.id}`}
                  {@const st = imageState(img)}
                  <button
                    class="imgbox"
                    class:deleted={st === 'deleted'}
                    class:replaced={st === 'replaced'}
                    class:selected={selImage === key}
                    style={boxStyle(img.bbox, 1)}
                    onclick={(e) => {
                      e.stopPropagation();
                      selectImage(key);
                    }}
                    aria-label={t('image.label', { n: img.id + 1 })}
                  >
                    {#if st === 'deleted'}<span class="tag del">{t('image.deletedBadge')}</span>
                    {:else if st === 'replaced'}<span class="tag">{t('image.replacedBadge')}</span>{/if}
                  </button>
                {/each}
              {/if}

              {#each addedImages as entry (entry.key)}
                {@const r = drag?.key === entry.key ? drag.rect : entry.rect!}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="added-img"
                  class:selected={selImage === entry.key}
                  class:inert={mode !== 'images' || !!placing}
                  style={boxStyle(r, 0)}
                  onpointerdown={(e) => startDrag(e, entry, false)}
                  onclick={(e) => e.stopPropagation()}
                >
                  <img src={prepared.get(entry.imageId!)?.url} alt="" draggable="false" />
                  {#if mode === 'images'}
                    <span class="tag">{t('image.addedBadge')}</span>
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <span class="handle" title={t('image.resize')} onpointerdown={(e) => startDrag(e, entry, true)}></span>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <div class="sheet placeholder" style:aspect-ratio="1 / {pdf.firstAspect}"></div>
          {/if}
        </div>
      </div>

      <aside class="panel-col">
        {#if mode === 'images' && selImage && view && info && (selInfo || selEntry?.kind === 'imgAdd')}
          <ImagePanel
            image={selInfo}
            state={selEntry?.kind === 'imgAdd' ? 'added' : selEntry?.kind === 'imgDelete' ? 'deleted' : selEntry?.kind === 'imgReplace' ? 'replaced' : 'original'}
            fit={selEntry?.fit ?? 'contain'}
            addedUrl={selEntry?.imageId ? prepared.get(selEntry.imageId)?.url : undefined}
            pageUrl={view.url}
            pageWidth={info.width}
            pageHeight={info.height}
            busy={preparingImage}
            onreplace={() => chooseImage('replace')}
            ondelete={deleteImage}
            onrestore={restoreImage}
            onfit={setFit}
            onclose={() => (selImage = null)}
          />
        {:else if mode === 'text' && draft}
          <div class="panel card" role="dialog" aria-labelledby="edit-panel-title">
            <div class="panel-head">
              <h3 id="edit-panel-title">{draft.entry.kind === 'add' ? t('edit.panelTitleNew') : t('edit.panelTitle')}</h3>
              <button class="icon-btn" onclick={cancelDraft} aria-label={t('edit.close')}><Icon name="x" size={18} /></button>
            </div>
            <textarea
              bind:this={textarea}
              bind:value={draft.entry.text}
              oninput={() => scheduleRender()}
              onkeydown={(e) => {
                if (e.key === 'Escape') cancelDraft();
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commitDraft();
              }}
              rows="5"
              placeholder={draft.entry.kind === 'add' ? t('edit.placeholderNew') : ''}
              class="input editor-text"
              class:serif={draft.entry.style.family === 'serif'}
              class:mono={draft.entry.style.family === 'mono'}
              style:font-weight={draft.entry.style.bold ? 700 : 400}
              style:font-style={draft.entry.style.italic ? 'italic' : 'normal'}
              spellcheck="true"
            ></textarea>

            <p class="small-label">{t('edit.appearance')}</p>
            <div class="seg" role="group" aria-label={t('edit.appearance')}>
              {#each ['serif', 'sans', 'mono'] as const as f}
                <button class:on={draft.entry.style.family === f} aria-pressed={draft.entry.style.family === f} onclick={() => setFamily(f)} title={t(`edit.familyHint.${f}`)}>
                  <span class="fam-{f}">{t(`edit.family.${f}`)}</span>
                </button>
              {/each}
            </div>
            <div class="row">
              <button class="toggle" class:on={draft.entry.style.bold} aria-pressed={draft.entry.style.bold} onclick={() => { draft!.entry.style.bold = !draft!.entry.style.bold; scheduleRender(0); }} title={t('edit.bold')} aria-label={t('edit.bold')}><b>{t('edit.boldShort')}</b></button>
              <button class="toggle" class:on={draft.entry.style.italic} aria-pressed={draft.entry.style.italic} onclick={() => { draft!.entry.style.italic = !draft!.entry.style.italic; scheduleRender(0); }} title={t('edit.italic')} aria-label={t('edit.italic')}><i>{t('edit.italicShort')}</i></button>
              <span class="swatch" style:background={colorName(draft.entry.style.color)} aria-hidden="true"></span>
              <div class="size" role="group" aria-label={t('edit.size')}>
                <button onclick={() => changeSize(-0.5)} aria-label={t('edit.smaller')}>−</button>
                <span>{draft.entry.style.size.toLocaleString(i18n.lang === 'it' ? 'it-IT' : 'en-US')} pt</span>
                <button onclick={() => changeSize(0.5)} aria-label={t('edit.larger')}>+</button>
              </div>
            </div>
            {#if draftBlock}
              <p class="hint-line">{t('edit.originalFont', { font: draftBlock.fontName })}</p>
            {/if}

            <div class="warnings" aria-live="polite">
              {#if draftBlock?.mixed}
                <p class="warn"><Icon name="info" size={15} />{t('edit.mixed')}</p>
              {/if}
              {#if draftReport && draftReport.overflow}
                <p class="warn strong"><Icon name="alert" size={15} />{draft.entry.sizeLocked ? t('edit.overflowLocked') : t('edit.overflow')}</p>
              {:else if draftReport && draftReport.scale < 1}
                <p class="warn"><Icon name="info" size={15} />{t('edit.shrunk', { pct: Math.round(draftReport.scale * 100) })}</p>
              {/if}
              {#if draftReport && draftReport.missing.length}
                <p class="warn strong"><Icon name="alert" size={15} />{t('edit.missing', { chars: draftReport.missing.join(' ') })}</p>
              {/if}
            </div>

            <div class="panel-actions">
              <button class="btn" onclick={cancelDraft}><Icon name="x" size={16} />{t('edit.cancel')}</button>
              <button class="btn btn-primary" onclick={commitDraft}><Icon name="check" size={16} />{t('edit.apply')}</button>
            </div>
            <div class="panel-links">
              {#if draft.entry.kind === 'replace' && edits[draft.page]?.[draft.entry.key]}
                <button class="link" onclick={restoreOriginal}><Icon name="refresh" size={14} />{t('edit.restore')}</button>
              {:else}
                <span></span>
              {/if}
              <button class="link danger" onclick={deleteText}><Icon name="trash" size={14} />{t('edit.delete')}</button>
            </div>
          </div>
        {:else}
          <div class="how">
            <p class="how-title"><Icon name="info" size={16} />{t('edit.howTitle')}</p>
            {#if mode === 'text'}
              <ul>
                <li>{t('edit.how1')}</li>
                <li>{t('edit.how2')}</li>
                <li>{t('edit.how3')}</li>
                <li>{t('edit.how4')}</li>
              </ul>
            {:else}
              <ul>
                <li>{t('image.how1')}</li>
                <li>{t('image.how2')}</li>
                <li>{t('image.how3')}</li>
              </ul>
            {/if}
          </div>
        {/if}
      </aside>
    </div>
  </section>

  <div class="actionbar-space"></div>
  <div class="actionbar">
    <div class="wrap actionbar-inner">
      <span class="num-badge" aria-hidden="true">3</span>
      <div class="status" aria-live="polite">
        {#if showValidation && totalEdits === 0}
          <p class="msg msg-error"><Icon name="alert" size={16} />{t('save.needEdits')}</p>
        {:else if totalEdits > 0}
          <p class="msg msg-ok"><Icon name="circleCheck" size={16} />{countLabel}</p>
          <p class="sub">{t('app.copyNote')}</p>
        {:else}
          <p class="msg msg-info">{countLabel}</p>
        {/if}
      </div>
      <button class="btn btn-primary btn-lg" onclick={create} aria-disabled={(totalEdits === 0 && !draft) || building}>
        <Icon name="sparkles" />
        {building ? t('save.working') : t('save.edit')}
      </button>
    </div>
  </div>
{/if}

<ResultDialog {result} onclose={() => (result = null)} onnew={() => { result = null; reset(); }} />

<style>
  .mode {
    display: flex;
    border: 1px solid var(--line-strong);
    border-radius: var(--r);
    overflow: hidden;
  }
  .mode button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 0;
    background: var(--surface);
    padding: 6px 10px;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-2);
    cursor: pointer;
  }
  .mode button + button {
    border-left: 1px solid var(--line);
  }
  .mode button.on {
    background: var(--coral);
    color: var(--on-coral);
  }
  .imgbox {
    position: absolute;
    padding: 0;
    border: 2px dashed color-mix(in srgb, var(--violet) 45%, transparent);
    border-radius: 2px;
    background: transparent;
    cursor: pointer;
  }
  .imgbox:hover,
  .imgbox:focus-visible {
    border-color: var(--violet);
    background: color-mix(in srgb, var(--violet) 8%, transparent);
  }
  .imgbox.replaced {
    border: 2px solid color-mix(in srgb, var(--coral) 80%, transparent);
  }
  .imgbox.deleted {
    border: 2px solid var(--danger);
    background: repeating-linear-gradient(45deg, color-mix(in srgb, var(--danger) 12%, transparent) 0 8px, transparent 8px 16px);
  }
  .imgbox.selected {
    border: 2px solid var(--violet);
    background: color-mix(in srgb, var(--violet) 10%, transparent);
  }
  .tag.del {
    background: var(--danger);
  }
  .added-img {
    position: absolute;
    outline: 2px solid color-mix(in srgb, var(--coral) 80%, transparent);
    cursor: move;
    touch-action: none;
  }
  .added-img.selected {
    outline: 2px solid var(--violet);
  }
  .added-img.inert {
    pointer-events: none;
    outline: none;
  }
  .added-img img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    pointer-events: none;
  }
  .handle {
    position: absolute;
    right: -9px;
    bottom: -9px;
    width: 18px;
    height: 18px;
    border-radius: 5px;
    background: var(--violet);
    border: 2px solid #fff;
    cursor: nwse-resize;
    touch-action: none;
  }
  .section {
    padding: 20px;
  }
  .layout {
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr) 300px;
    gap: 18px;
    align-items: start;
  }

  .pages {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: calc(100dvh - 220px);
    overflow-y: auto;
    position: sticky;
    top: 80px;
    padding: 4px;
  }
  .page-btn {
    position: relative;
    display: block;
    width: 100%;
    padding: 6px 6px 2px;
    border: 1.5px solid var(--violet-line);
    border-radius: var(--r);
    background: var(--surface);
    cursor: pointer;
    flex: none;
  }
  .page-btn.current {
    border-color: var(--coral);
    background: var(--coral-soft);
  }
  .page-num {
    display: block;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-2);
  }
  .page-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: 5px;
    background: var(--coral);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    display: grid;
    place-items: center;
  }

  .stage-head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }
  .flip :global(svg) {
    transform: rotate(180deg);
  }
  .page-of {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-2);
  }
  .updating {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--ink-3);
  }
  .spinner {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--violet-line);
    border-top-color: var(--violet);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .note {
    margin-bottom: 10px;
  }
  .note :global(svg) {
    color: var(--violet);
  }
  .add-note {
    color: var(--violet);
    font-weight: 600;
  }

  .sheet-wrap {
    width: 100%;
  }
  .sheet {
    position: relative;
    width: 100%;
    background: var(--thumb-paper);
    box-shadow:
      0 0 0 1px rgb(28 26 46 / 0.08),
      0 6px 24px rgb(28 26 46 / 0.1);
    border-radius: 3px;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
  }
  .sheet.adding {
    cursor: crosshair;
    outline: 2px dashed var(--violet);
    outline-offset: 4px;
  }
  .sheet.placeholder {
    background: var(--surface-2);
  }
  .sheet img {
    display: block;
    width: 100%;
    height: 100%;
    -webkit-touch-callout: none;
  }
  .box {
    position: absolute;
    padding: 0;
    border: 1.5px dashed transparent;
    border-radius: 3px;
    background: transparent;
    cursor: text;
    transition:
      border-color 0.12s,
      background 0.12s;
  }
  .box:hover,
  .box:focus-visible {
    border-color: color-mix(in srgb, var(--violet) 55%, transparent);
    background: color-mix(in srgb, var(--violet) 5%, transparent);
  }
  .box.edited,
  .box.added {
    border: 1.5px solid color-mix(in srgb, var(--coral) 75%, transparent);
    background: color-mix(in srgb, var(--coral) 5%, transparent);
  }
  .box.selected {
    border: 2px solid var(--violet);
    background: color-mix(in srgb, var(--violet) 7%, transparent);
  }
  .tag {
    position: absolute;
    top: -9px;
    right: 4px;
    padding: 0 6px;
    border-radius: 4px;
    background: var(--coral);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    line-height: 16px;
    white-space: nowrap;
    pointer-events: none;
  }
  .tag.editing {
    background: var(--violet);
  }

  .panel-col {
    position: sticky;
    top: 80px;
  }
  .panel {
    padding: 14px;
    box-shadow: var(--shadow-lift);
  }
  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
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
  .editor-text {
    resize: vertical;
    min-height: 110px;
    line-height: 1.45;
    font-weight: 400;
    font-family: var(--font);
  }
  .editor-text.serif {
    font-family: 'Times New Roman', Times, Georgia, serif;
    font-size: 17px;
  }
  .editor-text.mono {
    font-family: 'Courier New', Courier, monospace;
  }
  .small-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-2);
    margin: 12px 0 6px;
  }
  .seg {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border: 1px solid var(--line-strong);
    border-radius: var(--r);
    overflow: hidden;
  }
  .seg button {
    border: 0;
    border-right: 1px solid var(--line);
    background: var(--surface);
    padding: 7px 4px;
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
  .fam-serif {
    font-family: 'Times New Roman', Times, serif;
    font-size: 14px;
  }
  .fam-mono {
    font-family: 'Courier New', Courier, monospace;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
  }
  .toggle {
    width: 34px;
    height: 34px;
    border: 1px solid var(--line-strong);
    border-radius: var(--r);
    background: var(--surface);
    color: var(--ink);
    font-size: 15px;
    cursor: pointer;
  }
  .toggle.on {
    background: var(--violet);
    border-color: var(--violet);
    color: #fff;
  }
  .swatch {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    margin-left: 2px;
  }
  .size {
    margin-left: auto;
    display: flex;
    align-items: center;
    border: 1px solid var(--line-strong);
    border-radius: var(--r);
    overflow: hidden;
  }
  .size button {
    width: 32px;
    height: 32px;
    border: 0;
    background: var(--surface);
    font-size: 17px;
    cursor: pointer;
    color: var(--ink);
  }
  .size button:hover {
    background: var(--surface-2);
  }
  .size span {
    min-width: 56px;
    text-align: center;
    font-size: 13px;
    font-weight: 600;
  }
  .hint-line {
    font-size: 12px;
    color: var(--ink-3);
    margin-top: 8px;
  }
  .warnings {
    display: grid;
    gap: 6px;
    margin-top: 10px;
  }
  .warn {
    display: flex;
    gap: 6px;
    align-items: flex-start;
    padding: 8px 10px;
    border-radius: var(--r);
    background: color-mix(in srgb, var(--sun) 16%, var(--surface));
    color: var(--ink);
    font-size: 12px;
    line-height: 1.45;
  }
  .warn :global(svg) {
    flex: none;
    margin-top: 1px;
    color: #b07a10;
  }
  .warn.strong {
    background: var(--danger-soft);
  }
  .warn.strong :global(svg) {
    color: var(--danger);
  }
  .panel-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 14px;
  }
  .panel-links {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
  }
  .link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 0;
    background: none;
    padding: 4px 2px;
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-2);
    cursor: pointer;
  }
  .link:hover {
    color: var(--ink);
  }
  .link.danger:hover {
    color: var(--danger);
  }
  .how {
    padding: 14px;
    border-radius: var(--r-lg);
    background: var(--surface-2);
    border: 1px solid var(--line);
  }
  .how-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    font-size: 14px;
    margin-bottom: 6px;
  }
  .how-title :global(svg) {
    color: var(--violet);
  }
  .how ul {
    margin: 0;
    padding-left: 18px;
    font-size: 13px;
    color: var(--ink-2);
    display: grid;
    gap: 6px;
  }
  .active-add {
    background: var(--violet);
    border-color: var(--violet);
    color: #fff;
  }
  .active-add:hover {
    background: var(--violet);
    color: #fff;
  }

  @media (max-width: 1000px) {
    .layout {
      grid-template-columns: 80px minmax(0, 1fr);
    }
    .panel-col {
      grid-column: 1 / -1;
      position: static;
    }
    .how {
      display: none;
    }
  }
  @media (max-width: 700px) {
    .section {
      padding: 16px 12px;
    }
    .layout {
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
    }
    .pages {
      flex-direction: row;
      position: static;
      max-height: none;
      overflow-x: auto;
      padding: 8px 4px;
    }
    .page-btn {
      width: 64px;
    }
    /* Su telefono il pannello sale dal basso, sopra la barra delle azioni. */
    .panel-col:has(:global(.panel)) {
      position: fixed;
      top: auto;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 25;
      padding: 0 8px calc(8px + env(safe-area-inset-bottom));
    }
    .panel {
      max-height: 52dvh;
      overflow-y: auto;
      border-radius: var(--r-xl) var(--r-xl) var(--r-lg) var(--r-lg);
      animation: sheet 0.2s ease-out;
    }
    .editor-text {
      min-height: 72px;
    }
    .actionbar-space {
      height: 55dvh;
    }
    .hide-sm {
      display: none;
    }
  }
  @keyframes sheet {
    from {
      transform: translateY(30px);
      opacity: 0;
    }
  }
</style>
