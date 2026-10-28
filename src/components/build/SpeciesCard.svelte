<script lang="ts">
  import { t } from '../../lib/i18n.svelte';
  import { compendium } from '../../lib/compendium.svelte';
  import { ABILITIES, type Ability, type Character } from '../../lib/model/character';
  import { applySpecies, findSpecies, speciesList } from '../../lib/rules/features';
  import { ABILITY_LABEL } from '../../lib/rules/tables';
  import NumField from '../NumField.svelte';
  import { score, scoreBreakdown } from '../../lib/rules/derive';
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
  // Incremento que no cuenta porque la ability ya llegó a 20.
  const overCap = (a: Ability | null | undefined) => !!a && scoreBreakdown(c, a).capped > 0;
</script>

<div class="card stack">
  <h2>{c.ruleset === '2024' ? 'Species' : t('Raza')}</h2>

  {#if options.length}
    <RefSelect {options} value={c.species.ref} label={c.ruleset === '2024' ? 'Species' : t('Raza')} onpick={pick} />
  {:else}
    <p class="muted small">{t('Importa un pack con razas para elegir de una lista. Mientras tanto:')}</p>
  {/if}

  {#if !sp}
    <div class="grid2">
      <label class="field"><span>{t('Nombre')}</span><input bind:value={c.species.name} placeholder={t('Ej. Wood Elf')} /></label>
      <NumField label="Speed base" bind:value={c.species.speed} min={0} max={200} />
    </div>
  {:else}
    <div class="facts small">
      <span>{t('Tamaño')} <b>{sp.size}</b></span>
      <span>Speed <b class="num">{sp.speed} ft</b></span>
      {#if sp.darkvision}<span>Darkvision <b class="num">{sp.darkvision} ft</b></span>{/if}
      {#if sp.languages.length}<span>{t('Idiomas')} <b>{sp.languages.join(', ')}</b></span>{/if}
    </div>

    {#if c.bonuses.species.length}
      <div class="bonuses">
        <span class="small muted">{t('Incrementos')}</span>
        {#each c.bonuses.species as b, i (i)}
          {@const locked = i < fixedCount && !custom}
          <div class="bonus">
            <b class="num">+{b.amount}</b>
            <select bind:value={c.bonuses.species[i].ability} disabled={locked} aria-label="Ability">
              {#each ABILITIES as a (a)}<option value={a} disabled={a !== b.ability && score(c, a) >= 20}>{ABILITY_LABEL[a]}{score(c, a) >= 20 ? ' (20)' : ''}</option>{/each}
            </select>
            {#if overCap(b.ability)}<span class="capwarn">{t('máx. 20')}</span>{/if}
          </div>
        {/each}
      </div>
      {#if fixedCount}
        <label class="check small">
          <input type="checkbox" bind:checked={custom} />
          <span>{t('Reasignar incrementos')} (Customizing Your Origin, Tasha's)</span>
        </label>
      {/if}
    {/if}

    {#if sp.originFeat}
      <p class="small accent">{t('Esta raza da un feat: elígelo en Clases y mejoras.')}</p>
    {/if}
    {#if sp.skillChoices}
      <p class="small accent">{t('Elige {n} skill(s) en Proficiencies.', { n: sp.skillChoices.count })}</p>
    {/if}

    {#if sp.traits.length}
      <button class="ghost small toggle" onclick={() => (showTraits = !showTraits)}>
        {showTraits ? t('Ocultar rasgos') : t('Ver rasgos')} ({sp.traits.length})
      </button>
      {#if showTraits}
        <ul class="traits small">
          {#each sp.traits as tr (tr.name)}<li><b>{tr.name}.</b> {tr.text}</li>{/each}
        </ul>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .capwarn {
    color: var(--bad);
    font-size: 0.75rem;
    font-weight: 600;
  }
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
