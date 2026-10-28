<script lang="ts">
  import { t } from '../../lib/i18n.svelte';
  import { ABILITIES, type Ability, type Character } from '../../lib/model/character';
  import {
    POINT_BUY_BUDGET,
    POINT_BUY_COST,
    STANDARD_ARRAY,
    fmt,
    mod,
    pointBuySpent,
    scoreBreakdown
  } from '../../lib/rules/derive';
  import { ABILITY_LABEL } from '../../lib/rules/tables';
  import NumField from '../NumField.svelte';

  let { c = $bindable() }: { c: Character } = $props();

  const spent = $derived(pointBuySpent(c));
  const left = $derived(spent === null ? null : POINT_BUY_BUDGET - spent);
  const rows = $derived(ABILITIES.map((a) => ({ a, b: scoreBreakdown(c, a) })));

  function setMethod(m: Character['abilityMethod']) {
    c.abilityMethod = m;
    if (m === 'pointbuy' && pointBuySpent(c) === null) {
      for (const a of ABILITIES) c.abilities[a] = 8;
    }
    if (m === 'array') {
      const sorted = [...STANDARD_ARRAY];
      ABILITIES.forEach((a, i) => (c.abilities[a] = sorted[i]));
    }
  }

  function step(a: Ability, d: number) {
    const next = c.abilities[a] + d;
    if (next < 8 || next > 15) return;
    const delta = POINT_BUY_COST[next] - POINT_BUY_COST[c.abilities[a]];
    if (d > 0 && left !== null && delta > left) return;
    c.abilities[a] = next;
  }

  // Standard array: al elegir un valor, se intercambia con la ability que lo tenia.
  function assign(a: Ability, v: number) {
    const other = ABILITIES.find((x) => x !== a && c.abilities[x] === v);
    if (other) c.abilities[other] = c.abilities[a];
    c.abilities[a] = v;
  }
</script>

<div class="card stack">
  <h2>Ability scores</h2>
  <div class="seg" role="tablist" aria-label={t('Método')}>
    <button class:on={c.abilityMethod === 'pointbuy'} onclick={() => setMethod('pointbuy')}>Point buy</button>
    <button class:on={c.abilityMethod === 'array'} onclick={() => setMethod('array')}>Standard array</button>
    <button class:on={c.abilityMethod === 'manual'} onclick={() => setMethod('manual')}>Manual</button>
  </div>

  {#if c.abilityMethod === 'pointbuy'}
    <p class="small" class:err={left !== null && left < 0}>
      {#if left === null}
        {t('Algún valor está fuera de 8 a 15: ajusta o usa Manual.')}
      {:else}
        {t('Puntos restantes')}: <b class="num">{left}</b> / {POINT_BUY_BUDGET}
      {/if}
    </p>
  {/if}

  <div class="table">
    <div class="head small muted">
      <span></span><span>Base</span><span title={t('Raza y background')}>{t('Origen')}</span><span title={t('ASI y feats')}>ASI</span><span>Total</span>
    </div>
    {#each rows as { a, b } (a)}
      <div class="r">
        <span class="ab">{ABILITY_LABEL[a]}</span>
        <span class="base">
          {#if c.abilityMethod === 'pointbuy'}
            <button class="mini" aria-label={`${t('Bajar')} ${a}`} onclick={() => step(a, -1)} disabled={c.abilities[a] <= 8}>-</button>
            <b class="num">{c.abilities[a]}</b>
            <button class="mini" aria-label={`${t('Subir')} ${a}`} onclick={() => step(a, 1)} disabled={c.abilities[a] >= 15}>+</button>
          {:else if c.abilityMethod === 'array'}
            <select value={c.abilities[a]} onchange={(e) => assign(a, Number(e.currentTarget.value))} aria-label={a}>
              {#each STANDARD_ARRAY as v (v)}<option value={v}>{v}</option>{/each}
            </select>
          {:else}
            <NumField bind:value={c.abilities[a]} min={1} max={30} />
          {/if}
        </span>
        <span class="num muted">{b.species + b.background ? fmt(b.species + b.background) : ''}</span>
        <span class="num muted">{b.asi + b.feats + b.other + b.feature ? fmt(b.asi + b.feats + b.other + b.feature) : ''}</span>
        <span class="tot num" class:over={b.capped > 0} title={b.capped > 0 ? t('{n} puntos no cuentan: los ASI y feats no suben un score sobre 20', { n: b.capped }) : undefined}>
          <b>{b.total}</b> <small>{fmt(mod(b.total))}</small>
          {#if b.capped > 0}<small class="cap">{t('máx. 20 (sobran {n})', { n: b.capped })}</small>{/if}
        </span>
      </div>
    {/each}
  </div>
  {#if rows.some((r) => r.b.capped > 0)}
    <p class="small err">
      {t('Te sobran puntos en {list}: raza, background, ASI y feats no pueden subir un score sobre 20. Pon esos incrementos en otra ability.', {
        list: rows.filter((r) => r.b.capped > 0).map((r) => `${ABILITY_LABEL[r.a]} (${r.b.capped})`).join(', ')
      })}
    </p>
  {/if}
  <p class="muted small">
    {t('Los incrementos de raza, background, ASI y feats se suman solos, hasta un máximo de 20. Solo features como Primal Champion o los Epic Boons pasan de 20, y los bonos manuales (items) no tienen tope.')}
  </p>
</div>

<style>
  .cap {
    display: block;
    color: var(--bad);
    font-size: 0.72rem;
    white-space: nowrap;
  }
  .card h2 {
    margin-bottom: 0;
  }
  p {
    margin: 0;
  }
  .err {
    color: var(--bad);
  }
  .seg {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    background: var(--bg);
    padding: 4px;
    border-radius: 12px;
  }
  .seg button {
    border: none;
    background: transparent;
    min-height: 40px;
    padding: 0 6px;
    font-size: 0.85rem;
  }
  .seg button.on {
    background: var(--surface-2);
    color: var(--accent);
    font-weight: 650;
  }
  .table {
    display: flex;
    flex-direction: column;
  }
  .head,
  .r {
    display: grid;
    grid-template-columns: 44px minmax(118px, 1.4fr) 0.6fr 0.6fr 1fr;
    gap: 6px;
    align-items: center;
  }
  .head span {
    text-align: center;
  }
  .r {
    min-height: 54px;
    border-top: 1px solid var(--line);
  }
  .r > span {
    text-align: center;
  }
  .ab {
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--muted);
    text-align: left !important;
  }
  .base {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .base b {
    min-width: 22px;
  }
  .mini {
    width: 38px;
    min-height: 38px;
    padding: 0;
  }
  .base select {
    min-height: 40px;
  }
  .tot b {
    font-size: 1.2rem;
  }
  .tot small {
    color: var(--accent);
  }
  .tot.over b {
    color: var(--bad);
  }
</style>
