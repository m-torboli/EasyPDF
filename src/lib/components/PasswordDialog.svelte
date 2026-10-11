<script lang="ts">
  import { t } from '../i18n.svelte';
  import { passwordPrompt } from '../state.svelte';
  import Dialog from './Dialog.svelte';
  import Icon from './Icon.svelte';

  let value = $state('');
  const req = $derived(passwordPrompt.current);

  $effect(() => {
    if (req) value = '';
  });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (value) req?.resolve(value);
  }
</script>

<Dialog open={req !== null} onclose={() => req?.resolve(null)} labelledby="pw-title">
  {#if req}
    <form onsubmit={submit}>
      <div class="head">
        <span class="badge"><Icon name="lock" size={20} /></span>
        <h2 id="pw-title">{t('pw.title')}</h2>
      </div>
      <p class="desc">{t('pw.desc', { name: req.name })}</p>
      <label class="field-label" for="pw-input">{t('pw.label')}</label>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        id="pw-input"
        class="input"
        type="password"
        autocomplete="off"
        autofocus
        bind:value
        aria-invalid={req.wrong}
        aria-describedby={req.wrong ? 'pw-error' : undefined}
      />
      {#if req.wrong}
        <p id="pw-error" class="msg msg-error" style="margin-top:8px"><Icon name="alert" size={16} />{t('pw.wrong')}</p>
      {/if}
      <div class="actions">
        <button type="button" class="btn btn-ghost" onclick={() => req.resolve(null)}>{t('pw.cancel')}</button>
        <button type="submit" class="btn btn-primary" aria-disabled={!value}>{t('pw.open')}</button>
      </div>
    </form>
  {/if}
</Dialog>

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }
  .badge {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: var(--r);
    background: var(--violet-soft);
    color: var(--violet);
  }
  h2 {
    font-size: 18px;
  }
  .desc {
    color: var(--ink-2);
    margin-bottom: 16px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }
</style>
