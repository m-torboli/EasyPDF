<script lang="ts">
  import { pandaFull } from './brand';
  import Icon from './components/Icon.svelte';
  import type { IconName } from './components/icons';
  import { t, type MessageKey } from './i18n.svelte';
  import { editMode, type Route } from './state.svelte';

  const tools: { route?: Route; mode?: 'text' | 'images'; icon: IconName; title: MessageKey; desc: MessageKey; tone: string }[] = [
    { route: 'extract', icon: 'scissors', title: 'tool.extract.title', desc: 'tool.extract.desc', tone: 'coral' },
    { route: 'merge', icon: 'files', title: 'tool.merge.title', desc: 'tool.merge.desc', tone: 'violet' },
    { route: 'edit', mode: 'text', icon: 'pencil', title: 'tool.edit.title', desc: 'tool.edit.desc', tone: 'sun' },
    { route: 'edit', mode: 'images', icon: 'photo', title: 'tool.images.title', desc: 'tool.images.desc', tone: 'mint' },
  ];
</script>

<section class="hero">
  <div class="logo">{@html pandaFull('hero')}</div>
  <div>
    <h1>Easy<span>PDF</span></h1>
    <p class="tagline">{t('app.tagline')}</p>
    <p class="privacy"><Icon name="shield" size={16} />{t('app.privacy')}</p>
  </div>
</section>

<h2 class="choose">{t('home.choose')}</h2>
<div class="tools">
  {#each tools as tool}
    {#if tool.route}
      <a class="tool card {tool.tone}" href="#/{tool.route}" onclick={() => tool.mode && (editMode.mode = tool.mode)}>
        <span class="ico"><Icon name={tool.icon} size={24} /></span>
        <h3>{t(tool.title)}</h3>
        <p>{t(tool.desc)}</p>
        <span class="go" aria-hidden="true"><Icon name="arrowLeft" size={18} /></span>
      </a>
    {:else}
      <div class="tool card soon {tool.tone}" aria-disabled="true">
        <span class="ico"><Icon name={tool.icon} size={24} /></span>
        <h3>{t(tool.title)} <span class="badge">{t('tool.soon')}</span></h3>
        <p>{t(tool.desc)}</p>
      </div>
    {/if}
  {/each}
</div>

<p class="copy"><Icon name="copy" size={16} />{t('app.copyNote')}</p>

<style>
  .hero {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 36px 0 28px;
  }
  .logo {
    width: 132px;
    height: 132px;
    flex: none;
    filter: drop-shadow(0 10px 24px rgb(238 90 58 / 0.25));
  }
  .logo :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
  h1 {
    font-size: 40px;
    font-weight: 700;
    letter-spacing: -0.04em;
  }
  h1 span {
    color: var(--coral);
  }
  .tagline {
    font-size: 18px;
    color: var(--ink-2);
    font-weight: 500;
    margin-top: 2px;
  }
  .privacy {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    font-size: 13px;
    color: var(--ink-2);
  }
  .privacy :global(svg),
  .copy :global(svg) {
    color: var(--mint);
    flex: none;
  }
  .choose {
    font-size: 15px;
    font-weight: 600;
    color: var(--ink-2);
    margin-bottom: 12px;
  }
  .tools {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 14px;
  }
  .tool {
    position: relative;
    display: block;
    padding: 20px;
    color: var(--ink);
    text-decoration: none;
    transition:
      transform 0.15s,
      box-shadow 0.15s,
      border-color 0.15s;
  }
  a.tool:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lift);
    border-color: var(--line-strong);
  }
  .ico {
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    border-radius: var(--r);
    margin-bottom: 14px;
  }
  .coral .ico {
    background: var(--coral-soft);
    color: var(--coral);
  }
  .violet .ico {
    background: var(--violet-soft);
    color: var(--violet);
  }
  .sun .ico {
    background: color-mix(in srgb, var(--sun) 22%, transparent);
    color: #b07a10;
  }
  .mint .ico {
    background: var(--mint-soft);
    color: var(--mint);
  }
  h3 {
    font-size: 17px;
    font-weight: 700;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .tool p {
    color: var(--ink-2);
    font-size: 14px;
  }
  .go {
    position: absolute;
    top: 20px;
    right: 20px;
    color: var(--ink-3);
    transform: rotate(180deg);
    transition: color 0.15s;
  }
  a.tool:hover .go {
    color: var(--coral);
  }
  .soon {
    box-shadow: none;
    background: var(--surface-2);
    opacity: 0.85;
  }
  .badge {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 5px;
    background: var(--surface);
    border: 1px solid var(--line);
    color: var(--ink-2);
  }
  .copy {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 22px 0 40px;
    font-size: 13px;
    color: var(--ink-2);
  }
  @media (max-width: 600px) {
    .hero {
      flex-direction: column;
      text-align: center;
      gap: 14px;
      padding-top: 24px;
    }
    .logo {
      width: 108px;
      height: 108px;
    }
    h1 {
      font-size: 32px;
    }
    .privacy {
      justify-content: center;
    }
  }
</style>
