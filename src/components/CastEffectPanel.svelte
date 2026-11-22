<script lang="ts">
  import { untrack } from 'svelte';
  import { t } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';
  import { crLabel, gainTemp, rollDice, takeShape, type CastEffect } from '../lib/rules/castEffects';
  import type { Beast } from '../lib/data/beasts';

  /* Lo que el spell hace en la hoja al lanzarlo: temp HP con dados (False Life) o elegir forma (Polymorph). */
  let { name, effect, onclose }: { name: string; effect: CastEffect; onclose: () => void } = $props();

  const roll = () => (effect.kind === 'tempRoll' ? rollDice(effect.count, effect.sides) + effect.bonus : 0);
  let value = $state(untrack(roll));
  function applyTemp() {
    store.apply((x) => gainTemp(x, value));
    onclose();
  }

  let self = $state(true);
  let q = $state('');
  const list = $derived.by(() => {
    if (effect.kind !== 'shape') return [];
    const term = q.trim().toLowerCase();
    return effect.beasts
      .filter((b) => (!self || b.cr <= effect.maxCr) && (!term || b.name.toLowerCase().includes(term)))
      .sort((a, b) => b.cr - a.cr || a.name.localeCompare(b.name));
  });
  function pick(b: Beast) {
    if (effect.kind !== 'shape' || !self) return;
    const mode = effect.mode;
    store.apply((x) => takeShape(x, b, mode, name));
    onclose();
  }
</script>

<div class="fx">
  {#if effect.kind === 'tempRoll'}
    <p class="small">
      {name}: {effect.count}d{effect.sides} + {effect.bonus} temp HP.
      {t('Tiré los dados por ti; si tiraste los tuyos, cambia el total.')}
    </p>
    <div class="row">
      <input class="num" type="number" inputmode="numeric" min="0" aria-label={t('Temp HP')} bind:value />
      <button onclick={() => (value = roll())}>{t('Volver a tirar')}</button>
      <button class="primary" onclick={applyTemp}>{t('Aplicar')}</button>
      <button class="ghost" onclick={onclose}>{t('Omitir')}</button>
    </div>
  {:else if effect.kind === 'shape'}
    <div class="head">
      <b>{t('¿En qué se convierte?')}</b>
      <button class="ghost small" onclick={onclose}>{t('Omitir')}</button>
    </div>
    <label class="check small"><input type="checkbox" bind:checked={self} /> {t('Lo lanzo en mí (beasts de CR {cr} o menos)', { cr: effect.maxCr })}</label>
    <p class="muted small">
      {#if !self}{t('En otra criatura: la lista es de referencia (CR hasta su level o CR).')}
      {:else if effect.mode === 'temp'}{t('Ganas temp HP iguales a los HP de la forma. Si se acaban, el spell termina.')}
      {:else}{t('La forma tiene sus propios HP. Si llegan a 0 vuelves a tu forma y el daño sobrante pasa a tus HP.')}{/if}
    </p>
    <input type="search" placeholder={t('Buscar beast...')} bind:value={q} />
    <ul class="beasts">
      {#each list as b (b.name)}
        <li>
          <button class="beast" disabled={!self} onclick={() => pick(b)}>
            <span class="bn">{b.name}</span>
            <span class="muted small">CR {crLabel(b.cr)} · <b class="num">{b.hp} HP</b> · AC {b.ac} · {b.size} · {b.speed}</span>
          </button>
        </li>
      {:else}
        <li class="muted small">{t('Ninguna beast coincide.')}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .fx {
    display: grid;
    gap: 8px;
    margin: 0 0 10px 42px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface-2, var(--surface));
  }
  .fx p {
    margin: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .row input {
    width: 80px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .check {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .check input {
    width: 20px;
    height: 20px;
    min-height: 0;
    flex: none;
    margin: 0;
  }
  .beasts {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 320px;
    overflow-y: auto;
    display: grid;
    gap: 4px;
  }
  .beast {
    width: 100%;
    display: grid;
    gap: 2px;
    text-align: left;
    padding: 8px 10px;
    min-height: 0;
  }
  .beast:disabled {
    opacity: 1;
    cursor: default;
  }
  .bn {
    font-weight: 600;
  }
</style>
