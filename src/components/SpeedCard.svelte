<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';
  import { EFFECT_SOURCES, uid, type EffectSource } from '../lib/model/character';
  import { fmt, speed, speedParts } from '../lib/rules/derive';
  import NumField from './NumField.svelte';
  import { compendium } from '../lib/compendium.svelte';
  import { allGrantedEffects as grantedEffects } from '../lib/rules/features';

  const c = $derived(store.c);
  const granted = $derived(grantedEffects(c, compendium.packs));
  const parts = $derived(speedParts(c, granted));
  const auto = $derived(parts.filter((p) => p.kind === 'auto' || p.kind === 'feature'));
  const effects = $derived(store.c.effects.filter((e) => e.target === 'speed'));

  const sourceLabel: Record<EffectSource, string> = $derived({
    species: t('Raza'),
    class: t('Clase'),
    subclass: 'Subclass',
    feat: 'Feat',
    spell: 'Spell',
    item: 'Item',
    other: t('Otro')
  });

  function add() {
    store.c.effects.push({
      id: uid(),
      source: '',
      sourceType: 'feat',
      target: 'speed',
      value: 10,
      conditional: false,
      active: false
    });
  }

  function remove(id: string) {
    const i = store.c.effects.findIndex((e) => e.id === id);
    if (i >= 0) store.c.effects.splice(i, 1);
  }
</script>

<div class="card stack">
  <h2>Speed <span class="muted">· {t('total')} {speed(c, granted)} ft</span></h2>

  <div class="grid2">
    <label class="field"><span>{t('Raza')}</span><input value={store.c.species.name || t('Sin elegir')} disabled /></label>
    <NumField label="Speed base" bind:value={store.c.species.speed} min={0} max={200} />
  </div>

  {#if auto.length}
    <ul class="auto">
      {#each auto as p (p.effectId ?? p.label)}
        <li class:off={!p.active}>
          <span
            >{p.label}{#if p.note}<span class="muted small"> · {p.note}</span>{/if}{#if p.conditional}<span
                class="muted small"> · {p.active ? t('activo') : t('inactivo')}, {t('se cambia en Combate')}</span
              >{/if}</span
          >
          <b class="num">{fmt(p.value)}</b>
        </li>
      {/each}
    </ul>
    <p class="muted small">{t('Automático: según tus niveles, tu armadura y los features de tus packs.')}</p>
  {/if}

  {#each effects as e (e.id)}
    {@const i = store.c.effects.findIndex((x) => x.id === e.id)}
    <div class="effect">
      <label class="field name"><span>{t('Fuente')}</span><input bind:value={store.c.effects[i].source} placeholder={t('Ej. Mobile')} /></label>
      <label class="field">
        <span>{t('Tipo')}</span>
        <select bind:value={store.c.effects[i].sourceType}>
          {#each EFFECT_SOURCES as s (s)}<option value={s}>{sourceLabel[s]}</option>{/each}
        </select>
      </label>
      <NumField label="Bonus (ft)" bind:value={store.c.effects[i].value} min={-200} max={200} />
      <button class="danger ghost del" aria-label={`${t('Borrar')} ${e.source || t('efecto')}`} onclick={() => remove(e.id)}>✕</button>
      <label class="check full">
        <input type="checkbox" bind:checked={store.c.effects[i].conditional} />
        <span>{t('Condicional')} <span class="muted small">({t('se activa desde Combate, ej. Bladesong o Longstrider')})</span></span>
      </label>
    </div>
  {/each}

  <button onclick={add}>{t('Agregar bonus de speed')}</button>
  <p class="muted small">
    {t('Para feats, subclass, spells o items que cambian tu speed y que los packs no traen.')}
  </p>
</div>

<style>
  .card h2 {
    margin-bottom: 0;
  }
  p {
    margin: 0;
  }
  .grid2 {
    display: grid;
    gap: 8px;
    grid-template-columns: 1fr 1fr;
  }
  .auto {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .auto li {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    min-height: 36px;
    align-items: center;
    border-bottom: 1px solid var(--line);
  }
  .auto li.off b {
    text-decoration: line-through;
    color: var(--muted);
  }
  .effect {
    display: grid;
    grid-template-columns: 1fr 88px auto;
    gap: 8px;
    align-items: end;
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: 12px;
  }
  .effect .name,
  .effect .full {
    grid-column: 1 / -1;
  }
  @container (min-width: 460px) {
    .effect {
      grid-template-columns: 1fr 120px 88px auto;
    }
    .effect .name {
      grid-column: auto;
    }
  }
  .del {
    width: var(--tap);
    padding: 0;
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
</style>
