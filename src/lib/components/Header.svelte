<script lang="ts">
  import { pandaFace } from '../brand';
  import { i18n, setLang, t } from '../i18n.svelte';
  import { install, navigate, router, type Route } from '../state.svelte';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  const tabs: { route: Route; icon: IconName; key: 'tool.extract.title' | 'tool.merge.title' }[] = [
    { route: 'extract', icon: 'scissors', key: 'tool.extract.title' },
    { route: 'merge', icon: 'files', key: 'tool.merge.title' },
  ];
</script>

<header>
  <div class="wrap bar">
    <a class="brand" href="#/" onclick={(e) => { e.preventDefault(); navigate('home'); }} aria-label="EasyPDF · {t('app.home')}">
      <span class="mark">{@html pandaFace()}</span>
      <span class="word">Easy<span>PDF</span></span>
    </a>

    {#if router.route !== 'home'}
      <nav aria-label="EasyPDF">
        {#each tabs as tab}
          <a
            class="tab"
            class:active={router.route === tab.route}
            href="#/{tab.route}"
            aria-current={router.route === tab.route ? 'page' : undefined}
          >
            <Icon name={tab.icon} size={16} />
            <span>{t(tab.key)}</span>
          </a>
        {/each}
      </nav>
    {/if}

    <div class="right">
      {#if !install.standalone}
        <button class="btn btn-ghost btn-sm install" onclick={() => (install.dialogOpen = true)} title={t('app.install')}>
          <Icon name="install" size={17} />
          <span class="install-label">{t('app.install')}</span>
        </button>
      {/if}
      <div class="lang" role="group" aria-label={t('app.language')}>
        <button aria-pressed={i18n.lang === 'it'} onclick={() => setLang('it')} lang="it">IT</button>
        <button aria-pressed={i18n.lang === 'en'} onclick={() => setLang('en')} lang="en">EN</button>
      </div>
    </div>
  </div>
</header>

<style>
  header {
    position: sticky;
    top: 0;
    z-index: 30;
    background: color-mix(in srgb, var(--surface) 90%, transparent);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line);
    padding-top: env(safe-area-inset-top);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 16px;
    min-height: 60px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: var(--ink);
    border-radius: var(--r);
  }
  .mark {
    width: 34px;
    height: 34px;
    flex: none;
  }
  .mark :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
  .word {
    font-weight: 700;
    font-size: 19px;
    letter-spacing: -0.03em;
  }
  .word span {
    color: var(--coral);
  }
  nav {
    display: flex;
    gap: 4px;
  }
  .tab {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 12px;
    border-radius: var(--r);
    color: var(--ink-2);
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
    white-space: nowrap;
  }
  .tab:hover {
    background: var(--surface-2);
    color: var(--ink);
  }
  .tab.active {
    background: var(--coral);
    color: var(--on-coral);
  }
  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .lang {
    display: flex;
    padding: 2px;
    border: 1px solid var(--violet-line);
    border-radius: var(--r);
  }
  .lang button {
    border: 0;
    background: none;
    padding: 4px 9px;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 700;
    color: var(--violet);
    cursor: pointer;
  }
  .lang button[aria-pressed='true'] {
    background: var(--violet);
    color: #fff;
  }
  @media (max-width: 760px) {
    .install-label {
      display: none;
    }
  }
  @media (max-width: 600px) {
    .bar {
      flex-wrap: wrap;
      gap: 8px 12px;
      padding-top: 8px;
      padding-bottom: 8px;
    }
    nav {
      order: 3;
      width: 100%;
    }
    .tab {
      flex: 1;
      justify-content: center;
    }
    .word {
      font-size: 17px;
    }
  }
</style>
