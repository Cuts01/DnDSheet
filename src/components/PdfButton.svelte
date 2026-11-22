<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';
  import { compendium } from '../lib/compendium.svelte';
  import { exportSheetPdf } from '../lib/pdf/export';

  /* Exporta la hoja del personaje abierto a PDF. */
  let { primary = false }: { primary?: boolean } = $props();
  let busy = $state(false);
  let msg = $state('');
  let err = $state('');

  async function run() {
    busy = true;
    msg = '';
    err = '';
    try {
      const file = await exportSheetPdf(store.snapshot(), compendium.packs);
      msg = t('Listo: {file}', { file });
    } catch (e) {
      console.error(e);
      err = t('No se pudo generar el PDF.');
    } finally {
      busy = false;
    }
  }
</script>

<div class="pdf">
  <button class:primary disabled={busy} onclick={run}>{busy ? t('Generando PDF...') : t('Exportar hoja en PDF')}</button>
  {#if msg}<p class="ok small">{msg}</p>{/if}
  {#if err}<p class="bad small">{err}</p>{/if}
</div>

<style>
  .pdf {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ok {
    color: var(--good, var(--accent));
    margin: 0;
  }
  .bad {
    color: var(--bad);
    margin: 0;
  }
</style>
