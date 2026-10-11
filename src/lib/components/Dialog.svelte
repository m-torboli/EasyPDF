<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    open,
    onclose,
    labelledby,
    children,
  }: { open: boolean; onclose: () => void; labelledby: string; children: Snippet } = $props();

  let dialog: HTMLDialogElement;

  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  aria-labelledby={labelledby}
  oncancel={(e) => {
    e.preventDefault();
    onclose();
  }}
  onclick={(e) => {
    if (e.target === dialog) onclose();
  }}
>
  <div class="body">
    {#if open}
      {@render children()}
    {/if}
  </div>
</dialog>

<style>
  dialog {
    width: min(460px, calc(100vw - 32px));
    max-height: calc(100dvh - 32px);
    padding: 0;
    border: 1px solid var(--line);
    border-radius: var(--r-xl);
    background: var(--surface);
    color: var(--ink);
    box-shadow: var(--shadow-lift);
  }
  dialog::backdrop {
    background: rgb(28 26 46 / 0.45);
    backdrop-filter: blur(2px);
  }
  dialog[open] {
    animation: pop 0.18s ease-out;
  }
  .body {
    padding: 24px;
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
  }
</style>
