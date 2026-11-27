<script lang="ts">
  import { campaigns } from '../lib/campaigns.svelte';
  import { t } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';
  import { COLLEGES, JOB_PAY_GP, belovedCount, collegeOf, relStatus, studentDice, YEAR_NAMES } from '../lib/strixhaven';

  /* Hoja: resumen de Strixhaven con Student Dice y Beloved Inspiration para marcar en juego. */
  const s = $derived(store.c.strixhaven);
  const college = $derived(collegeOf(store.c));
  const info = $derived(COLLEGES.find((x) => x.name === college) ?? null);
  const dice = $derived(studentDice(store.c, campaigns.get(store.c.campaignId)?.catalog));
  const beloved = $derived(belovedCount(store.c));
  const rels = $derived(s.relationships.filter((r) => r.name.trim()).map((r) => ({ r, st: relStatus(r) })));

  function toggleDie(id: string) {
    const used = store.c.strixhaven.diceUsed;
    const i = used.indexOf(id);
    if (i >= 0) used.splice(i, 1);
    else used.push(id);
  }
  function useBeloved(d: number) {
    store.c.strixhaven.belovedUsed = Math.max(0, Math.min(beloved, s.belovedUsed + d));
  }
  const statusLabel = { beloved: 'Beloved', friend: 'Friend', rival: 'Rival', neutral: 'Neutral' } as const;
</script>

<div class="card stack strix">
  <div class="head">
    <h2>Strixhaven</h2>
    <span class="tag">{college || t('Sin college')} · {YEAR_NAMES[s.year]}</span>
  </div>
  {#if info}<p class="small muted">{info.focus}</p>{/if}

  <div class="block">
    <h3>Student Dice <span class="muted small">d4 · {t('1 por prueba, vuelven con Long Rest')}</span></h3>
    {#if dice.length}
      <div class="dice">
        {#each dice as d (d.id)}
          <button class="die" class:used={d.used} aria-pressed={d.used} onclick={() => toggleDie(d.id)} title={d.used ? t('Usado: toca para devolverlo') : t('Toca para marcarlo como usado')}>
            <b>d4</b>
            <span>{d.source}</span>
            <small>{d.skills.join(', ') || '-'}</small>
          </button>
        {/each}
      </div>
    {:else}
      <p class="small muted">{t('Sin Student Dice: únete a un extracurricular o aprueba un examen (Editar > Strixhaven).')}</p>
    {/if}
  </div>

  {#if beloved > 0}
    <div class="block row-b">
      <h3>Beloved Inspiration</h3>
      <div class="cnt">
        <button aria-label={t('Devolver uso')} onclick={() => useBeloved(-1)}>−</button>
        <b>{beloved - s.belovedUsed}/{beloved}</b>
        <button aria-label={t('Usar')} onclick={() => useBeloved(1)} disabled={s.belovedUsed >= beloved}>{t('Usar')}</button>
      </div>
    </div>
  {/if}

  {#if s.job}
    <p class="small"><b>Job:</b> {s.job} · {JOB_PAY_GP} gp/{t('semana')}</p>
  {/if}

  {#if rels.length}
    <div class="block">
      <h3>{t('Relaciones')}</h3>
      <ul class="rels">
        {#each rels as { r, st } (r.id)}
          <li>
            <span class="nm">{r.name}</span>
            <span class="chip {st}">{statusLabel[st]}</span>
            <span class="pts">{r.points > 0 ? `+${r.points}` : r.points}</span>
            {#if (st === 'friend' || st === 'beloved') && r.boon}<small class="muted">Boon: {r.boon}</small>{/if}
            {#if st === 'rival' && r.bane}<small class="muted">Bane: {r.bane}</small>{/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .strix {
    grid-column: 1 / -1;
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .head h2 {
    margin: 0;
  }
  .tag {
    font-size: 0.85rem;
    color: var(--accent);
    font-weight: 600;
  }
  h3 {
    margin: 0 0 6px;
    font-size: 0.95rem;
  }
  .dice {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 8px;
  }
  .die {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    text-align: left;
    padding: 8px 10px;
    min-height: 0;
    border-radius: 12px;
    border: 1px solid var(--accent);
  }
  .die b {
    color: var(--accent);
  }
  .die small {
    color: var(--muted);
  }
  .die.used {
    opacity: 0.45;
    border-color: var(--line);
  }
  .die.used b {
    color: var(--muted);
    text-decoration: line-through;
  }
  .row-b {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .row-b h3 {
    margin: 0;
  }
  .cnt {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .cnt button:first-child {
    width: 40px;
    padding: 0;
  }
  .rels {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .rels li {
    display: grid;
    grid-template-columns: 1fr auto 36px;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid var(--line);
  }
  .rels li:last-child {
    border-bottom: none;
  }
  .rels small {
    grid-column: 1 / -1;
  }
  .pts {
    text-align: right;
    font-weight: 600;
  }
  .chip {
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid var(--line);
    color: var(--muted);
  }
  .chip.friend,
  .chip.beloved {
    color: var(--accent);
    border-color: var(--accent);
  }
  .chip.rival {
    color: var(--bad);
    border-color: var(--bad);
  }
</style>
