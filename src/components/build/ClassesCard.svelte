<script lang="ts">
  import { compendium } from '../../lib/compendium.svelte';
  import { ABILITIES, CASTER_TYPES, HIT_DICE, MAX_LEVEL, classFromPreset, uid, type Character } from '../../lib/model/character';
  import { casterLevel, totalLevel } from '../../lib/rules/derive';
  import { classChoices } from '../../lib/rules/features';
  import { ABILITY_LABEL } from '../../lib/rules/tables';
  import NumField from '../NumField.svelte';
  import SubclassField from '../SubclassField.svelte';

  let { c = $bindable() }: { c: Character } = $props();

  const choices = $derived(classChoices(compendium.packs, c.ruleset));
  const levelsLeft = $derived(MAX_LEVEL - totalLevel(c));
  let newClass = $state('');

  const casterLabel: Record<(typeof CASTER_TYPES)[number], string> = {
    none: 'No lanza spells',
    full: 'Full caster',
    half: 'Half caster',
    third: 'Third caster',
    artificer: 'Artificer (half, redondea arriba)',
    pact: 'Pact Magic'
  };

  function addClass() {
    if (!newClass || levelsLeft <= 0) return;
    const preset = choices.find((p) => p.name === newClass);
    c.classes.push(
      preset
        ? classFromPreset(preset)
        : { id: uid(), name: 'Clase', subclass: '', subclassId: null, level: 1, hitDie: 8, caster: 'none', spellAbility: null }
    );
    newClass = '';
  }

  function removeClass(i: number) {
    if (c.classes.length <= 1) return;
    if (confirm(`¿Quitar ${c.classes[i].name}?`)) c.classes.splice(i, 1);
  }

  // Cambiar la clase inicial desde la lista aplica su Hit Die, spellcasting y saves.
  function setFirst(name: string) {
    const p = choices.find((x) => x.name === name);
    if (!p) return;
    const k = c.classes[0];
    c.classes[0] = { ...classFromPreset(p, k.level), id: k.id };
    c.saves = [...p.saves];
    delete c.skillPicks.class;
  }
</script>

<div class="card stack">
  <h2>Clases <span class="muted">· nivel {totalLevel(c)}/{MAX_LEVEL} · caster level {casterLevel(c)}</span></h2>
  {#each c.classes as k, i (k.id)}
    <div class="class-row">
      <div class="grid2">
        {#if i === 0}
          <label class="field">
            <span>Clase inicial</span>
            <select value={choices.some((p) => p.name === k.name) ? k.name : ''} onchange={(e) => setFirst(e.currentTarget.value)}>
              {#if !choices.some((p) => p.name === k.name)}<option value="">{k.name || 'Personalizada'}</option>{/if}
              {#each choices as p (p.name)}<option value={p.name}>{p.name}</option>{/each}
            </select>
          </label>
        {:else}
          <label class="field"><span>Clase</span><input bind:value={k.name} list="class-names" /></label>
        {/if}
        <SubclassField bind:entry={c.classes[i]} ruleset={c.ruleset} />
      </div>
      <div class="grid4">
        <NumField label="Nivel" bind:value={k.level} min={1} max={k.level + levelsLeft} />
        <label class="field">
          <span>Hit Die</span>
          <select bind:value={k.hitDie}>
            {#each HIT_DICE as d (d)}<option value={d}>d{d}</option>{/each}
          </select>
        </label>
        <label class="field">
          <span>Spellcasting</span>
          <select bind:value={k.caster}>
            {#each CASTER_TYPES as t (t)}<option value={t}>{casterLabel[t]}</option>{/each}
          </select>
        </label>
        <label class="field">
          <span>Spell ability</span>
          <select bind:value={k.spellAbility}>
            <option value={null}>Ninguna</option>
            {#each ABILITIES as a (a)}<option value={a}>{ABILITY_LABEL[a]}</option>{/each}
          </select>
        </label>
      </div>
      {#if c.classes.length > 1}
        <button class="danger ghost remove" onclick={() => removeClass(i)}>Quitar clase</button>
      {/if}
    </div>
  {/each}
  <datalist id="class-names">
    {#each choices as p (p.name)}<option value={p.name}></option>{/each}
  </datalist>
  {#if levelsLeft > 0}
    <div class="row">
      <select bind:value={newClass} aria-label="Clase a agregar">
        <option value="">Agregar clase (multiclass)...</option>
        {#each choices as p (p.name)}<option value={p.name}>{p.name}</option>{/each}
        <option value="__custom">Personalizada</option>
      </select>
      <button onclick={addClass} disabled={!newClass}>Agregar</button>
    </div>
  {:else}
    <p class="muted small">Llegaste al nivel {MAX_LEVEL}: para agregar otra clase, baja niveles de una existente.</p>
  {/if}
  <p class="muted small">La clase inicial define el HP de nivel 1, los saves y las proficiencies completas.</p>
</div>

<style>
  .card h2 {
    margin-bottom: 0;
  }
  p {
    margin: 0;
  }
  .grid2,
  .grid4 {
    display: grid;
    gap: 8px;
    grid-template-columns: 1fr 1fr;
  }
  @container (min-width: 420px) {
    .grid4 {
      grid-template-columns: 0.7fr 0.7fr 1.3fr 1fr;
    }
  }
  .class-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: 12px;
  }
  .remove {
    align-self: flex-start;
  }
</style>
