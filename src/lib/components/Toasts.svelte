<script lang="ts">
  import { t } from '../i18n.svelte';
  import { dismiss, toasts } from '../state.svelte';
  import Icon from './Icon.svelte';

  const icon = { error: 'alert', success: 'circleCheck', info: 'info' } as const;
</script>

<div class="toasts" aria-live="assertive">
  {#each toasts as toast (toast.id)}
    <div class="toast {toast.kind}" role={toast.kind === 'error' ? 'alert' : 'status'}>
      <Icon name={icon[toast.kind]} size={18} />
      <p>{toast.text}</p>
      {#if toast.action}
        <button
          class="btn btn-sm btn-primary"
          onclick={() => {
            toast.action?.run();
            dismiss(toast.id);
          }}>{toast.action.label}</button
        >
      {/if}
      <button class="close" onclick={() => dismiss(toast.id)} aria-label={t('app.dismiss')}><Icon name="x" size={16} /></button>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    top: calc(72px + env(safe-area-inset-top));
    left: 50%;
    transform: translateX(-50%);
    z-index: 50;
    display: grid;
    gap: 8px;
    width: min(520px, calc(100vw - 32px));
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 12px 12px 14px;
    border-radius: var(--r-lg);
    background: var(--surface);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-lift);
    font-size: 14px;
    font-weight: 500;
    animation: drop 0.2s ease-out;
  }
  .toast p {
    flex: 1;
  }
  .toast > :global(svg) {
    flex: none;
  }
  .error {
    border-color: color-mix(in srgb, var(--danger) 40%, var(--line));
  }
  .error > :global(svg) {
    color: var(--danger);
  }
  .success > :global(svg) {
    color: var(--mint);
  }
  .info > :global(svg) {
    color: var(--violet);
  }
  .close {
    width: 30px;
    height: 30px;
    flex: none;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--r-sm);
    background: none;
    color: var(--ink-3);
    cursor: pointer;
  }
  .close:hover {
    background: var(--surface-2);
    color: var(--ink);
  }
  @keyframes drop {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
  }
</style>
