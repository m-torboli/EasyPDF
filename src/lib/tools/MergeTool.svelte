<script lang="ts">
  import DropZone from '../components/DropZone.svelte';
  import Icon from '../components/Icon.svelte';
  import ResultDialog from '../components/ResultDialog.svelte';
  import StepTitle from '../components/StepTitle.svelte';
  import Thumb from '../components/Thumb.svelte';
  import { baseName, errorText, loadPdf, unloadPdf, type BuiltPdf, type LoadedPdf } from '../files';
  import { formatBytes, i18n, pagesLabel, t } from '../i18n.svelte';
  import { parsePageRanges, type RangeError } from '../pageRanges';
  import { build } from '../pdf/client';
  import { moveItem, sortable } from '../sortable';
  import { launchFiles, notify, router } from '../state.svelte';

  interface MergeItem {
    pdf: LoadedPdf;
    rangeText: string;
    error: RangeError | null;
    pages: number[] | null; // null = tutte le pagine
  }

  let items = $state<MergeItem[]>([]);
  let opening = $state(false);
  let building = $state(false);
  let showValidation = $state(false);
  let result = $state<BuiltPdf | null>(null);

  const totalPages = $derived(items.reduce((sum, it) => sum + (it.pages ? it.pages.length : it.pdf.pageCount), 0));
  const hasErrors = $derived(items.some((it) => it.error));
  const blocker = $derived(
    items.length < 2 ? t('save.needFiles') : hasErrors ? t('save.fixErrors') : totalPages === 0 ? t('save.needPages') : '',
  );

  async function add(files: File[]) {
    if (!files.length || opening) return;
    opening = true;
    try {
      // Uno alla volta, nell'ordine in cui sono stati scelti.
      for (const file of files) {
        try {
          const pdf = await loadPdf(file);
          if (pdf) items.push({ pdf, rangeText: '', error: null, pages: null });
        } catch (e) {
          notify('error', errorText(e));
        }
      }
    } finally {
      opening = false;
    }
  }

  $effect(() => {
    if (router.route === 'merge' && launchFiles.files.length > 1) {
      const files = launchFiles.files;
      launchFiles.files = [];
      add(files);
    }
  });

  function remove(i: number) {
    unloadPdf(items[i].pdf);
    items.splice(i, 1);
  }

  function onRangeInput(item: MergeItem) {
    if (item.rangeText.trim() === '') {
      item.pages = null;
      item.error = null;
      return;
    }
    const r = parsePageRanges(item.rangeText, item.pdf.pageCount);
    if (r.ok) {
      item.pages = r.pages;
      item.error = null;
    } else {
      item.error = r.error;
    }
  }

  function rangeErrorText(e: RangeError) {
    return t(`range.${e.code}`, { token: e.token, page: e.page ?? '', max: e.max ?? '', suggestion: e.suggestion ?? '' });
  }

  async function create() {
    showValidation = true;
    if (blocker) return;
    building = true;
    try {
      const parts = items.map((it) => ({
        fileId: it.pdf.id,
        pages: (it.pages ?? Array.from({ length: it.pdf.pageCount }, (_, i) => i + 1)).map((p) => ({ index: p - 1, rotate: 0 })),
      }));
      const bytes = await build(parts);
      const word = i18n.lang === 'it' ? 'unito' : 'merged';
      result = { bytes, filename: `${baseName(items[0].pdf.name)}_${word}.pdf`, pages: totalPages };
      showValidation = false;
    } catch (e) {
      notify('error', errorText(e));
    } finally {
      building = false;
    }
  }

  function newJob() {
    result = null;
    items.forEach((it) => unloadPdf(it.pdf));
    items = [];
  }
</script>

<section class="card section">
  <StepTitle n={1} title={t('step.loadMany')} done={items.length >= 2} />

  {#if items.length === 0}
    <DropZone multiple busy={opening} onfiles={add} />
  {:else}
    <p class="hint"><Icon name="info" size={15} />{t('merge.dragHint')}</p>
    <ol class="list" use:sortable={{ onSort: (from, to) => (items = moveItem(items, from, to)), handle: '.handle' }}>
      {#each items as item, i (item.pdf.id)}
        <li class="item" class:invalid={!!item.error}>
          <span class="handle" role="img" aria-label={t('merge.dragFile', { name: item.pdf.name })} title={t('merge.dragFile', { name: item.pdf.name })}>
            <Icon name="grip" size={18} />
          </span>
          <span class="pos">{i + 1}</span>
          <div class="mini">
            <Thumb fileId={item.pdf.id} index={0} width={56} aspect={item.pdf.firstAspect} />
          </div>
          <div class="info">
            <p class="name">{item.pdf.name}</p>
            <p class="sub">{pagesLabel(item.pdf.pageCount)} · {formatBytes(item.pdf.size)}</p>
          </div>
          <div class="pages">
            <label class="small-label" for="pages-{item.pdf.id}">{t('merge.pagesLabel')}</label>
            <input
              id="pages-{item.pdf.id}"
              class="input pages-input"
              placeholder={t('merge.pagesPlaceholder')}
              autocomplete="off"
              spellcheck="false"
              bind:value={item.rangeText}
              oninput={() => onRangeInput(item)}
              aria-invalid={!!item.error}
              aria-describedby={item.error ? `pages-err-${item.pdf.id}` : undefined}
            />
          </div>
          <button class="remove" onclick={() => remove(i)} aria-label={t('merge.remove', { name: item.pdf.name })} title={t('merge.remove', { name: item.pdf.name })}>
            <Icon name="trash" size={18} />
          </button>
          {#if item.error}
            <p id="pages-err-{item.pdf.id}" class="msg msg-error err"><Icon name="alert" size={16} />{rangeErrorText(item.error)}</p>
          {/if}
        </li>
      {/each}
    </ol>
    <div class="add">
      <DropZone multiple compact busy={opening} onfiles={add} />
      {#if opening}<span class="opening">{t('drop.opening')}</span>{/if}
    </div>
  {/if}
</section>

<div class="actionbar-space"></div>
<div class="actionbar">
  <div class="wrap actionbar-inner">
    <span class="num-badge" aria-hidden="true">2</span>
    <div class="status" aria-live="polite">
      {#if showValidation && blocker}
        <p class="msg msg-error"><Icon name="alert" size={16} />{blocker}</p>
      {:else if items.length >= 2 && !hasErrors}
        <p class="msg msg-ok"><Icon name="circleCheck" size={16} />{t('merge.total', { pages: pagesLabel(totalPages) })}</p>
        <p class="sub">{t('app.copyNote')}</p>
      {:else}
        <p class="msg msg-info">{items.length === 0 ? t('merge.empty') : t('merge.total', { pages: pagesLabel(totalPages) })}</p>
      {/if}
    </div>
    <button class="btn btn-primary btn-lg" onclick={create} aria-disabled={!!blocker || building}>
      <Icon name="files" />
      {building ? t('save.working') : t('save.merge')}
    </button>
  </div>
</div>

<ResultDialog {result} onclose={() => (result = null)} onnew={newJob} />

<style>
  .section {
    padding: 20px;
  }
  @media (max-width: 560px) {
    .section {
      padding: 16px 14px;
    }
  }
  .hint {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--ink-2);
    margin-bottom: 12px;
  }
  .hint :global(svg) {
    flex: none;
    color: var(--violet);
  }
  .list {
    list-style: none;
    margin: 0 0 14px;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  .item {
    display: grid;
    grid-template-columns: auto auto 56px minmax(0, 1fr) 190px auto;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--r);
    background: var(--surface);
    user-select: none;
    -webkit-user-select: none;
  }
  .item input {
    user-select: text;
    -webkit-user-select: text;
  }
  .item.invalid {
    border-color: var(--danger);
  }
  .handle {
    display: grid;
    place-items: center;
    width: 28px;
    height: 40px;
    color: var(--ink-3);
    cursor: grab;
    touch-action: none;
  }
  .handle:active {
    cursor: grabbing;
  }
  .pos {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 6px;
    background: var(--violet-soft);
    color: var(--violet);
    font-size: 12px;
    font-weight: 700;
  }
  .mini {
    width: 56px;
  }
  .info {
    min-width: 0;
  }
  .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sub {
    font-size: 13px;
    color: var(--ink-2);
  }
  .small-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-2);
    margin-bottom: 3px;
  }
  .pages-input {
    min-height: 38px;
    padding: 7px 10px;
  }
  .remove {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--r);
    background: none;
    color: var(--ink-3);
    cursor: pointer;
  }
  .remove:hover {
    background: var(--danger-soft);
    color: var(--danger);
  }
  .err {
    grid-column: 3 / -1;
  }
  .add {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .opening {
    font-size: 13px;
    color: var(--ink-2);
  }
  @media (max-width: 640px) {
    .item {
      grid-template-columns: auto 48px minmax(0, 1fr) auto;
      gap: 8px 10px;
    }
    .pos {
      display: none;
    }
    .mini {
      width: 48px;
    }
    .pages {
      grid-column: 2 / -1;
      grid-row: 2;
    }
    .err {
      grid-column: 2 / -1;
    }
  }

</style>
