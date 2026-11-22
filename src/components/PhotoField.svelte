<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import { resizePhoto } from '../lib/photo';

  /* Foto del personaje: subir, cambiar o quitar. */
  let { photo = $bindable() }: { photo?: string } = $props();

  let input = $state<HTMLInputElement>();
  let error = $state('');
  let busy = $state(false);

  async function onFile(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    error = '';
    busy = true;
    try {
      photo = await resizePhoto(file);
    } catch {
      error = t('No se pudo leer la imagen. Prueba con un JPG o PNG.');
    } finally {
      busy = false;
    }
  }
</script>

<div class="photo-field">
  <div class="frame" class:empty={!photo}>
    {#if photo}
      <img src={photo} alt={t('Foto del personaje')} />
    {:else}
      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true">
        <circle cx="12" cy="9" r="3.6" />
        <path d="M5 19.5c1.3-3.3 4-5 7-5s5.7 1.7 7 5" />
      </svg>
    {/if}
  </div>
  <div class="actions">
    <span class="lbl">{t('Foto')}</span>
    <div class="row wrap">
      <button disabled={busy} onclick={() => input?.click()}>{busy ? t('Cargando...') : photo ? t('Cambiar foto') : t('Subir foto')}</button>
      {#if photo}<button class="ghost danger" onclick={() => (photo = '')}>{t('Quitar')}</button>{/if}
    </div>
    {#if error}<p class="err small">{error}</p>{/if}
  </div>
  <input bind:this={input} type="file" accept="image/*" hidden onchange={onFile} />
</div>

<style>
  .photo-field {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .frame {
    flex: none;
    width: 88px;
    height: 88px;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid var(--line);
    background: var(--surface-2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
  }
  .frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lbl {
    font-size: 0.85rem;
    color: var(--muted);
  }
  .err {
    color: var(--bad);
    margin: 0;
  }
</style>
