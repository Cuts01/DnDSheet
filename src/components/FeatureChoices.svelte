<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';
  import { ABILITY_LABEL } from '../lib/rules/tables';
  import type { ExtraChoice, FeatureChoiceSlot } from '../lib/rules/grants';
  import type { Ability } from '../lib/model/character';

  /* Elecciones de un class feature: opciones de una lista (maneuvers...), tools, idiomas y saves. */
  let { slot = null, extras = [] }: { slot?: FeatureChoiceSlot | null; extras?: ExtraChoice[] } = $props();

  let open = $state<string | null>(null);
  let showAll = $state(false);

  const available = $derived(slot ? slot.options.filter((o) => o.minLevel <= slot.level || slot.chosen.includes(o.name)) : []);
  const list = $derived(slot && !showAll && slot.chosen.length >= slot.count ? available.filter((o) => slot.chosen.includes(o.name)) : available);

  function toggle(key: string, name: string, count: number) {
    const cur = store.c.featureChoices[key] ?? [];
    if (cur.includes(name)) store.c.featureChoices[key] = cur.filter((x) => x !== name);
    else if (cur.length < count) store.c.featureChoices[key] = [...cur, name];
  }
  function setAt(key: string, i: number, value: string) {
    const cur = [...(store.c.featureChoices[key] ?? [])];
    cur[i] = value;
    store.c.featureChoices[key] = cur.filter(Boolean);
  }
  const label = (x: ExtraChoice, o: string) => (x.kind === 'save' ? ABILITY_LABEL[o as Ability] : o);
</script>

{#if slot}
  <div class="choose">
    <div class="head">
      <b>{slot.label}</b>
      <span class="count num" class:done={slot.chosen.length >= slot.count} class:over={slot.chosen.length > slot.count}>{slot.chosen.length}/{slot.count}</span>
    </div>
    {#if !slot.options.length}
      <p class="muted small">{t('Ningún pack trae la lista de opciones de este feature.')}</p>
    {:else}
      <ul class="opts">
        {#each list as o (o.name)}
          {@const on = slot.chosen.includes(o.name)}
          <li class:on>
            <button
              class="pick"
              aria-pressed={on}
              disabled={!on && slot.chosen.length >= slot.count}
              aria-label={on ? `${t('Quitar')} ${o.name}` : `${t('Elegir')} ${o.name}`}
              onclick={() => toggle(slot.featureId, o.name, slot.count)}>{on ? '●' : '○'}</button
            >
            <button class="ghost nm" aria-expanded={open === o.name} onclick={() => (open = open === o.name ? null : o.name)}>
              <span>{o.name}</span>
              {#if o.prerequisite}<small class="muted">{o.prerequisite}</small>{/if}
            </button>
          </li>
          {#if open === o.name && o.text}<li class="otext small">{o.text}</li>{/if}
        {/each}
      </ul>
      {#if slot.chosen.length >= slot.count}
        <button class="ghost small more" onclick={() => (showAll = !showAll)}>{showAll ? t('Ver solo las elegidas') : t('Cambiar elecciones')}</button>
      {/if}
    {/if}
  </div>
{/if}

{#each extras as x (x.key)}
  <div class="choose">
    <div class="head">
      <b>{x.kind === 'tool' ? 'Tool proficiency' : x.kind === 'language' ? t('Idioma') : 'Saving throw'}</b>
      <span class="count num" class:done={x.chosen.length >= x.count}>{x.chosen.length}/{x.count}</span>
    </div>
    {#if x.kind === 'save'}
      <div class="chips">
        {#each x.options as o (o)}
          {@const on = x.chosen.includes(o)}
          <button class="chip" class:on aria-pressed={on} disabled={!on && x.chosen.length >= x.count} onclick={() => toggle(x.key, o, x.count)}>{label(x, o)}</button>
        {/each}
      </div>
    {:else}
      {#each Array.from({ length: x.count }, (_, i) => i) as i (i)}
        {#if x.kind === 'tool'}
          <select value={x.chosen[i] ?? ''} onchange={(e) => setAt(x.key, i, e.currentTarget.value)} aria-label="Tool">
            <option value="">{t('Elegir...')}</option>
            {#each x.options as o (o)}<option value={o}>{o}</option>{/each}
          </select>
        {:else}
          <input
            value={x.chosen[i] ?? ''}
            list="std-languages"
            placeholder={t('Idioma')}
            aria-label={t('Idioma')}
            onchange={(e) => setAt(x.key, i, e.currentTarget.value.trim())}
          />
        {/if}
      {/each}
      {#if x.kind === 'language'}
        <datalist id="std-languages">{#each x.options as o (o)}<option value={o}></option>{/each}</datalist>
      {/if}
    {/if}
  </div>
{/each}

<style>
  .choose {
    margin: 0 0 12px 38px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .count {
    font-size: 0.8rem;
    padding: 1px 8px;
    border-radius: 999px;
    border: 1px solid var(--accent);
    color: var(--accent);
  }
  .count.done {
    border-color: var(--line);
    color: var(--muted);
  }
  .count.over {
    border-color: var(--bad);
    color: var(--bad);
  }
  .opts {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .opts li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pick {
    min-width: 40px;
    min-height: 40px;
    padding: 0;
    border-radius: 999px;
    color: var(--muted);
  }
  li.on .pick {
    color: var(--accent);
    border-color: var(--accent);
  }
  .nm {
    flex: 1;
    text-align: left;
    border: 0;
    padding: 4px 6px;
    min-height: 40px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
  }
  li.on .nm span {
    font-weight: 600;
  }
  .otext {
    padding: 0 6px 8px 52px;
    line-height: 1.45;
    color: var(--muted);
  }
  .more {
    align-self: flex-start;
    min-height: 36px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    min-height: 40px;
    border-radius: 999px;
  }
  .chip.on {
    background: var(--accent);
    color: var(--accent-ink);
    border-color: var(--accent);
  }
</style>
