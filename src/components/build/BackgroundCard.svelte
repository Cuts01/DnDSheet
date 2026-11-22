<script lang="ts">
  import LockButton from '../LockButton.svelte';
  import { t } from '../../lib/i18n.svelte';
  import { compendium } from '../../lib/compendium.svelte';
  import type { Ability, Character } from '../../lib/model/character';
  import { applyBackground, backgroundList, findBackground } from '../../lib/rules/features';
  import { ABILITY_LABEL } from '../../lib/rules/tables';
  import RefSelect from './RefSelect.svelte';
  import { applyStartingGear, parseEquipment, undoStartingGear } from '../../lib/rules/startingGear';
  import { score, scoreBreakdown } from '../../lib/rules/derive';

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
  // Incremento que no cuenta porque la ability ya llegó a 20.
  const overCap = (a: Ability | null | undefined) => !!a && scoreBreakdown(c, a).capped > 0;
</script>

<div class="card stack">
  <div class="title-row">
    <h2>Background</h2>
    <LockButton bind:locked={c.locks.background} what={'background'} />
  </div>
  <fieldset class="lockable stack" disabled={!!c.locks.background}>
  {#if options.length}
    <RefSelect {options} value={c.background.ref} label="Background" onpick={pick} />
  {:else}
    <label class="field"><span>Background</span><input bind:value={c.background.name} placeholder={t('Importa un pack para elegir de una lista')} /></label>
  {/if}

  {#if bg}
    <div class="facts small">
      {#if bg.skills.length}<span>Skills <b>{bg.skills.join(', ')}</b></span>{/if}
      {#if bg.tools.length}<span>Tools <b>{bg.tools.join(', ')}</b></span>{/if}
      {#if bg.languages.length}<span>{t('Idiomas')} <b>{bg.languages.join(', ')}</b></span>{/if}
      {#if bg.feat}<span>Origin feat <b>{bg.feat}</b></span>{/if}
    </div>

    {#if bg.asi.length >= 3}
      <div class="stack tight">
        <span class="small muted">{t('Incrementos')}: {bg.asi.map((a) => ABILITY_LABEL[a]).join(', ')}</span>
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
                  {#each bg.asi as a (a)}<option value={a} disabled={a !== b.ability && score(c, a) >= 20}>{ABILITY_LABEL[a]}{score(c, a) >= 20 ? ' (20)' : ''}</option>{/each}
                </select>
            {#if overCap(b.ability)}<span class="capwarn">{t('máx. 20')}</span>{/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    {#if bg.equipment}
      {@const plan = parseEquipment(bg.equipment)}
      {@const g = c.startingGear}
      <div class="gear">
        <span class="small muted">{t('Equipo inicial')}</span>
        <div class="gear-opts" role="radiogroup" aria-label={t('Equipo inicial')}>
          <button class="opt" class:on={g.choice === 'A'} role="radio" aria-checked={g.choice === 'A'} onclick={() => (c = applyStartingGear($state.snapshot(c) as Character, bg.equipment, 'A', compendium.packs))}>
            <b>{plan.alt != null ? 'A · ' : ''}{t('El equipo')}</b>
            <small>{plan.items.map((i) => (i.qty > 1 ? `${i.qty} ${i.name}` : i.name)).join(', ')}{plan.gp ? `, ${plan.gp} GP` : ''}</small>
          </button>
          {#if plan.alt != null}
            <button class="opt" class:on={g.choice === 'B'} role="radio" aria-checked={g.choice === 'B'} onclick={() => (c = applyStartingGear($state.snapshot(c) as Character, bg.equipment, 'B', compendium.packs))}>
              <b>B · {plan.alt} GP</b>
              <small>{t('Compras tu equipo por tu cuenta')}</small>
            </button>
          {/if}
        </div>
        {#if g.choice}
          <p class="small muted">
            {g.choice === 'A' ? t('Agregado a tu inventario ({n} objetos y {gp} GP).', { n: g.itemIds.length, gp: g.gp }) : t('Sumado a tus monedas: {gp} GP.', { gp: g.gp })}
            <button class="ghost linkish" onclick={() => (c = undoStartingGear($state.snapshot(c) as Character))}>{t('Deshacer')}</button>
          </p>
        {:else}
          <p class="small accent">{plan.alt != null ? t('Elige A o B: se carga en tu inventario y tus monedas.') : t('Toca para cargarlo en tu inventario.')}</p>
        {/if}
      </div>
    {/if}

    {#if bg.skillChoices}
      <p class="small accent">{t('Elige {n} skill(s) en Proficiencies.', { n: bg.skillChoices.count })}</p>
    {/if}

    {#if bg.traits.length || bg.equipment}
      <button class="ghost small toggle" onclick={() => (showTraits = !showTraits)}>{showTraits ? t('Ocultar detalle') : t('Ver detalle')}</button>
      {#if showTraits}
        <ul class="traits small">
          {#each bg.traits as tr (tr.name)}<li><b>{tr.name}.</b> {tr.text}</li>{/each}
          {#if bg.equipment}<li><b>{t('Equipo')}.</b> {bg.equipment}</li>{/if}
        </ul>
      {/if}
    {/if}
  {/if}
  </fieldset>

</div>

<style>
  .gear {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .gear p {
    margin: 0;
  }
  .gear-opts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 8px;
  }
  .opt {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    text-align: left;
    padding: 10px 12px;
    min-height: 0;
    border-radius: 12px;
  }
  .opt small {
    color: var(--muted);
    line-height: 1.35;
  }
  .opt.on {
    border-color: var(--accent);
    background: var(--surface-2);
  }
  .opt.on b {
    color: var(--accent);
  }
  .linkish {
    min-height: 0;
    padding: 0 4px;
    color: var(--accent);
    text-decoration: underline;
  }
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
