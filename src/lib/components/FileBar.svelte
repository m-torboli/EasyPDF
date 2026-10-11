<script lang="ts">
  import type { LoadedPdf } from '../files';
  import { formatBytes, pagesLabel, t } from '../i18n.svelte';
  import Icon from './Icon.svelte';

  let { pdf, busy = false, onchange }: { pdf: LoadedPdf; busy?: boolean; onchange: (files: File[]) => void } = $props();

  let input = $state<HTMLInputElement>();
</script>

<section class="card filebar">
  <span class="file-icon"><Icon name="fileText" size={22} /></span>
  <div class="file-meta">
    <p class="file-name">{pdf.name}</p>
    <p class="file-sub">{pagesLabel(pdf.pageCount)} · {formatBytes(pdf.size)}</p>
  </div>
  <button class="btn btn-sm" onclick={() => input?.click()} disabled={busy}>
    <Icon name="refresh" size={16} />
    {t('extract.changeFile')}
  </button>
  <input
    bind:this={input}
    type="file"
    accept="application/pdf,.pdf"
    hidden
    onchange={(e) => {
      onchange([...(e.currentTarget.files ?? [])]);
      e.currentTarget.value = '';
    }}
  />
</section>

<style>
  .filebar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    margin-bottom: 14px;
  }
  .file-icon {
    width: 40px;
    height: 40px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: var(--r);
    background: var(--coral-soft);
    color: var(--coral);
  }
  .file-meta {
    flex: 1;
    min-width: 0;
  }
  .file-name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .file-sub {
    font-size: 13px;
    color: var(--ink-2);
  }
</style>
