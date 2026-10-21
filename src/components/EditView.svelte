<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import { onDestroy } from 'svelte';
  import { store } from '../lib/store.svelte';
  import { AC_MODES, uid } from '../lib/model/character';
  import { armorClassInfo, averageHp } from '../lib/rules/derive';
  import { clampUsage } from '../lib/rules/rests';
  import NumField from './NumField.svelte';
  import SpeedCard from './SpeedCard.svelte';
  import AbilitiesCard from './build/AbilitiesCard.svelte';
  import AdvancementsCard from './build/AdvancementsCard.svelte';
  import BackgroundCard from './build/BackgroundCard.svelte';
  import ClassesCard from './build/ClassesCard.svelte';
  import InvocationsCard from './build/InvocationsCard.svelte';
  import ProficienciesCard from './build/ProficienciesCard.svelte';
  import SpeciesCard from './build/SpeciesCard.svelte';

  type Section = 'origin' | 'classes' | 'profs' | 'other';
  const sections: [Section, string][] = [
    ['origin', 'Personaje'],
    ['classes', 'Clases y mejoras'],
    ['profs', 'Proficiencies'],
    ['other', 'Ajustes']
  ];

  let section = $state<Section>('origin');
  try {
    const saved = localStorage.getItem('hoja5e:edit-section') as Section | null;
    if (saved && sections.some(([s]) => s === saved)) section = saved;
  } catch {
    /* sin storage: queda la seccion por defecto */
  }
  function go(s: Section) {
    section = s;
    try {
      localStorage.setItem('hoja5e:edit-section', s);
    } catch {
      /* ignorar */
    }
  }

  const c = $derived(store.c);
  const ac = $derived(armorClassInfo(c));

  const acLabel: Record<(typeof AC_MODES)[number], string> = {
    auto: 'Automático (armor y shield del inventario)',
    unarmored: 'Sin armadura (10 + DEX)',
    'unarmored-con': 'Unarmored Defense, Barbarian (10 + DEX + CON)',
    'unarmored-wis': 'Unarmored Defense, Monk (10 + DEX + WIS)',
    'unarmored-cha': '10 + DEX + CHA (Draconic 2024, College of Dance, Noble Genies)',
    mage: 'Mage Armor (13 + DEX)',
    light: 'Light armor (base + DEX)',
    medium: 'Medium armor (base + DEX, máx. 2)',
    heavy: 'Heavy armor (base)',
    custom: 'Valor manual'
  };

  function addResource() {
    store.c.resources.push({ id: uid(), name: t('Nuevo recurso'), max: 1, used: 0, recharge: 'long' });
  }

  // Al salir de Editar, recorta consumos que quedaron por encima del nuevo maximo.
  onDestroy(() => store.apply(clampUsage));
</script>

<nav class="sections" aria-label={t('Secciones de edición')}>
  {#each sections as [id, label] (id)}
    <button class:on={section === id} aria-current={section === id ? 'true' : undefined} onclick={() => go(id)}>{t(label)}</button>
  {/each}
</nav>

<section class="edit">
  {#if section === 'origin'}
    <div class="card stack">
      <h2>General</h2>
      <label class="field"><span>{t('Nombre')}</span><input bind:value={store.c.name} /></label>
      <label class="field">
        <span>Ruleset</span>
        <select bind:value={store.c.ruleset}>
          <option value="2014">2014</option>
          <option value="2024">2024</option>
        </select>
      </label>
      <p class="muted small">{t('El ruleset filtra el contenido de los packs y ajusta reglas como el Long Rest.')}</p>
    </div>
    <SpeciesCard bind:c={store.c} />
    <BackgroundCard bind:c={store.c} />
    <AbilitiesCard bind:c={store.c} />
  {:else if section === 'classes'}
    <ClassesCard bind:c={store.c} />
    <AdvancementsCard bind:c={store.c} />
    <InvocationsCard bind:c={store.c} />
  {:else if section === 'profs'}
    <ProficienciesCard bind:c={store.c} />
  {:else}
    <div class="card stack">
      <h2>Hit Points</h2>
      <div class="grid2">
        <NumField label={t('HP máximo')} bind:value={store.c.hp.max} min={0} max={999} />
        <NumField label={t('HP actual')} bind:value={store.c.hp.current} min={-999} max={999} />
      </div>
      <div class="row">
        <span class="muted small spacer">{t('Promedio sugerido según clases y CON')}: <b class="num">{averageHp(c)}</b></span>
        <button onclick={() => (store.c.hp.max = averageHp(c))}>{t('Usar')}</button>
      </div>
    </div>

    <div class="card stack">
      <h2>{t('Defensa e iniciativa')} <span class="muted">· AC {ac.total}</span></h2>
      <label class="field">
        <span>{t('Cálculo de AC')}</span>
        <select bind:value={store.c.ac.mode}>
          {#each AC_MODES as m (m)}<option value={m}>{t(acLabel[m])}</option>{/each}
        </select>
      </label>
      {#if c.ac.mode === 'auto'}
        <p class="small muted">{t('Ahora')}: {ac.label}. {t('Equipa armor y shield en la pestaña Equipo.')}</p>
      {/if}
      <div class="grid3">
        {#if !['auto', 'unarmored', 'unarmored-con', 'unarmored-wis', 'unarmored-cha', 'mage'].includes(c.ac.mode)}
          <NumField label={c.ac.mode === 'custom' ? 'AC' : t('Base de la armadura')} bind:value={store.c.ac.base} min={0} max={30} />
        {/if}
        <NumField label="Bonus AC" bind:value={store.c.ac.bonus} min={-10} max={10} />
        <NumField label="Bonus initiative" bind:value={store.c.initiativeBonus} min={-10} max={20} />
      </div>
      {#if c.ac.mode !== 'auto'}
        <label class="check">
          <input type="checkbox" bind:checked={store.c.ac.shield} />
          <span>{t('Shield equipado (+2)')}</span>
        </label>
      {/if}
    </div>

    <SpeedCard />

    <div class="card stack">
      <h2>{t('Bonos de spellcasting')}</h2>
      <div class="grid2">
        <NumField label="Bonus spell attack" bind:value={store.c.spellBonus.attack} min={-10} max={10} />
        <NumField label="Bonus spell save DC" bind:value={store.c.spellBonus.dc} min={-10} max={10} />
      </div>
      <p class="muted small">{t('Para items mágicos que suben tu spell attack o tu DC.')}</p>
    </div>

    <div class="card stack">
      <h2>{t('Recursos con usos')}</h2>
      {#each store.c.resources as r, i (r.id)}
        <div class="res-row">
          <label class="field name"><span>{t('Nombre')}</span><input bind:value={r.name} /></label>
          <NumField label={t('Usos')} bind:value={r.max} min={0} max={99} />
          <label class="field">
            <span>{t('Se recupera')}</span>
            <select bind:value={r.recharge}>
              <option value="short">Short Rest</option>
              <option value="long">Long Rest</option>
              <option value="none">Manual</option>
            </select>
          </label>
          <button class="danger ghost" aria-label={`${t('Borrar')} ${r.name}`} onclick={() => store.c.resources.splice(i, 1)}>✕</button>
        </div>
      {/each}
      <button onclick={addResource}>{t('Agregar recurso')}</button>
      <p class="muted small">{t('Casts gratis de feats, Channel Divinity, Bladesong, cargas de items, etc.')}</p>
    </div>

    <div class="card stack">
      <h2>{t('Notas')}</h2>
      <textarea bind:value={store.c.notes} rows="6" placeholder={t('Aliados, pendientes, historia...')}></textarea>
    </div>
  {/if}
</section>

<style>
  .sections {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 2px 0 10px;
    scrollbar-width: none;
  }
  .sections button {
    flex-shrink: 0;
    min-height: 40px;
    border-radius: 999px;
    padding: 0 14px;
    font-size: 0.9rem;
    color: var(--muted);
  }
  .sections button.on {
    color: var(--accent-ink);
    background: var(--accent);
    border-color: var(--accent);
    font-weight: 650;
  }
  .edit {
    display: grid;
    gap: var(--gap);
  }
  @container (min-width: 760px) {
    .edit {
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
  .grid2,
  .grid3 {
    display: grid;
    gap: 8px;
    grid-template-columns: 1fr 1fr;
  }
  .grid3 {
    grid-template-columns: repeat(3, 1fr);
  }
  .res-row {
    display: grid;
    grid-template-columns: 72px 1fr auto;
    gap: 8px;
    align-items: end;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--line);
  }
  .res-row .name {
    grid-column: 1 / -1;
  }
  .res-row button {
    width: var(--tap);
    padding: 0;
  }
  @container (min-width: 420px) {
    .res-row {
      grid-template-columns: 1fr 72px 140px auto;
    }
    .res-row .name {
      grid-column: auto;
    }
  }
  .check {
    display: flex;
    gap: 10px;
    align-items: center;
    min-height: var(--tap);
  }
  .check input {
    width: 22px;
    min-height: 22px;
    accent-color: var(--accent);
  }
</style>
