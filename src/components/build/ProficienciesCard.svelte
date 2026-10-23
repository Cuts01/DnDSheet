<script lang="ts">
  import { t } from '../../lib/i18n.svelte';
  import { compendium } from '../../lib/compendium.svelte';
  import { ABILITIES, type Character, type ProfLevel } from '../../lib/model/character';
  import { fmt, skillBonus, skillLevel, skillSources, toolExpertise } from '../../lib/rules/derive';
  import { slug } from '../../lib/model/pack';
  import { proficiencies, skillChoiceSlots } from '../../lib/rules/features';
  import { ABILITY_LABEL, SKILLS } from '../../lib/rules/tables';

  let { c = $bindable() }: { c: Character } = $props();

  const slots = $derived(skillChoiceSlots(c, compendium.packs));
  const profs = $derived(proficiencies(c, compendium.packs));
  const toolName = (id: string) => profs.tools.find((x) => slug(x) === id.slice(5)) ?? id.slice(5);
  const skillName = (id: string) => (id.startsWith('tool:') ? toolName(id) : (SKILLS.find((s) => s.id === id)?.name ?? id));
  const toolX = $derived(toolExpertise(c));
  const srcName: Record<string, string> = {
    class: 'clase',
    species: 'raza',
    'species-choice': 'raza',
    background: 'background',
    'background-choice': 'background'
  };
  const srcLabel = (x: string) => (x.startsWith('feat') ? 'feat' : t(srcName[x] ?? 'otro'));
  const mark: Record<ProfLevel, string> = { none: '', prof: '●', expertise: '◆' };

  // Fuentes con skills fijas que se pueden reemplazar si quedan repetidas (regla de backgrounds y razas).
  const fixedSources: [string, string][] = [
    ['background', 'Background'],
    ['species', 'Raza']
  ];
  const sourcesOf = (id: string) => skillSources(c, id);
  const otherHas = (src: string, id: string) => sourcesOf(id).some((s) => s !== src);

  function replaceFixed(src: string, i: number, id: string) {
    const list = [...(c.skillPicks[src] ?? [])];
    list[i] = id;
    c.skillPicks[src] = list;
  }

  function togglePick(source: string, id: string, count: number) {
    const list = c.skillPicks[source] ?? [];
    if (list.includes(id)) c.skillPicks[source] = list.filter((x) => x !== id);
    else if (list.length < count) c.skillPicks[source] = [...list, id];
  }

  // Tocar una skill: si ya es proficient por una fuente, alterna expertise; si no, none, prof, expertise.
  function cycle(id: string) {
    const derived = skillSources(c, id).length > 0;
    const cur = c.skills[id];
    const order: (ProfLevel | undefined)[] = derived ? [undefined, 'expertise'] : [undefined, 'prof', 'expertise'];
    const next = order[(order.indexOf(cur) + 1) % order.length];
    if (next === undefined) delete c.skills[id];
    else c.skills[id] = next;
  }

  function toggleSave(a: (typeof ABILITIES)[number]) {
    const i = c.saves.indexOf(a);
    if (i >= 0) c.saves.splice(i, 1);
    else c.saves.push(a);
  }

  type Kind = 'armor' | 'weapons' | 'tools' | 'languages';
  const kinds: [Kind, string][] = [
    ['armor', 'Armor'],
    ['weapons', 'Weapons'],
    ['tools', 'Tools'],
    ['languages', 'Idiomas']
  ];
  let adding = $state<Record<Kind, string>>({ armor: '', weapons: '', tools: '', languages: '' });
  function addExtra(k: Kind) {
    const v = adding[k].trim();
    if (!v) return;
    if (!c.extraProficiencies[k].includes(v)) c.extraProficiencies[k].push(v);
    adding[k] = '';
  }
</script>

<div class="card stack">
  <h2>Skills</h2>
  {#each fixedSources as [src, label] (src)}
    {@const list = c.skillPicks[src] ?? []}
    {#if list.length}
      <div class="slot">
        <span class="small"><b>{t(label)}</b>: {t('skills otorgadas')}</span>
        <div class="fixed">
          {#each list as id, i (i)}
            <div class="fx" class:dup={otherHas(src, id)}>
              <select value={id} onchange={(e) => replaceFixed(src, i, e.currentTarget.value)} aria-label={`Skill ${i + 1} · ${t(label)}`}>
                {#each SKILLS as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
              </select>
              {#if otherHas(src, id)}<span class="small">{t('Repetida: puedes cambiarla por otra')}</span>{/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/each}

  {#each slots as s (s.source)}
    {@const picked = c.skillPicks[s.source] ?? []}
    <div class="slot">
      <span class="small">
        <b>{t(s.label)}</b>: {t('elige')} {s.count}
        <span class="muted">({picked.length}/{s.count})</span>
      </span>
      <div class="chips">
        {#each s.from.length ? s.from : SKILLS.map((x) => x.id) as id (id)}
          {@const on = picked.includes(id)}
          {@const dupOk = s.mode === 'either' || s.mode === 'expertise' || s.mode === 'upgrade'}
          <button
            class="chip"
            class:on
            class:taken={!dupOk && !on && otherHas(s.source, id)}
            disabled={!on && picked.length >= s.count}
            title={!dupOk && !on && otherHas(s.source, id) ? t('Ya la tienes por otra fuente') : undefined}
            onclick={() => togglePick(s.source, id, s.count)}
          >
            {skillName(id)}{on && otherHas(s.source, id) ? (dupOk ? ' (expertise)' : ` (${t('repetida')})`) : ''}
          </button>
        {/each}
      </div>
    </div>
  {/each}

  <div class="skill-grid">
    {#each SKILLS as s (s.id)}
      {@const lvl = skillLevel(c, s)}
      {@const src = skillSources(c, s.id)}
      <button class="skill" class:on={lvl !== 'none'} onclick={() => cycle(s.id)}>
        <span class="mark">{mark[lvl]}</span>
        <span class="name">
          {s.name}
          {#if src.length}<small class="muted">{[...new Set(src.map(srcLabel))].join(', ')}</small>{/if}
        </span>
        <span class="num">{fmt(skillBonus(c, s))}</span>
      </button>
    {/each}
  </div>
  <p class="muted small">{t('Toca una skill para marcar expertise o agregar una proficiency extra.')} ● proficient · ◆ expertise</p>

  <h2>Saving throws</h2>
  <div class="saves">
    {#each ABILITIES as a (a)}
      {@const auto = c.autoSaves.includes(a) && !c.saves.includes(a)}
      <button
        class="chip big"
        class:on={c.saves.includes(a) || auto}
        aria-pressed={c.saves.includes(a) || auto}
        disabled={auto}
        title={auto ? t('Lo da un class feature') : undefined}
        onclick={() => toggleSave(a)}
      >
        {ABILITY_LABEL[a]}{auto ? ' ★' : ''}
      </button>
    {/each}
  </div>

  <h2>{t('Otras proficiencies')}</h2>
  {#each kinds as [k, label] (k)}
    <div class="prof">
      <span class="small muted">{t(label)}</span>
      <div class="chips">
        {#each profs[k] as p (p)}
          {@const extra = c.extraProficiencies[k].includes(p)}
          <span class="tag" class:extra>
            {p}{k === 'tools' && toolX.has(`tool:${slug(p)}`) ? ' ◆' : ''}
            {#if extra}<button class="x" aria-label={`${t('Quitar')} ${p}`} onclick={() => (c.extraProficiencies[k] = c.extraProficiencies[k].filter((x) => x !== p))}>✕</button>{/if}
          </span>
        {:else}
          <span class="muted small">{t('Ninguna')}</span>
        {/each}
      </div>
      <div class="row">
        <input bind:value={adding[k]} placeholder={t('Agregar...')} aria-label={`${t('Agregar')} ${t(label)}`} onkeydown={(e) => e.key === 'Enter' && addExtra(k)} />
        <button onclick={() => addExtra(k)}>+</button>
      </div>
    </div>
  {/each}
  <p class="muted small">{t('Las de clase, raza y background se calculan solas desde los packs. Las que agregues aquí se suman.')}</p>
</div>

<style>
  .card h2 {
    margin-bottom: 0;
  }
  p {
    margin: 0;
  }
  .slot {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: 12px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    min-height: 36px;
    padding: 0 12px;
    font-size: 0.85rem;
    border-radius: 999px;
  }
  .chip.big {
    min-height: var(--tap);
    border-radius: 10px;
    padding: 0;
    font-weight: 600;
  }
  .chip.on,
  .skill.on {
    border-color: var(--accent);
    color: var(--accent);
  }
  .chip.taken {
    opacity: 0.45;
    text-decoration: line-through;
  }
  .fixed {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .fx {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
  }
  .fx select {
    width: auto;
    min-width: 180px;
    min-height: 40px;
  }
  .fx.dup select {
    border-color: var(--accent);
  }
  .fx.dup span {
    color: var(--accent);
  }
  .saves {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
  }
  .skill-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 6px;
  }
  .skill {
    display: grid;
    grid-template-columns: 18px 1fr auto;
    gap: 6px;
    text-align: left;
    padding: 4px 10px;
    font-size: 0.9rem;
  }
  .skill .name {
    display: flex;
    flex-direction: column;
    line-height: 1.15;
  }
  .skill small {
    font-size: 0.7rem;
  }
  .prof {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.85rem;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--surface-2);
  }
  .tag.extra {
    border: 1px dashed var(--accent);
  }
  .x {
    min-height: 24px;
    width: 24px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--muted);
  }
  .row input {
    min-height: 40px;
  }
  .row button {
    min-height: 40px;
    width: 44px;
    padding: 0;
  }
</style>
