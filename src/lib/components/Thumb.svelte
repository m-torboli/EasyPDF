<script lang="ts">
  // Anteprima di una pagina, generata solo quando entra nello schermo.
  import { onMount } from 'svelte';
  import { thumbnail } from '../pdf/client';

  let {
    fileId,
    index,
    width = 160,
    rotation = 0,
    aspect = 1.414,
  }: { fileId: string; index: number; width?: number; rotation?: number; aspect?: number } = $props();

  let box: HTMLDivElement;
  let src = $state<string | null>(null);
  let failed = $state(false);

  // Risoluzione adatta agli schermi Retina, con un limite per non sprecare memoria.
  const renderWidth = $derived(Math.min(400, Math.round(width * Math.min(2, window.devicePixelRatio || 1))));

  onMount(() => {
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        thumbnail(fileId, index, renderWidth)
          .then((url) => (src = url))
          .catch(() => (failed = true));
      },
      { rootMargin: '300px' },
    );
    io.observe(box);
    return () => io.disconnect();
  });
</script>

<div class="thumb" bind:this={box}>
  {#if src}
    <img {src} alt="" draggable="false" style:transform="rotate({rotation}deg)" />
  {:else}
    <div
      class="placeholder"
      class:failed
      style:width="{aspect >= 1 ? 100 / aspect : 100}%"
      style:height="{aspect >= 1 ? 100 : 100 * aspect}%"
      style:transform="rotate({rotation}deg)"
    ></div>
  {/if}
</div>

<style>
  .thumb {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
  }
  img,
  .placeholder {
    position: absolute;
    inset: 0;
    margin: auto;
    max-width: 100%;
    max-height: 100%;
    background: var(--thumb-paper);
    box-shadow:
      0 0 0 1px rgb(28 26 46 / 0.08),
      0 2px 6px rgb(28 26 46 / 0.08);
    border-radius: 2px;
    transition: transform 0.25s ease;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  .placeholder {
    background: linear-gradient(100deg, var(--thumb-paper) 30%, #f1ece6 50%, var(--thumb-paper) 70%);
    background-size: 300% 100%;
    animation: shimmer 1.4s linear infinite;
  }
  .placeholder.failed {
    animation: none;
    background: var(--surface-2);
  }
  @keyframes shimmer {
    from {
      background-position: 100% 0;
    }
    to {
      background-position: 0 0;
    }
  }
</style>
