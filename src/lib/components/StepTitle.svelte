<script lang="ts">
  import type { Snippet } from 'svelte';

  let { n, title, done = false, aside }: { n: number; title: string; done?: boolean; aside?: Snippet } = $props();
</script>

<div class="step">
  <span class="num" class:done aria-hidden="true">{n}</span>
  <h2>{title}</h2>
  {#if aside}
    <div class="aside">{@render aside()}</div>
  {/if}
</div>

<style>
  .step {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px 12px;
    margin-bottom: 14px;
  }
  .num {
    width: 26px;
    height: 26px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 6px;
    background: var(--sun);
    color: var(--on-sun);
    font-weight: 700;
    font-size: 13px;
  }
  .num.done {
    background: var(--mint-soft);
    color: var(--mint);
  }
  h2 {
    font-size: 17px;
    font-weight: 700;
  }
  .aside {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  @media (max-width: 560px) {
    .aside {
      width: 100%;
      margin-left: -10px;
    }
  }
</style>
