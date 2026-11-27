<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';
  import { uid } from '../lib/model/character';
  import { COLLEGES, EXTRACURRICULARS, JOBS, JOB_PAY_GP, collegeOf, maxExtracurriculars, relStatus, YEAR_NAMES } from '../lib/strixhaven';
  import { SKILLS } from '../lib/rules/tables';
  import { campaigns } from '../lib/campaigns.svelte';
  import StrixCourses from './StrixCourses.svelte';

  /* Editar > Strixhaven: college, año, extracurriculars, job, exámenes y relaciones. */
  const s = $derived(store.c.strixhaven);
  const college = $derived(collegeOf(store.c));
  const info = $derived(COLLEGES.find((x) => x.name === college) ?? null);
  const bgCollege = $derived(/^(\w+) Student$/i.exec(store.c.background.name.trim())?.[1] ?? '');
  const maxEc = $derived(maxExtracurriculars(store.c));
  const jobKnown = $derived(JOBS.some((p) => p.jobs.some((j) => `${p.place}: ${j}` === s.job)));
  let jobFree = $state(false);

  function setEc(i: number, v: string) {
    const list = [...s.extracurriculars];
    list[i] = v;
    store.c.strixhaven.extracurriculars = list.filter(Boolean).filter((x, k, a) => a.indexOf(x) === k).slice(0, 2);
  }
  function setJob(v: string) {
    if (v === '__free') {
      jobFree = true;
      return;
    }
    jobFree = false;
    store.c.strixhaven.job = v;
    // Con Job solo queda un extracurricular.
    if (v) store.c.strixhaven.extracurriculars = s.extracurriculars.slice(0, 1);
  }
  const ecSkills = (name: string) => EXTRACURRICULARS.find((e) => e.name === name)?.skills.join(', ') ?? '';

  function addExam() {
    store.c.strixhaven.exams.push({ id: uid(), year: s.year, name: '', skills: '', result: '' });
  }
  function addRel() {
    store.c.strixhaven.relationships.push({ id: uid(), name: '', points: 0, beloved: false, boon: '', bane: '', notes: '' });
  }
  function bump(i: number, d: number) {
    const r = store.c.strixhaven.relationships[i];
    r.points = Math.max(-20, Math.min(20, r.points + d));
    if (r.points < 1) r.beloved = false; // el Beloved termina si baja de 1
  }
  const statusLabel = { beloved: 'Beloved', friend: 'Friend', rival: 'Rival', neutral: 'Neutral' } as const;
  const resultLabel: Record<string, string> = { '': '-', failed: 'Failed', passed: 'Passed', aced: 'Aced' };
  const skillNames = SKILLS.map((x) => x.name);
</script>

<div class="card stack">
  <h2>{t('College y año')}</h2>
  <div class="grid2">
    <label class="field">
      <span>College</span>
      <select bind:value={store.c.strixhaven.college}>
        <option value="">{bgCollege && COLLEGES.some((x) => x.name === bgCollege) ? `${t('Según el background')} (${bgCollege})` : t('Sin elegir')}</option>
        {#each COLLEGES as k (k.name)}<option value={k.name}>{k.name}</option>{/each}
      </select>
    </label>
    <label class="field">
      <span>{t('Año')}</span>
      <select bind:value={store.c.strixhaven.year}>
        {#each [1, 2, 3, 4] as y (y)}<option value={y}>{YEAR_NAMES[y]}</option>{/each}
      </select>
    </label>
  </div>
  {#if info}
    <p class="small muted">{info.focus} · {t('Colores')}: {info.colors} · Mascot: {info.mascot}</p>
  {/if}
  <p class="small muted">{t('El background {college} Student da el feat Strixhaven Initiate de ese college y suma sus spells a tu lista de clase.', { college: college || 'Lorehold' })}</p>
</div>

<div class="card stack">
  <h2>{t('Extracurriculars y Job')}</h2>
  <p class="small muted">{t('Cada extracurricular da un Student Die (d4) para pruebas con sus dos skills y un Relationship Point con un miembro. Con Job solo puedes estar en uno.')}</p>
  {#each Array.from({ length: maxEc }, (_, i) => i) as i (i)}
    <label class="field">
      <span>Extracurricular {i + 1}</span>
      <select value={s.extracurriculars[i] ?? ''} onchange={(e) => setEc(i, e.currentTarget.value)}>
        <option value="">{t('Ninguno')}</option>
        {#each EXTRACURRICULARS as e (e.name)}
          <option value={e.name} disabled={s.extracurriculars.includes(e.name) && s.extracurriculars[i] !== e.name}>{e.name} ({e.skills.join(', ')})</option>
        {/each}
      </select>
    </label>
  {/each}
  {#if s.extracurriculars.length > maxEc}
    <p class="warn small">{t('Con Job solo cuenta un extracurricular: {name} queda fuera.', { name: s.extracurriculars.slice(maxEc).join(', ') })}</p>
  {/if}
  <label class="field">
    <span>Job</span>
    <select value={jobFree || (s.job && !jobKnown) ? '__free' : s.job} onchange={(e) => setJob(e.currentTarget.value)}>
      <option value="">{t('Sin Job')}</option>
      {#each JOBS as p (p.place)}
        <optgroup label={p.place}>
          {#each p.jobs as j (j)}<option value={`${p.place}: ${j}`}>{j}</option>{/each}
        </optgroup>
      {/each}
      <option value="__free">{t('Otro (escribir)')}</option>
    </select>
  </label>
  {#if jobFree || (s.job && !jobKnown)}
    <input bind:value={store.c.strixhaven.job} placeholder={t('Lugar y puesto')} aria-label={t('Job en texto libre')} />
  {/if}
  {#if s.job}<p class="small muted">{t('Paga {gp} gp al inicio de cada semana y da un Relationship Point con un compañero de trabajo.', { gp: JOB_PAY_GP })}</p>{/if}
  {#each s.extracurriculars.slice(0, maxEc) as e (e)}
    <p class="small"><b>{e}</b>: Student Die (d4) · {ecSkills(e)}</p>
  {/each}
</div>

<div class="card stack">
  <div class="title-row">
    <h2>{t('Exámenes (report card)')}</h2>
    <button class="ghost" onclick={addExam}>+ {t('Examen')}</button>
  </div>
  <p class="small muted">{t('Cada examen son dos pruebas. Una acertada: Passed (1 Student Die). Dos: Aced (2). Ninguna: Failed (tutorías). Los dados de exámenes se pierden al terminar el año.')}</p>
  <datalist id="strix-skills">{#each skillNames as n (n)}<option value={n}></option>{/each}</datalist>
  {#each store.c.strixhaven.exams as ex, i (ex.id)}
    <div class="exam">
      <select class="ey" bind:value={ex.year} aria-label={t('Año')}>
        {#each [1, 2, 3, 4] as y (y)}<option value={y}>{t('Año')} {y}</option>{/each}
      </select>
      <input class="en" bind:value={ex.name} placeholder={t('Examen')} aria-label={t('Nombre del examen')} />
      <input class="es" bind:value={ex.skills} list="strix-skills" placeholder={t('Skills (ej. Arcana, History)')} aria-label={t('Skills del examen')} />
      <select class="er" bind:value={ex.result} aria-label={t('Resultado')}>
        {#each Object.entries(resultLabel) as [v, l] (v)}<option value={v}>{l}</option>{/each}
      </select>
      <button class="ghost danger ex-x" aria-label={t('Quitar examen')} onclick={() => store.c.strixhaven.exams.splice(i, 1)}>✕</button>
    </div>
  {:else}
    <p class="small muted">{t('Sin exámenes todavía.')}</p>
  {/each}
</div>

<div class="card stack">
  <div class="title-row">
    <h2>{t('Relaciones')}</h2>
    <button class="ghost" onclick={addRel}>+ {t('Relación')}</button>
  </div>
  <p class="small muted">{t('Relationship Points con otros estudiantes: con 2 o más es Friend (Bond Boon); con −2 o menos, Rival (Bond Bane). Un Friend puede ser tu Beloved; termina si baja de 1 punto. Cada Beloved da un uso de Beloved Inspiration por Long Rest.')}</p>
  {#each store.c.strixhaven.relationships as r, i (r.id)}
    {@const st = relStatus(r)}
    <div class="rel">
      <div class="rel-head">
        <input bind:value={r.name} placeholder={t('Nombre del estudiante')} aria-label={t('Nombre del estudiante')} />
        <span class="chip {st}">{statusLabel[st]}</span>
        <button class="ghost danger" aria-label={t('Quitar relación')} onclick={() => store.c.strixhaven.relationships.splice(i, 1)}>✕</button>
      </div>
      <div class="rel-pts">
        <button aria-label={t('Restar punto')} onclick={() => bump(i, -1)}>−</button>
        <b>{r.points > 0 ? `+${r.points}` : r.points}</b>
        <button aria-label={t('Sumar punto')} onclick={() => bump(i, 1)}>+</button>
        <label class="check">
          <input type="checkbox" bind:checked={r.beloved} disabled={!r.beloved && r.points < 2} />
          <span>Beloved</span>
        </label>
      </div>
      {#if st === 'friend' || st === 'beloved'}
        <input bind:value={r.boon} placeholder="Bond Boon" aria-label="Bond Boon" />
      {:else if st === 'rival'}
        <input bind:value={r.bane} placeholder="Bond Bane" aria-label="Bond Bane" />
      {/if}
      <input bind:value={r.notes} placeholder={t('Notas')} aria-label={t('Notas de la relación')} />
    </div>
  {:else}
    <p class="small muted">{t('Sin relaciones todavía.')}</p>
  {/each}
</div>

<div class="card stack">
  <h2>{t('Notas de Strixhaven')}</h2>
  <textarea rows="4" bind:value={store.c.strixhaven.notes} placeholder={t('Clases, profesores, Mage Tower, lo que quieras recordar')}></textarea>
</div>

<StrixCourses dayNames={campaigns.get(store.c.campaignId)?.calendar.dayNames} />

<style>
  .title-row button {
    white-space: nowrap;
    flex: none;
  }
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .exam {
    display: grid;
    grid-template-columns: 110px 1fr 44px;
    grid-template-areas: 'ey en en' 'es es es' 'er er ex';
    gap: 6px;
    padding: 8px 0;
    border-bottom: 1px solid var(--line);
  }
  .ey {
    grid-area: ey;
  }
  .en {
    grid-area: en;
  }
  .es {
    grid-area: es;
  }
  .er {
    grid-area: er;
  }
  .ex-x {
    grid-area: ex;
  }
  .rel {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
  }
  .rel-head {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .rel-head input {
    flex: 1;
    min-width: 0;
  }
  .rel-pts {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .rel-pts button {
    width: 40px;
    padding: 0;
  }
  .rel-pts b {
    min-width: 28px;
    text-align: center;
  }
  .check {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-left: auto;
  }
  .chip {
    font-size: 0.75rem;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--line);
    color: var(--muted);
    white-space: nowrap;
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
  textarea {
    width: 100%;
  }
  .warn {
    color: var(--warn, var(--bad));
    margin: 0;
  }
</style>
