<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';
  import { MAX_ELECTIVES, uid } from '../lib/model/character';
  import { DEFAULT_DAY_NAMES } from '../lib/model/campaign';

  /* Clases de Strixhaven del PJ: obligatorias y hasta 3 optativas, con sus días en la semana de 10 días. */
  let { dayNames = DEFAULT_DAY_NAMES }: { dayNames?: string[] } = $props();

  const courses = $derived(store.c.strixhaven.courses);
  const electives = $derived(courses.filter((x) => x.kind === 'elective').length);

  function add(kind: 'required' | 'elective') {
    if (kind === 'elective' && electives >= MAX_ELECTIVES) return;
    store.c.strixhaven.courses.push({ id: uid(), name: '', kind, days: [], time: '', professor: '', place: '', notes: '' });
  }
  function toggleDay(i: number, d: number) {
    const x = store.c.strixhaven.courses[i];
    x.days = x.days.includes(d) ? x.days.filter((v) => v !== d) : [...x.days, d].sort((a, b) => a - b);
  }
  function setKind(i: number, kind: 'required' | 'elective') {
    const x = store.c.strixhaven.courses[i];
    if (kind === 'elective' && x.kind !== 'elective' && electives >= MAX_ELECTIVES) return;
    x.kind = kind;
  }
</script>

<div class="card stack">
  <h2>{t('Mis clases')}</h2>
  <p class="small muted">{t('Obligatorias y hasta {n} optativas. Marca los días de la semana de 10 días en que tienes cada clase.', { n: MAX_ELECTIVES })}</p>
  {#each courses as x, i (x.id)}
    <div class="course" class:elective={x.kind === 'elective'}>
      <div class="c-top">
        <input class="c-name" bind:value={x.name} placeholder={t('Nombre de la clase')} aria-label={t('Nombre de la clase')} />
        <select class="c-kind" value={x.kind} onchange={(e) => setKind(i, e.currentTarget.value as 'required' | 'elective')} aria-label={t('Tipo de clase')}>
          <option value="required">{t('Obligatoria')}</option>
          <option value="elective" disabled={x.kind !== 'elective' && electives >= MAX_ELECTIVES}>{t('Optativa')}</option>
        </select>
        <button class="ghost danger x" aria-label={t('Quitar clase {name}', { name: x.name || '' })} onclick={() => store.c.strixhaven.courses.splice(i, 1)}>✕</button>
      </div>
      <div class="days" role="group" aria-label={t('Días de la clase')}>
        {#each dayNames as n, d (d)}
          <button class="day" class:on={x.days.includes(d + 1)} aria-pressed={x.days.includes(d + 1)} title={n} aria-label={n} onclick={() => toggleDay(i, d + 1)}>{d + 1}</button>
        {/each}
      </div>
      <div class="c-more">
        <input bind:value={x.time} placeholder={t('Hora')} aria-label={t('Hora')} />
        <input bind:value={x.professor} placeholder={t('Profesor')} aria-label={t('Profesor')} />
        <input bind:value={x.place} placeholder={t('Lugar')} aria-label={t('Lugar')} />
      </div>
    </div>
  {:else}
    <p class="small muted">{t('Todavía no agregaste clases.')}</p>
  {/each}
  <div class="row">
    <button onclick={() => add('required')}>+ {t('Obligatoria')}</button>
    <button onclick={() => add('elective')} disabled={electives >= MAX_ELECTIVES}>+ {t('Optativa')} ({electives}/{MAX_ELECTIVES})</button>
  </div>
</div>

<style>
  .course {
    display: grid;
    gap: 6px;
    padding: 8px 0;
    border-bottom: 1px solid var(--line);
  }
  .c-top {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .c-name {
    flex: 1;
    min-width: 0;
  }
  .c-kind {
    width: auto;
    flex: none;
  }
  .x {
    flex: none;
  }
  .days {
    display: grid;
    grid-template-columns: repeat(10, minmax(0, 1fr));
    gap: 3px;
  }
  .day {
    min-height: 34px;
    padding: 0;
    font-size: 0.72rem;
  }
  .day.on {
    background: var(--accent);
    color: var(--accent-ink, #111);
    border-color: var(--accent);
  }
  .c-more {
    display: grid;
    grid-template-columns: 1fr 1.3fr 1.3fr;
    gap: 6px;
  }
  .c-more input {
    min-width: 0;
  }
</style>
