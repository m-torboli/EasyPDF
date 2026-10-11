<script lang="ts">
  import { baseName, canShareFiles, downloadPdf, errorText, safeFilename, sharePdf, type BuiltPdf } from '../files';
  import { formatBytes, pagesLabel, t } from '../i18n.svelte';
  import { notify } from '../state.svelte';
  import Dialog from './Dialog.svelte';
  import Icon from './Icon.svelte';

  let {
    result,
    onclose,
    onnew,
  }: { result: BuiltPdf | null; onclose: () => void; onnew: () => void } = $props();

  const shareable = canShareFiles();
  let downloaded = $state(false);
  let name = $state('');

  $effect(() => {
    if (result) {
      downloaded = false;
      name = baseName(result.filename);
    }
  });

  const filename = $derived(result ? safeFilename(name, baseName(result.filename)) : '');

  function download() {
    if (!result) return;
    downloadPdf(result.bytes, filename);
    downloaded = true;
  }

  async function share() {
    if (!result) return;
    try {
      await sharePdf(result.bytes, filename);
    } catch (e) {
      notify('error', errorText(e));
    }
  }
</script>

<Dialog open={result !== null} {onclose} labelledby="result-title">
  {#if result}
    <div class="hero">
      <span class="ok"><Icon name="check" size={26} stroke={2.5} /></span>
      <h2 id="result-title">{t('result.title')}</h2>
    </div>
    <label class="field-label" for="result-name">{t('save.filename')}</label>
    <div class="file">
      <Icon name="fileText" size={22} />
      <div class="meta">
        <div class="name-row">
          <input id="result-name" class="name" bind:value={name} autocomplete="off" spellcheck="false" />
          <span class="ext">.pdf</span>
        </div>
        <p class="sub">{t('result.summary', { pages: pagesLabel(result.pages), size: formatBytes(result.bytes.length) })}</p>
      </div>
    </div>
    <div class="main-actions">
      <!-- svelte-ignore a11y_autofocus -->
      <button class="btn btn-primary btn-lg" onclick={download} autofocus>
        <Icon name={downloaded ? 'check' : 'download'} />
        {t('result.download')}
      </button>
      {#if shareable}
        <button class="btn btn-lg" onclick={share}>
          <Icon name="share" />
          {t('result.share')}
        </button>
      {/if}
    </div>
    <p class="msg msg-ok note"><Icon name="shield" size={16} />{t('result.original')}</p>
    <div class="secondary">
      <button class="btn btn-ghost btn-sm" onclick={onclose}><Icon name="arrowLeft" size={16} />{t('result.back')}</button>
      <button class="btn btn-ghost btn-sm" onclick={onnew}><Icon name="refresh" size={16} />{t('result.newJob')}</button>
    </div>
  {/if}
</Dialog>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    margin-bottom: 18px;
  }
  .ok {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--mint-soft);
    color: var(--mint);
    animation: bounce 0.4s ease-out;
  }
  h2 {
    font-size: 20px;
  }
  .file {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: var(--r);
    background: var(--surface-2);
    border: 1px solid var(--line);
    color: var(--coral);
  }
  .file:focus-within {
    border-color: var(--violet);
    box-shadow: var(--focus);
  }
  .meta {
    flex: 1;
    min-width: 0;
  }
  .name-row {
    display: flex;
    align-items: baseline;
  }
  .name {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font-weight: 600;
    font-size: 16px;
  }
  .name:focus {
    outline: none;
    box-shadow: none;
  }
  .ext {
    color: var(--ink-3);
    font-weight: 600;
  }
  .sub {
    color: var(--ink-2);
    font-size: 13px;
  }
  .main-actions {
    display: grid;
    gap: 8px;
    margin-top: 16px;
  }
  .note {
    justify-content: center;
    margin-top: 14px;
  }
  .secondary {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
  }
  @keyframes bounce {
    0% {
      transform: scale(0.5);
      opacity: 0;
    }
    70% {
      transform: scale(1.1);
    }
  }
</style>
