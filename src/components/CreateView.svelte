<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';
  import { compendium } from '../lib/compendium.svelte';
  import { blankCharacter, type Character } from '../lib/model/character';
  import { averageHp } from '../lib/rules/derive';
  import { readCharacterFile } from '../lib/io';
  import AbilitiesCard from './build/AbilitiesCard.svelte';
  import BackgroundCard from './build/BackgroundCard.svelte';
  import ProficienciesCard from './build/ProficienciesCard.svelte';
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

  async function create() {
    if (!canCreate) return;
    const c = $state.snapshot(draft) as Character;
    c.name = c.name.trim();
    c.hp = { max: hp, current: hp, temp: 0 };
    await store.add(c);
    oncreated?.();
  }

  async function onFile(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    const r = await readCharacterFile(file);
    if (r.ok) await store.add(r.character);
    else errors = r.errors;
  }
</script>

<div class="create">
  <header>
    <div class="title-row">
      <h1>{t('Nuevo personaje')}</h1>
      {#if store.currentId}<button onclick={() => store.cancelNew()}>{t('Volver a {name}', { name: store.c.name || t('Sin nombre') })}</button>{/if}
    </div>
    <p class="muted">{t('Lo básico para empezar, incluidas tus skills. Feats, invocations y equipo se completan después en Editar y Equipo.')}</p>
  </header>

  {#if !compendium.packs.length}
    <PacksCard />
  {/if}

  <div class="card stack">
    <h2>{t('Identidad')}</h2>
    <label class="field"><span>{t('Nombre')}</span><input bind:value={draft.name} placeholder={t('Nombre del personaje')} /></label>
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
  <ProficienciesCard bind:c={draft} creating />

  <div class="actions">
    <p class="muted small center">{t('HP máximo inicial (promedio)')}: <b class="num">{hp}</b></p>
    <button class="primary big" onclick={create} disabled={!canCreate}>{t('Crear personaje')}</button>
    {#if !draft.name.trim()}<p class="muted small center">{t('Falta el nombre.')}</p>{/if}
    <button class="ghost" onclick={() => fileInput.click()}>{t('O importar un respaldo JSON')}</button>
    <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={onFile} />
    {#if errors.length}
      <div class="errors small">
        <b>{t('El archivo no es un personaje válido:')}</b>
        <ul>{#each errors as e (e)}<li>{e}</li>{/each}</ul>
      </div>
    {/if}
  </div>
</div>

<style>
  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
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
