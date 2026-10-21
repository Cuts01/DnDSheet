<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';
  import { abilityMod, arcaneRecoveryBudget, fmt, hitDicePools, pactSlots } from '../lib/rules/derive';
  import { shortRest, validArcane, type HitDieSpend } from '../lib/rules/rests';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  let dlg: HTMLDialogElement;
  let spends = $state<HitDieSpend[]>([]);
  let rolls = $state<Record<number, number | null>>({});
  let maximize = $state(false);
  let arcane = $state<number[]>([0, 0, 0, 0, 0]);

  const c = $derived(store.c);
  const pools = $derived(hitDicePools(c));
  const con = $derived(abilityMod(c, 'con'));
  const budget = $derived(arcaneRecoveryBudget(c));
  const arcaneLevels = $derived(arcane.flatMap((k, i) => Array(k).fill(i + 1) as number[]));
  const arcaneSum = $derived(arcaneLevels.reduce((s, l) => s + l, 0));
  const arcaneError = $derived(validArcane(c, arcaneLevels));
  const preview = $derived(shortRest(store.snapshot(), { hitDice: spends, arcane: arcaneError ? [] : arcaneLevels }));
  const pendingByDie = (die: number) => spends.filter((s) => s.die === die).length;

  $effect(() => {
    if (open && !dlg.open) {
      spends = [];
      rolls = {};
      arcane = [0, 0, 0, 0, 0];
      dlg.showModal();
    } else if (!open && dlg.open) dlg.close();
  });

  function addDie(die: number) {
    const roll = maximize ? die : rolls[die];
    if (!roll || roll < 1) return;
    spends = [...spends, { die, roll: Math.min(die, roll) }];
    rolls[die] = null;
  }

  function finish() {
    store.apply((ch) => shortRest(ch, { hitDice: spends, arcane: arcaneError ? [] : arcaneLevels }));
    open = false;
  }
</script>

<dialog bind:this={dlg} onclose={() => (open = false)}>
  <div class="wrap">
    <header>
      <h3>Short Rest</h3>
      <button class="ghost" aria-label={t('Cerrar')} onclick={() => (open = false)}>✕</button>
    </header>

    <div class="body stack">
      <section>
        <h4>Hit Dice <span class="muted small">CON {fmt(con)} {t('por dado')}</span></h4>
        {#each pools as p (p.die)}
          {@const left = p.available - pendingByDie(p.die)}
          <div class="hd-row">
            <span class="num die">d{p.die} <span class="muted">{left}/{p.total}</span></span>
            {#if !maximize}
              <input
                class="num"
                type="number"
                inputmode="numeric"
                min="1"
                max={p.die}
                placeholder={t('tirada')}
                aria-label={t('Tirada de d{die}', { die: p.die })}
                bind:value={rolls[p.die]}
                disabled={left <= 0}
                onkeydown={(e) => e.key === 'Enter' && addDie(p.die)}
              />
            {/if}
            <button onclick={() => addDie(p.die)} disabled={left <= 0 || (!maximize && !rolls[p.die])}>
              {t('Gastar')}{maximize ? ` (${p.die})` : ''}
            </button>
          </div>
        {/each}
        <label class="check">
          <input type="checkbox" bind:checked={maximize} />
          <span>{t('Maximizar dados de curación')} <span class="muted small">({t('si un feature o invocation lo permite')})</span></span>
        </label>
        {#if spends.length}
          <p class="small">
            {t('Gastados')}: {spends.map((s) => `d${s.die}: ${s.roll}`).join(', ')}
            <button class="ghost small undo" onclick={() => (spends = spends.slice(0, -1))}>{t('Deshacer')}</button>
          </p>
        {/if}
      </section>

      {#if budget > 0}
        <section>
          <h4>
            Arcane Recovery
            <span class="muted small">{t('límite: {n} niveles de slot en total, máx. nivel 5', { n: budget })}</span>
          </h4>
          {#if c.arcaneRecoveryUsed}
            <p class="muted small">{t('Ya usado. Se renueva con Long Rest.')}</p>
          {:else}
            <div class="arc">
              {#each arcane as k, i (i)}
                {#if c.slotsUsed.levels[i] > 0}
                  <div class="arc-lvl">
                    <span class="num">{t('Nivel')} {i + 1}</span>
                    <div class="row">
                      <button aria-label={t('Menos')} onclick={() => (arcane[i] = Math.max(0, k - 1))} disabled={k === 0}>-</button>
                      <b class="num">{k}</b>
                      <button
                        aria-label={t('Más')}
                        onclick={() => (arcane[i] = k + 1)}
                        disabled={k >= c.slotsUsed.levels[i] || arcaneSum + i + 1 > budget}>+</button
                      >
                    </div>
                  </div>
                {/if}
              {/each}
            </div>
            {#if c.slotsUsed.levels.slice(0, 5).every((u) => u === 0)}
              <p class="muted small">{t('No tienes slots de Wizard gastados.')}</p>
            {:else if arcaneLevels.length && arcaneError}
              <p class="err small">{arcaneError}</p>
            {/if}
          {/if}
        </section>
      {/if}

      <section class="summary">
        <h4>{t('Al terminar')}</h4>
        <ul class="small">
          <li>HP: {c.hp.current} → <b>{preview.hp.current}</b> / {c.hp.max}</li>
          {#if pactSlots(c).count > 0}<li>{t('Pact slots recuperados')}</li>{/if}
          {#if c.resources.some((r) => r.recharge === 'short')}<li>{t('Recursos de Short Rest recuperados')}</li>{/if}
          {#if arcaneLevels.length && !arcaneError}<li>Arcane Recovery: {t('niveles')} {arcaneLevels.join(', ')}</li>{/if}
        </ul>
      </section>
    </div>

    <footer>
      <button onclick={() => (open = false)}>{t('Cancelar')}</button>
      <button class="primary" onclick={finish}>{t('Terminar Short Rest')}</button>
    </footer>
  </div>
</dialog>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    max-height: calc(100dvh - 24px);
  }
  header,
  footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
  }
  header {
    border-bottom: 1px solid var(--line);
  }
  header h3 {
    margin: 0;
    flex: 1;
  }
  footer {
    border-top: 1px solid var(--line);
    justify-content: flex-end;
  }
  .body {
    padding: 14px;
    overflow-y: auto;
  }
  h4 {
    margin: 0 0 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    align-items: baseline;
  }
  .hd-row {
    display: grid;
    grid-template-columns: 80px 1fr auto;
    gap: 8px;
    align-items: center;
    margin-bottom: 6px;
  }
  .die {
    font-weight: 650;
  }
  .check {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-top: 6px;
    min-height: var(--tap);
  }
  .check input {
    width: 22px;
    min-height: 22px;
    accent-color: var(--accent);
  }
  .undo {
    min-height: 36px;
    margin-left: 6px;
  }
  .arc {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }
  .arc-lvl {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--surface-2);
    border-radius: 10px;
    padding: 4px 4px 4px 10px;
  }
  .arc-lvl button {
    width: 40px;
    padding: 0;
    min-height: 40px;
  }
  .arc-lvl b {
    min-width: 18px;
    text-align: center;
  }
  .err {
    color: var(--bad);
  }
  .summary ul {
    margin: 0;
    padding-left: 18px;
  }
</style>
