<script lang="ts">
  import { pandaFace } from '../brand';
  import { t } from '../i18n.svelte';
  import { install } from '../state.svelte';
  import Dialog from './Dialog.svelte';
  import Icon from './Icon.svelte';

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|FxiOS/.test(ua);

  // Le istruzioni più pertinenti per il dispositivo vanno in cima.
  const tips = $derived.by(() => {
    const ios = t('install.ios');
    const mac = t('install.macSafari');
    const chrome = t('install.chrome');
    if (isIOS) return [ios, mac, chrome];
    if (isSafari) return [mac, ios, chrome];
    return [chrome, mac, ios];
  });

  async function installNow() {
    const ev = install.deferred;
    if (!ev) return;
    await ev.prompt();
    const choice = await ev.userChoice;
    if (choice.outcome === 'accepted') install.dialogOpen = false;
    install.deferred = null;
  }
</script>

<Dialog open={install.dialogOpen} onclose={() => (install.dialogOpen = false)} labelledby="install-title">
  <div class="head">
    <span class="logo">{@html pandaFace()}</span>
    <h2 id="install-title">{t('install.title')}</h2>
  </div>
  {#if install.standalone}
    <p class="msg msg-ok"><Icon name="circleCheck" size={16} />{t('install.installed')}</p>
  {:else}
    <p class="intro">{t('install.intro')}</p>
    {#if install.deferred}
      <button class="btn btn-primary btn-lg full" onclick={installNow}>
        <Icon name="install" />
        {t('install.now')}
      </button>
    {/if}
    <ol>
      {#each tips as tip, i}
        <li class:first={i === 0 && !install.deferred}>{tip}</li>
      {/each}
    </ol>
  {/if}
  <div class="actions">
    <button class="btn" onclick={() => (install.dialogOpen = false)}>{t('install.close')}</button>
  </div>
</Dialog>

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  .logo {
    width: 44px;
    height: 44px;
    flex: none;
  }
  .logo :global(svg) {
    width: 100%;
    height: 100%;
  }
  h2 {
    font-size: 18px;
  }
  .intro {
    color: var(--ink-2);
    margin-bottom: 16px;
  }
  .full {
    width: 100%;
    margin-bottom: 16px;
  }
  ol {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 8px;
  }
  li {
    padding: 10px 12px;
    border-radius: var(--r);
    background: var(--surface-2);
    font-size: 14px;
    color: var(--ink-2);
  }
  li.first {
    background: var(--violet-soft);
    color: var(--ink);
    font-weight: 500;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }
</style>
