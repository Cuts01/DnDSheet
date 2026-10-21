<script lang="ts">
  import { t, i18n } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';
  import { canShareFiles, downloadCharacter, readCharacterFile, shareCharacter } from '../lib/io';
  import type { Character } from '../lib/model/character';
  import { classSummary } from '../lib/rules/derive';
  import PacksCard from './PacksCard.svelte';
  import CharacterList from './CharacterList.svelte';

  let fileInput: HTMLInputElement;
  let pending = $state<Character | null>(null);
  let errors = $state<string[]>([]);
  let message = $state('');
  const shareable = canShareFiles();

  async function onFile(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    errors = [];
    message = '';
    const r = await readCharacterFile(file);
    if (r.ok) pending = r.character;
    else errors = r.errors;
  }

  async function confirmImport(asNew: boolean) {
    if (!pending) return;
    const c = pending;
    pending = null;
    if (asNew) await store.add(c);
    else store.replace(c);
    message = t('Importado: {name}.', { name: c.name });
  }
  // Si ya hay un personaje con el mismo nombre, se sugiere reemplazarlo (respaldo del mismo personaje).
  const sameName = $derived(pending ? store.list.find((x) => x.valid && x.name.trim().toLowerCase() === pending!.name.trim().toLowerCase()) : undefined);
  async function replaceSame() {
    if (!pending || !sameName) return;
    await store.select(sameName.id);
    await confirmImport(false);
  }

  async function share() {
    try {
      await shareCharacter(store.snapshot());
    } catch (e) {
      if ((e as Error).name !== 'AbortError') message = t('No se pudo compartir: {msg}', { msg: (e as Error).message });
    }
  }


  const updated = $derived(new Date(store.c.updatedAt).toLocaleString(i18n.lang === 'en' ? 'en-US' : 'es-PE'));
</script>

<section class="data">
  <div class="card stack">
    <h2>{t('Idioma')}</h2>
    <div class="row">
      <button class:primary={i18n.lang === 'es'} aria-pressed={i18n.lang === 'es'} onclick={() => i18n.set('es')}>Español</button>
      <button class:primary={i18n.lang === 'en'} aria-pressed={i18n.lang === 'en'} onclick={() => i18n.set('en')}>English</button>
    </div>
    <p class="small muted">{t('Los términos de D&D (spells, classes, feats) quedan en inglés en los dos idiomas.')}</p>
  </div>

  <div class="card stack">
    <h2>{t('Personajes')}</h2>
    <CharacterList />
    <p class="small muted">{t('También puedes cambiar de personaje tocando su nombre arriba.')}</p>
  </div>

  <div class="card stack">
    <h2>{t('Respaldo')}</h2>
    <p class="small muted">
      {t('Los datos viven solo en este dispositivo. Exporta un JSON antes de limpiar el navegador, y úsalo para pasar el personaje entre el teléfono y la tablet.')} {t('Exportar guarda el personaje abierto.')}
    </p>
    <div class="row wrap">
      <button class="primary" onclick={() => downloadCharacter(store.snapshot())}>{t('Exportar JSON')}</button>
      {#if shareable}
        <button onclick={share}>{t('Compartir...')}</button>
      {/if}
      <button onclick={() => fileInput.click()}>{t('Importar JSON')}</button>
      <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={onFile} />
    </div>
    {#if pending}
      <div class="confirm">
        <p>
          <b>{pending.name}</b> <span class="muted">({classSummary(pending)})</span>
        </p>
        {#if sameName}
          <p class="small muted">{t('Ya tienes un personaje con ese nombre. Si es un respaldo del mismo, reemplázalo para no duplicarlo.')}</p>
        {/if}
        <div class="row wrap">
          <button onclick={() => (pending = null)}>{t('Cancelar')}</button>
          {#if sameName}
            <button class="primary" onclick={replaceSame}>{t('Reemplazar a {name}', { name: sameName.name })}</button>
            <button onclick={() => confirmImport(true)}>{t('Agregar como nuevo')}</button>
          {:else}
            <button class="primary" onclick={() => confirmImport(true)}>{t('Agregar como nuevo')}</button>
          {/if}
        </div>
      </div>
    {/if}
    {#if errors.length}
      <div class="errors small">
        <b>{t('El archivo no es un personaje válido:')}</b>
        <ul>{#each errors as e (e)}<li>{e}</li>{/each}</ul>
      </div>
    {/if}
    {#if message}<p class="ok small">{message}</p>{/if}
  </div>

  <div class="card stack">
    <h2>{t('Almacenamiento')}</h2>
    <p class="small">
      {t('Persistente')}:
      {#if store.persisted === null}<span class="muted">{t('no disponible en este navegador')}</span>
      {:else if store.persisted}<b class="ok">{t('sí')}</b>, {t('Android no lo borrará por falta de espacio')}
      {:else}<b class="warn">no</b>{/if}
    </p>
    {#if store.persisted === false}
      <button onclick={() => store.requestPersist()}>{t('Solicitar almacenamiento persistente')}</button>
      <p class="small muted">{t('Chrome suele concederlo cuando la app está instalada en la pantalla de inicio.')}</p>
    {/if}
    <p class="small muted">{t('Último guardado')}: {updated}</p>
    <p class="small muted">{t('Versión de la app')}: {__APP_VERSION__}</p>
  </div>

  <PacksCard />


</section>

<style>
  .data {
    display: grid;
    gap: var(--gap);
  }
  @container (min-width: 760px) {
    .data {
      grid-template-columns: 1fr 1fr;
      align-items: start;
    }
  }
  .card h2 {
    margin-bottom: 0;
  }
  p {
    margin: 0;
  }
  .wrap {
    flex-wrap: wrap;
  }
  .confirm {
    border: 1px solid var(--accent);
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .errors {
    color: var(--bad);
  }
  .errors ul {
    margin: 4px 0 0;
    padding-left: 18px;
  }
  .ok {
    color: var(--good);
  }
  .warn {
    color: var(--bad);
  }
</style>
