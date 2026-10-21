<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import CharacterList from './CharacterList.svelte';

  /* Ventana con la lista de personajes, abierta desde el nombre en el encabezado. */
  let { open = $bindable(false) }: { open?: boolean } = $props();
  let dlg: HTMLDialogElement;

  $effect(() => {
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  });
</script>

<dialog bind:this={dlg} onclose={() => (open = false)} onclick={(e) => e.target === dlg && (open = false)}>
  <div class="wrap">
    <header>
      <h3>{t('Personajes')}</h3>
      <button class="ghost" aria-label={t('Cerrar')} onclick={() => (open = false)}>✕</button>
    </header>
    <div class="body">
      <CharacterList onpicked={() => (open = false)} />
    </div>
  </div>
</dialog>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    max-height: calc(100dvh - 24px);
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--line);
  }
  h3 {
    margin: 0;
    flex: 1;
  }
  .body {
    padding: 14px;
    overflow-y: auto;
  }
</style>
