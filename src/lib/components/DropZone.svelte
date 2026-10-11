<script lang="ts">
  import { t } from '../i18n.svelte';
  import Icon from './Icon.svelte';

  let {
    multiple = false,
    busy = false,
    compact = false,
    onfiles,
  }: { multiple?: boolean; busy?: boolean; compact?: boolean; onfiles: (files: File[]) => void } = $props();

  let input: HTMLInputElement;
  let over = $state(false);
  let depth = 0;

  function pick(list: FileList | null | undefined) {
    const files = list ? [...list] : [];
    if (files.length) onfiles(multiple ? files : files.slice(0, 1));
  }

  function ondrop(e: DragEvent) {
    e.preventDefault();
    over = false;
    depth = 0;
    pick(e.dataTransfer?.files);
  }
</script>

{#if compact}
  <button type="button" class="btn" onclick={() => input.click()} disabled={busy}>
    <Icon name="plus" />
    {t('merge.add')}
  </button>
{:else}
  <div
    class="zone"
    class:over
    class:busy
    role="region"
    aria-label={multiple ? t('drop.titleMany') : t('drop.title')}
    ondragenter={(e) => {
      e.preventDefault();
      depth++;
      over = true;
    }}
    ondragover={(e) => e.preventDefault()}
    ondragleave={() => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) over = false;
    }}
    {ondrop}
  >
    <div class="icon"><Icon name={over ? 'download' : 'upload'} size={28} /></div>
    {#if busy}
      <p class="title">{t('drop.opening')}</p>
      <div class="bar" aria-hidden="true"><span></span></div>
    {:else if over}
      <p class="title">{t('drop.release')}</p>
    {:else}
      <p class="title">{multiple ? t('drop.titleMany') : t('drop.title')}</p>
      <p class="or">{t('drop.or')}</p>
      <button type="button" class="btn btn-primary btn-lg" onclick={() => input.click()}>
        <Icon name="fileText" />
        {multiple ? t('drop.buttonMany') : t('drop.button')}
      </button>
      <p class="note"><Icon name="shield" size={15} /> {t('app.privacy')}</p>
    {/if}
  </div>
{/if}

<input
  bind:this={input}
  type="file"
  accept="application/pdf,.pdf"
  {multiple}
  hidden
  onchange={(e) => {
    pick(e.currentTarget.files);
    e.currentTarget.value = '';
  }}
/>

<style>
  .zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    padding: 40px 20px;
    border: 2px dashed var(--line-strong);
    border-radius: var(--r-xl);
    background: var(--surface);
    transition:
      border-color 0.15s,
      background 0.15s;
  }
  .zone.over {
    border-color: var(--violet);
    background: var(--violet-soft);
  }
  .icon {
    width: 56px;
    height: 56px;
    display: grid;
    place-items: center;
    border-radius: var(--r-lg);
    background: var(--coral-soft);
    color: var(--coral);
    margin-bottom: 4px;
  }
  .over .icon {
    background: var(--violet);
    color: #fff;
  }
  .title {
    font-size: 18px;
    font-weight: 700;
  }
  .or {
    color: var(--ink-3);
    font-size: 13px;
  }
  .note {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    font-size: 13px;
    color: var(--ink-2);
  }
  .note :global(svg) {
    color: var(--mint);
    flex: none;
  }
  .bar {
    width: 180px;
    height: 4px;
    border-radius: 2px;
    background: var(--violet-soft);
    overflow: hidden;
  }
  .bar span {
    display: block;
    width: 40%;
    height: 100%;
    background: var(--violet);
    border-radius: 2px;
    animation: slide 1.1s ease-in-out infinite;
  }
  @keyframes slide {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(250%);
    }
  }
</style>
