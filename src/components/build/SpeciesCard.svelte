<script lang="ts">
  import { compendium } from '../../lib/compendium.svelte';
  import { ABILITIES, type Character } from '../../lib/model/character';
  import { applySpecies, findSpecies, speciesList } from '../../lib/rules/features';
  import { ABILITY_LABEL } from '../../lib/rules/tables';
  import NumField from '../NumField.svelte';
  import RefSelect from './RefSelect.svelte';

  let { c = $bindable() }: { c: Character } = $props();

  const options = $derived(speciesList(compendium.packs, c.ruleset));
  const current = $derived(findSpecies(compendium.packs, c.species.ref));
  const sp = $derived(current?.item ?? null);
  const fixedCount = $derived(sp ? Object.keys(sp.asi.fixed).length : 0);
  let custom = $state(false);
  let showTraits = $state(false);

  function pick(r: Parameters<typeof applySpecies>[1]) {
    c = applySpecies($state.snapshot(c) as Character, r);
  }
</script>

<div class="card stack">
  <h2>{c.ruleset === '2024' ? 'Species' : 'Raza'}</h2>

  {#if options.length}
    <RefSelect {options} value={c.species.ref} label={c.ruleset === '2024' ? 'Species' : 'Raza'} onpick={pick} />
  {:else}
    <p class="muted small">Importa un pack con razas para elegir de una lista. Mientras tanto:</p>
  {/if}

  {#if !sp}
    <div class="grid2">
      <label class="field"><span>Nombre</span><input bind:value={c.species.name} placeholder="Ej. Wood Elf" /></label>
      <NumField label="Speed base" bind:value={c.species.speed} min={0} max={200} />
    </div>
  {:else}
    <div class="facts small">
      <span>Tamaño <b>{sp.size}</b></span>
      <span>Speed <b class="num">{sp.speed} ft</b></span>
      {#if sp.darkvision}<span>Darkvision <b class="num">{sp.darkvision} ft</b></span>{/if}
      {#if sp.languages.length}<span>Idiomas <b>{sp.languages.join(', ')}</b></span>{/if}
    </div>

    {#if c.bonuses.species.length}
      <div class="bonuses">
        <span class="small muted">Incrementos</span>
        {#each c.bonuses.species as b, i (i)}
          {@const locked = i < fixedCount && !custom}
          <div class="bonus">
            <b class="num">+{b.amount}</b>
            <select bind:value={c.bonuses.species[i].ability} disabled={locked} aria-label="Ability">
              {#each ABILITIES as a (a)}<option value={a}>{ABILITY_LABEL[a]}</option>{/each}
            </select>
          </div>
        {/each}
      </div>
      {#if fixedCount}
        <label class="check small">
          <input type="checkbox" bind:checked={custom} />
          <span>Reasignar incrementos (Customizing Your Origin, Tasha's)</span>
        </label>
      {/if}
    {/if}

    {#if sp.originFeat}
      <p class="small accent">Esta raza da un feat: elígelo en Clases y mejoras.</p>
    {/if}
    {#if sp.skillChoices}
      <p class="small accent">Elige {sp.skillChoices.count} skill(s) en Proficiencies.</p>
    {/if}

    {#if sp.traits.length}
      <button class="ghost small toggle" onclick={() => (showTraits = !showTraits)}>
        {showTraits ? 'Ocultar' : 'Ver'} rasgos ({sp.traits.length})
      </button>
      {#if showTraits}
        <ul class="traits small">
          {#each sp.traits as t (t.name)}<li><b>{t.name}.</b> {t.text}</li>{/each}
        </ul>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .card h2 {
    margin-bottom: 0;
  }
  p {
    margin: 0;
  }
  .accent {
    color: var(--accent);
  }
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
  }
  .bonuses {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .bonus {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--surface-2);
    border-radius: 10px;
    padding: 2px 4px 2px 10px;
  }
  .bonus b {
    color: var(--accent);
  }
  .bonus select {
    width: auto;
    min-height: 40px;
  }
  .check {
    display: flex;
    gap: 10px;
    align-items: center;
    min-height: 40px;
  }
  .check input {
    width: 22px;
    min-height: 22px;
    accent-color: var(--accent);
  }
  .toggle {
    align-self: flex-start;
    min-height: 36px;
  }
  .traits {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    line-height: 1.45;
  }
</style>
