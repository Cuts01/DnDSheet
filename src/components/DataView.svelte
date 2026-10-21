<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { canShareFiles, downloadCharacter, readCharacterFile, shareCharacter } from '../lib/io';
  import type { Character } from '../lib/model/character';
  import { classSummary } from '../lib/rules/derive';
  import PacksCard from './PacksCard.svelte';

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

  function confirmImport() {
    if (!pending) return;
    store.replace(pending);
    message = `Importado: ${pending.name}.`;
    pending = null;
  }

  async function share() {
    try {
      await shareCharacter(store.snapshot());
    } catch (e) {
      if ((e as Error).name !== 'AbortError') message = `No se pudo compartir: ${(e as Error).message}`;
    }
  }

  async function startOver() {
    if (confirm(`Esto borra a ${store.c.name} de este dispositivo y abre la creación de un personaje nuevo. ¿Exportaste un respaldo?`)) {
      await store.discard();
    }
  }

  const updated = $derived(new Date(store.c.updatedAt).toLocaleString('es-PE'));
</script>

<section class="data">
  <div class="card stack">
    <h2>Respaldo</h2>
    <p class="small muted">
      Los datos viven solo en este dispositivo. Exporta un JSON antes de limpiar el navegador, y úsalo para pasar
      el personaje entre el teléfono y la tablet.
    </p>
    <div class="row wrap">
      <button class="primary" onclick={() => downloadCharacter(store.snapshot())}>Exportar JSON</button>
      {#if shareable}
        <button onclick={share}>Compartir...</button>
      {/if}
      <button onclick={() => fileInput.click()}>Importar JSON</button>
      <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={onFile} />
    </div>
    {#if pending}
      <div class="confirm">
        <p>
          ¿Reemplazar <b>{store.c.name}</b> por <b>{pending.name}</b>
          <span class="muted">({classSummary(pending)})</span>?
        </p>
        <div class="row">
          <button onclick={() => (pending = null)}>Cancelar</button>
          <button class="primary" onclick={confirmImport}>Reemplazar</button>
        </div>
      </div>
    {/if}
    {#if errors.length}
      <div class="errors small">
        <b>El archivo no es un personaje válido:</b>
        <ul>{#each errors as e (e)}<li>{e}</li>{/each}</ul>
      </div>
    {/if}
    {#if message}<p class="ok small">{message}</p>{/if}
  </div>

  <div class="card stack">
    <h2>Almacenamiento</h2>
    <p class="small">
      Persistente:
      {#if store.persisted === null}<span class="muted">no disponible en este navegador</span>
      {:else if store.persisted}<b class="ok">sí</b>, Android no lo borrará por falta de espacio
      {:else}<b class="warn">no</b>{/if}
    </p>
    {#if store.persisted === false}
      <button onclick={() => store.requestPersist()}>Solicitar almacenamiento persistente</button>
      <p class="small muted">Chrome suele concederlo cuando la app está instalada en la pantalla de inicio.</p>
    {/if}
    <p class="small muted">Último guardado: {updated}</p>
    <p class="small muted">Versión de la app: {__APP_VERSION__}</p>
  </div>

  <PacksCard />

  <div class="card stack">
    <h2>Nuevo personaje</h2>
    <p class="small muted">Por ahora la app guarda un personaje a la vez. Exporta este antes de crear otro.</p>
    <button class="danger" onclick={startOver}>Borrar y crear uno nuevo</button>
  </div>
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
