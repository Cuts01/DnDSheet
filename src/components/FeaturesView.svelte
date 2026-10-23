<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';
  import { compendium } from '../lib/compendium.svelte';
  import { characterFeatures, findBackground, findFeat, findInvocation, findSpecies } from '../lib/rules/features';
  import { asiSlots } from '../lib/rules/derive';
  import { EFFECT_LABEL } from '../lib/model/character';
  import { extraChoices, featureChoiceSlots, featureResources, featureSkillSlots } from '../lib/rules/grants';
  import FeatureChoices from './FeatureChoices.svelte';

  let showNext = $state(false);
  const slots = $derived(new Map(featureChoiceSlots(store.c, compendium.packs).map((x) => [x.featureId, x])));
  const extras = $derived(extraChoices(store.c, compendium.packs));
  const allRes = $derived(featureResources(store.c, compendium.packs));
  const resources = $derived(new Map(allRes.map((r) => [r.featureId, r])));
  const resLine = (r: (typeof allRes)[number]) =>
    `${r.max}${r.die ? ` × ${r.die}` : ''} · ${r.recharge === 'short' ? 'Short Rest' : r.recharge === 'short1' ? t('1 por Short Rest, todos por Long Rest') : 'Long Rest'}`;
  // Skills a elección de features: se eligen en Editar > Proficiencies; aquí solo se avisa si falta.
  const skillSlots = $derived(featureSkillSlots(store.c, compendium.packs));
  const skillPending = (fid: string) =>
    skillSlots.filter((s) => s.source.includes(`|${fid}|`)).reduce((n, s) => n + Math.max(0, s.count - (store.c.skillPicks[s.source]?.length ?? 0)), 0);
  const extrasOf = (fid: string) => extras.filter((x) => x.key.startsWith(`${fid}#`));
  const pending = (fid: string) => {
    const sl = slots.get(fid);
    return (
      (sl ? Math.max(0, sl.count - sl.chosen.length) : 0) +
      extrasOf(fid).reduce((n, x) => n + Math.max(0, x.count - x.chosen.length), 0) +
      skillPending(fid)
    );
  };
  const grantLine = (f: (typeof groups)[number]['features'][number]['feature']) => {
    const g = f.grants;
    if (!g) return '';
    const parts = [
      g.skills.length ? `Skills: ${g.skills.join(', ')}` : '',
      g.expertise.length ? `Expertise: ${g.expertise.join(', ')}` : '',
      g.armor.length ? `Armor: ${g.armor.join(', ')}` : '',
      g.weapons.length ? `Weapons: ${g.weapons.join(', ')}` : '',
      g.tools.length ? `Tools: ${g.tools.join(', ')}` : '',
      g.languages.length ? `${t('Idiomas')}: ${g.languages.join(', ')}` : '',
      g.saves.length ? `Saves: ${g.saves.map((a) => a.toUpperCase()).join(', ')}` : ''
    ].filter(Boolean);
    return parts.join(' · ');
  };
  const groups = $derived(characterFeatures(store.c, compendium.packs));
  const nothing = $derived(compendium.packs.length === 0);
  const sp = $derived(findSpecies(compendium.packs, store.c.species.ref)?.item ?? null);
  const bg = $derived(findBackground(compendium.packs, store.c.background.ref)?.item ?? null);
  // Feats de ASI (solo niveles alcanzados) y feats de otras fuentes, con su texto si estan en un pack.
  const featRows = $derived.by(() => {
    const slots = new Map(asiSlots(store.c).map((s) => [s.key, s]));
    const rows: { key: string; name: string; tag: string; text: string; prereq: string }[] = [];
    for (const [key, a] of Object.entries(store.c.advancements)) {
      const slot = slots.get(key);
      if (!slot || a.kind !== 'feat' || !(a.featRef || a.featName)) continue;
      const f = findFeat(compendium.packs, a.featRef)?.item;
      rows.push({ key, name: f?.name ?? a.featName, tag: `${slot.className} ${slot.level}`, text: f?.text ?? '', prereq: f?.prerequisite ?? '' });
    }
    for (const e of store.c.feats) {
      if (!e.ref && !e.name) continue;
      const f = findFeat(compendium.packs, e.ref)?.item;
      rows.push({ key: e.id, name: f?.name ?? e.name, tag: e.source === 'species' ? t('raza') : e.source === 'background' ? 'background' : 'extra', text: f?.text ?? '', prereq: f?.prerequisite ?? '' });
    }
    return rows;
  });
  const invRows = $derived(
    store.c.invocations
      .filter((i) => i.ref || i.name)
      .map((i) => {
        const f = findInvocation(compendium.packs, i.ref)?.item;
        return { key: i.id, name: f?.name ?? i.name, text: f?.text ?? '', prereq: f?.prerequisite ?? '' };
      })
  );
</script>

<section class="features">
  {#if nothing}
    <div class="card stack">
      <h2>{t('Rasgos')}</h2>
      <p class="small">{t('Aún no hay contenido importado. En Datos importa un pack con clases y subclasses para ver aquí tus class features por nivel.')}</p>
    </div>
  {/if}

  <label class="check">
    <input type="checkbox" bind:checked={showNext} />
    <span>{t('Mostrar también los features de niveles siguientes')}</span>
  </label>

  {#if sp || bg}
    <div class="card stack">
      <h2>{t('Origen')}</h2>
      {#if sp}
        {#each sp.traits as tr (tr.name)}
          <details class="feat">
            <summary><span class="lvl num">R</span><span class="name">{tr.name}</span><span class="tag">{sp.name}</span></summary>
            <div class="text">{tr.text}</div>
          </details>
        {/each}
      {/if}
      {#if bg}
        {#each bg.traits as tr (tr.name)}
          <details class="feat">
            <summary><span class="lvl num">B</span><span class="name">{tr.name}</span><span class="tag">{bg.name}</span></summary>
            <div class="text">{tr.text}</div>
          </details>
        {/each}
      {/if}
    </div>
  {/if}

  {#if featRows.length}
    <div class="card stack">
      <h2>Feats</h2>
      {#each featRows as f (f.key)}
        <details class="feat">
          <summary>
            <span class="lvl num">F</span><span class="name">{f.name}</span>
            {#if slots.get(`feat:${f.key}`) && slots.get(`feat:${f.key}`)!.chosen.length < slots.get(`feat:${f.key}`)!.count}<span class="tag todo">{t('elegir {n}', { n: slots.get(`feat:${f.key}`)!.count - slots.get(`feat:${f.key}`)!.chosen.length })}</span>{/if}
            <span class="tag">{f.tag}</span>
          </summary>
          {#if f.prereq}<div class="text muted small">{t('Requisito')}: {f.prereq}</div>{/if}
          <div class="text">{f.text || t('Sin texto.')}</div>
          {#each allRes.filter((r) => r.featureId === `feat:${f.key}`) as r (r.key)}
            <p class="grant small"><b>{r.name}</b>: {resLine(r)}</p>
          {/each}
          <FeatureChoices slot={slots.get(`feat:${f.key}`) ?? null} />
        </details>
      {/each}
    </div>
  {/if}

  {#if invRows.length}
    <div class="card stack">
      <h2>Eldritch Invocations</h2>
      {#each invRows as f (f.key)}
        <details class="feat">
          <summary><span class="lvl num">I</span><span class="name">{f.name}</span></summary>
          {#if f.prereq}<div class="text muted small">{t('Requisito')}: {f.prereq}</div>{/if}
          <div class="text">{f.text || t('Sin texto.')}</div>
        </details>
      {/each}
    </div>
  {/if}

  {#each groups as g (g.entry.id)}
    {@const list = g.features.filter((f) => showNext || f.owned)}
    <div class="card stack">
      <h2>
        {g.entry.name}
        {g.entry.level}{#if g.entry.subclass}<span class="muted">&nbsp;· {g.entry.subclass}</span>{/if}
      </h2>

      {#if !g.cls && !g.sub && !nothing}
        <p class="muted small">{t('Ningún pack tiene la clase "{name}" ni una subclass elegida para ella.', { name: g.entry.name })}</p>
      {/if}
      {#if g.cls && !g.sub && g.entry.level >= g.subclassLevel}
        <p class="warn small">{t('Elige tu {label} en Editar para ver sus features.', { label: g.subclassLabel })}</p>
      {/if}
      {#if g.entry.subclass && !g.sub}
        <p class="muted small">{t('"{name}" está en texto libre: sus features no se cargan solos.', { name: g.entry.subclass })}</p>
      {/if}

      {#each list as f (f.feature.id)}
        <details class="feat" class:next={!f.owned}>
          <summary>
            <span class="lvl num">{f.feature.level}</span>
            <span class="name">{f.feature.name}</span>
            {#if f.source === 'subclass'}<span class="tag">{f.sourceName}</span>{/if}
            {#if f.owned && pending(f.feature.id) > 0 && !/\(optional\)/i.test(f.feature.name)}<span class="tag todo">{t('elegir {n}', { n: pending(f.feature.id) })}</span>
            {:else if f.feature.effects.length}<span class="tag fx">{t('efecto')}</span>{/if}
          </summary>
          {#if f.feature.text}
            <div class="text">{f.feature.text}</div>
          {:else}
            <div class="text muted">{t('Sin texto.')}</div>
          {/if}
          {#if f.owned}
            {@const res = resources.get(f.feature.id)}
            {@const gl = grantLine(f.feature)}
            {#if res || gl}
              <p class="grant small">
                {#if res}<b>{res.name}</b>: {res.max}{res.die ? ` × ${res.die}` : ''} · {res.recharge === 'short' ? 'Short Rest' : res.recharge === 'short1' ? t('1 por Short Rest, todos por Long Rest') : 'Long Rest'}{gl ? ' · ' : ''}{/if}{gl}
              </p>
            {/if}
            {#if skillPending(f.feature.id) > 0}<p class="grant small todo">{t('Elige las skills en Editar > Proficiencies.')}</p>{/if}
            <FeatureChoices slot={slots.get(f.feature.id) ?? null} extras={extrasOf(f.feature.id)} />
          {/if}
          {#if f.feature.effects.length}
            <ul class="fx-list small">
              {#each f.feature.effects as e, i (i)}
                <li>{EFFECT_LABEL[e.target]} {e.value >= 0 ? '+' : ''}{e.value}{e.target === 'speed' ? ' ft' : ''}{e.conditional ? ` (${t('se activa desde Combate')})` : ''}</li>
              {/each}
            </ul>
          {/if}
        </details>
      {:else}
        {#if g.cls || g.sub}<p class="muted small">{t('Sin features en estos niveles.')}</p>{/if}
      {/each}
    </div>
  {/each}
</section>

<style>
  .features {
    display: grid;
    gap: var(--gap);
    align-items: start;
  }
  @container (min-width: 760px) {
    .features {
      grid-template-columns: 1fr 1fr;
    }
    .features > .check,
    .features > .card:first-child {
      grid-column: 1 / -1;
    }
  }
  .card h2 {
    margin-bottom: 0;
    text-transform: none;
    letter-spacing: 0;
    font-size: 1rem;
    color: var(--text);
  }
  p {
    margin: 0;
  }
  .warn {
    color: var(--accent);
  }
  .check {
    display: flex;
    gap: 10px;
    align-items: center;
    min-height: var(--tap);
    padding: 0 4px;
  }
  .check input {
    width: 22px;
    min-height: 22px;
    accent-color: var(--accent);
  }
  .feat {
    border-top: 1px solid var(--line);
    padding-top: 2px;
  }
  .feat.next {
    opacity: 0.5;
  }
  summary {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: var(--tap);
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .lvl {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: var(--surface-2);
    font-weight: 700;
    font-size: 0.85rem;
  }
  .name {
    flex: 1;
    font-weight: 600;
  }
  .tag {
    font-size: 0.72rem;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid var(--line);
    color: var(--muted);
    white-space: nowrap;
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tag.fx {
    color: var(--good);
    border-color: color-mix(in srgb, var(--good) 40%, transparent);
  }
  .text {
    white-space: pre-line;
    line-height: 1.5;
    padding: 0 0 12px 38px;
    font-size: 0.95rem;
  }
  .tag.todo {
    color: var(--accent);
    border-color: var(--accent);
  }
  .grant {
    margin: -6px 0 12px 38px;
    color: var(--good);
  }
  .grant.todo {
    color: var(--accent);
  }
  .fx-list {
    margin: -6px 0 12px 38px;
    padding-left: 18px;
    color: var(--good);
  }
</style>
