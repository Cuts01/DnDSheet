<script lang="ts">
  import { compendium } from '../../lib/compendium.svelte';
  import type { Ability, Character } from '../../lib/model/character';
  import { applyBackground, backgroundList, findBackground } from '../../lib/rules/features';
  import { ABILITY_LABEL } from '../../lib/rules/tables';
  import RefSelect from './RefSelect.svelte';

  let { c = $bindable() }: { c: Character } = $props();

  const options = $derived(backgroundList(compendium.packs, c.ruleset));
  const bg = $derived(findBackground(compendium.packs, c.background.ref)?.item ?? null);
  const split = $derived(c.bonuses.background.length === 3 ? 'three' : 'two');
  let showTraits = $state(false);

  function pick(r: Parameters<typeof applyBackground>[1]) {
    c = applyBackground($state.snapshot(c) as Character, r, compendium.packs);
  }

  // 2024: +2/+1 entre dos de las tres abilities del background, o +1 a las tres.
  function setSplit(mode: 'two' | 'three') {
    if (!bg) return;
    c.bonuses.background =
      mode === 'three'
        ? bg.asi.map((a) => ({ ability: a, amount: 1 }))
        : [
            { ability: bg.asi[0], amount: 2 },
            { ability: bg.asi[1], amount: 1 }
          ];
  }
  function setPlus(i: number, a: Ability) {
    const other = c.bonuses.background[1 - i];
    if (other && other.ability === a) other.ability = c.bonuses.background[i].ability;
    c.bonuses.background[i].ability = a;
  }
</script>

<div class="card stack">
  <h2>Background</h2>
  {#if options.length}
    <RefSelect {options} value={c.background.ref} label="Background" onpick={pick} />
  {:else}
    <label class="field"><span>Background</span><input bind:value={c.background.name} placeholder="Importa un pack para elegir de una lista" /></label>
  {/if}

  {#if bg}
    <div class="facts small">
      {#if bg.skills.length}<span>Skills <b>{bg.skills.join(', ')}</b></span>{/if}
      {#if bg.tools.length}<span>Tools <b>{bg.tools.join(', ')}</b></span>{/if}
      {#if bg.languages.length}<span>Idiomas <b>{bg.languages.join(', ')}</b></span>{/if}
      {#if bg.feat}<span>Origin feat <b>{bg.feat}</b></span>{/if}
    </div>

    {#if bg.asi.length >= 3}
      <div class="stack tight">
        <span class="small muted">Incrementos: {bg.asi.map((a) => ABILITY_LABEL[a]).join(', ')}</span>
        <div class="seg">
          <button class:on={split === 'two'} onclick={() => setSplit('two')}>+2 / +1</button>
          <button class:on={split === 'three'} onclick={() => setSplit('three')}>+1 / +1 / +1</button>
        </div>
        {#if split === 'two'}
          <div class="row">
            {#each c.bonuses.background as b, i (i)}
              <div class="bonus">
                <b class="num">+{b.amount}</b>
                <select value={b.ability} onchange={(e) => setPlus(i, e.currentTarget.value as Ability)} aria-label="Ability">
                  {#each bg.asi as a (a)}<option value={a}>{ABILITY_LABEL[a]}</option>{/each}
                </select>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    {#if bg.skillChoices}
      <p class="small accent">Elige {bg.skillChoices.count} skill(s) en Proficiencies.</p>
    {/if}

    {#if bg.traits.length || bg.equipment}
      <button class="ghost small toggle" onclick={() => (showTraits = !showTraits)}>{showTraits ? 'Ocultar' : 'Ver'} detalle</button>
      {#if showTraits}
        <ul class="traits small">
          {#each bg.traits as t (t.name)}<li><b>{t.name}.</b> {t.text}</li>{/each}
          {#if bg.equipment}<li><b>Equipo.</b> {bg.equipment}</li>{/if}
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
  .tight {
    gap: 6px;
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
  }
  .seg {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    background: var(--bg);
    padding: 4px;
    border-radius: 12px;
  }
  .seg button {
    border: none;
    background: transparent;
    min-height: 40px;
  }
  .seg button.on {
    background: var(--surface-2);
    color: var(--accent);
    font-weight: 650;
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
