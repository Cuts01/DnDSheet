<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { compendium } from '../lib/compendium.svelte';
  import { blankCharacter, type Character } from '../lib/model/character';
  import { averageHp } from '../lib/rules/derive';
  import { readCharacterFile } from '../lib/io';
  import AbilitiesCard from './build/AbilitiesCard.svelte';
  import BackgroundCard from './build/BackgroundCard.svelte';
  import ClassesCard from './build/ClassesCard.svelte';
  import SpeciesCard from './build/SpeciesCard.svelte';
  import PacksCard from './PacksCard.svelte';

  let { oncreated }: { oncreated?: () => void } = $props();

  /* Borrador local: no toca IndexedDB hasta que confirmas. */
  let draft = $state<Character>(blankCharacter());
  let errors = $state<string[]>([]);
  let fileInput: HTMLInputElement;

  const hp = $derived(averageHp(draft));
  const canCreate = $derived(draft.name.trim().length > 0 && draft.classes[0].name.trim().length > 0);

  function create() {
    if (!canCreate) return;
    const c = $state.snapshot(draft) as Character;
    c.name = c.name.trim();
    c.hp = { max: hp, current: hp, temp: 0 };
    store.replace(c);
    oncreated?.();
  }

  async function onFile(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    const r = await readCharacterFile(file);
    if (r.ok) store.replace(r.character);
    else errors = r.errors;
  }
</script>

<div class="create">
  <header>
    <h1>Nuevo personaje</h1>
    <p class="muted">Lo básico para empezar. Skills, feats, invocations y equipo se completan después en Editar y Equipo.</p>
  </header>

  {#if !compendium.packs.length}
    <PacksCard />
  {/if}

  <div class="card stack">
    <h2>Identidad</h2>
    <label class="field"><span>Nombre</span><input bind:value={draft.name} placeholder="Nombre del personaje" /></label>
    <label class="field">
      <span>Ruleset</span>
      <select bind:value={draft.ruleset}>
        <option value="2014">2014</option>
        <option value="2024">2024</option>
      </select>
    </label>
  </div>

  <SpeciesCard bind:c={draft} />
  <ClassesCard bind:c={draft} />
  <BackgroundCard bind:c={draft} />
  <AbilitiesCard bind:c={draft} />

  <div class="actions">
    <p class="muted small center">HP máximo inicial (promedio): <b class="num">{hp}</b></p>
    <button class="primary big" onclick={create} disabled={!canCreate}>Crear personaje</button>
    {#if !draft.name.trim()}<p class="muted small center">Falta el nombre.</p>{/if}
    <button class="ghost" onclick={() => fileInput.click()}>O importar un respaldo JSON</button>
    <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={onFile} />
    {#if errors.length}
      <div class="errors small">
        <b>El archivo no es un personaje válido:</b>
        <ul>{#each errors as e (e)}<li>{e}</li>{/each}</ul>
      </div>
    {/if}
  </div>
</div>

<style>
  .create {
    max-width: 640px;
    margin: 0 auto;
    padding: calc(env(safe-area-inset-top) + 16px) 12px calc(env(safe-area-inset-bottom) + 32px);
    display: flex;
    flex-direction: column;
    gap: var(--gap);
    container-type: inline-size;
  }
  header h1 {
    margin: 0;
    font-size: 1.5rem;
  }
  header p {
    margin: 4px 0 0;
  }
  .card h2 {
    margin-bottom: 0;
  }
  p {
    margin: 0;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .big {
    min-height: 56px;
    font-size: 1.05rem;
  }
  .center {
    text-align: center;
  }
  .errors {
    color: var(--bad);
  }
  .errors ul {
    margin: 4px 0 0;
    padding-left: 18px;
  }
</style>
