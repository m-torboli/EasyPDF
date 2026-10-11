<script lang="ts">
  import { onMount } from 'svelte';
  import { useRegisterSW } from 'virtual:pwa-register/svelte';
  import Header from './lib/components/Header.svelte';
  import InstallDialog from './lib/components/InstallDialog.svelte';
  import PasswordDialog from './lib/components/PasswordDialog.svelte';
  import Toasts from './lib/components/Toasts.svelte';
  import Home from './lib/Home.svelte';
  import { t } from './lib/i18n.svelte';
  import { warmUp } from './lib/pdf/client';
  import { notify, router } from './lib/state.svelte';
  import ExtractTool from './lib/tools/ExtractTool.svelte';
  import MergeTool from './lib/tools/MergeTool.svelte';

  const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW();

  $effect(() => {
    if ($offlineReady) notify('success', t('app.offlineReady'));
  });
  $effect(() => {
    if ($needRefresh) notify('info', t('app.updateReady'), { label: t('app.updateNow'), run: () => updateServiceWorker(true) });
  });

  onMount(() => {
    // Il motore PDF (≈10 MB) si prepara in sottofondo mentre l'utente sceglie cosa fare.
    warmUp().catch(() => notify('error', t('error.engine')));
  });
</script>

<Header />

<main class="wrap">
  {#if router.route === 'home'}
    <Home />
  {/if}
  <!-- Gli strumenti restano montati: passando dall'uno all'altro non si perde il lavoro. -->
  <div class="tool" hidden={router.route !== 'extract'}><ExtractTool /></div>
  <div class="tool" hidden={router.route !== 'merge'}><MergeTool /></div>
</main>

<Toasts />
<PasswordDialog />
<InstallDialog />

<style>
  main {
    padding-top: 8px;
  }
  .tool {
    padding-top: 20px;
  }
  .tool[hidden] {
    display: none;
  }
</style>
