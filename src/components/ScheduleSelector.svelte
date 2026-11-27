<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';
  import type { Campaign, CatalogClub, CatalogCourse, CatalogJob, CatalogTeam } from '../lib/model/campaign';
  import { classDC, clashNames, courseLabel, fmtSpan, picked, scheduleOf, syncFromSchedule, tally, whenText } from '../lib/rules/schedule';

  /* Elegir optativas, clubes, equipo de Mage Tower y trabajo del catálogo de la campaña. */
  let { camp }: { camp: Campaign } = $props();
  const cat = $derived(camp.catalog!);
  const rules = $derived(cat.rules);
  const days = $derived(camp.calendar.dayNames);
  const sch = $derived(store.c.strixhaven.schedule);
  const plan = $derived(scheduleOf(store.c, cat));
  const tl = $derived(tally(store.c, cat, days));

  type Tab = 'opt' | 'club' | 'team' | 'job';
  let tab = $state<Tab>('opt');
  let q = $state('');
  let hideClash = $state(false);

  const match = (...parts: string[]) => {
    const term = q.trim().toLowerCase();
    return !term || parts.join(' ').toLowerCase().includes(term);
  };
  const groupBy = <T,>(list: T[], key: (x: T) => string) => {
    const m = new Map<string, T[]>();
    for (const x of list) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
    return [...m];
  };

  function update(fn: (s: typeof sch) => void) {
    fn(store.c.strixhaven.schedule);
    syncFromSchedule(store.c, cat);
  }
  const clubsUsed = $derived(tl.clubs);
  function toggleElective(x: CatalogCourse) {
    update((s) => {
      if (s.electives.includes(x.id)) s.electives = s.electives.filter((v) => v !== x.id);
      else s.electives = [...s.electives, x.id];
    });
  }
  function toggleClub(x: CatalogClub) {
    update((s) => {
      if (s.clubs.includes(x.id)) s.clubs = s.clubs.filter((v) => v !== x.id);
      else s.clubs = [...s.clubs, x.id];
    });
  }
  function setTeam(id: string) {
    update((s) => (s.team = id));
  }
  function setJob(id: string) {
    update((s) => {
      if (s.job !== id) {
        s.shifts = [];
        s.position = '';
      }
      s.job = id;
    });
  }
  function toggleShift(id: string) {
    update((s) => (s.shifts = s.shifts.includes(id) ? s.shifts.filter((v) => v !== id) : [...s.shifts, id]));
  }

  const electiveBlocked = (x: CatalogCourse) =>
    !sch.electives.includes(x.id) && (tl.electives >= rules.maxElectives || (x.level2 && tl.level2 >= rules.maxLevel2));
  const clubBlocked = (x: CatalogClub) => !sch.clubs.includes(x.id) && clubsUsed >= rules.maxClubs;
  const clashOf = (blocks: { day: number; start: number; end: number }[], key: string, on: boolean) => (on ? [] : clashNames(blocks, key, plan.timed));

  const electives = $derived(cat.courses.filter((x) => !x.required));
  const shownElectives = $derived(
    electives.filter((x) => match(x.code, x.name, x.prof, x.room, x.desc, x.college) && !(hideClash && !sch.electives.includes(x.id) && clashOf(x.blocks, `course:${x.id}`, false).length))
  );
  const shownClubs = $derived(
    cat.clubs.filter((x) => match(x.name, x.sponsor, x.where, x.desc, x.category, x.skills.join(' ')) && !(hideClash && !sch.clubs.includes(x.id) && clashOf(x.blocks, `club:${x.id}`, false).length))
  );
  const job = $derived(cat.jobs.find((j) => j.id === sch.job) ?? null);
  const shiftGroups = (j: CatalogJob) => groupBy(j.shifts, (x) => `${x.label}|${x.start ?? ''}|${x.end ?? ''}`);
  const shiftClash = (sh: CatalogJob['shifts'][number]) =>
    !sch.shifts.includes(sh.id) && sh.start !== null && sh.end !== null && clashNames([{ day: sh.day, start: sh.start, end: sh.end }], `job:${sh.id}`, plan.timed).length > 0;
  /* Clases que llevas (obligatorias + optativas) con su DC y el dado de estudio ganado. */
  const myCourses = $derived.by(() => {
    const p = picked(store.c, cat);
    return [...p.required, ...p.electives];
  });
  function setStudy(id: string, v: string) {
    const st = { ...store.c.strixhaven.schedule.study };
    if (v) st[id] = v;
    else delete st[id];
    store.c.strixhaven.schedule.study = st;
  }
  const teamInfo = (x: CatalogTeam) => [x.when, `${t('Entrenador')}: ${x.coach}`, `${t('Capitán')}: ${x.captain}`, `${t('Mascota')}: ${x.mascot}`].filter(Boolean).join(' · ');
</script>

<div class="card stack">
  <h2>{t('Mi horario')}</h2>
  <div class="counts">
    <span class:bad={tl.electives > rules.maxElectives || tl.level2 > rules.maxLevel2} class:ok={tl.electives >= rules.minElectives && tl.electives <= rules.maxElectives}>
      {t('Optativas')} <b>{tl.electives}</b>/{rules.maxElectives}
    </span>
    <span class:bad={tl.clubs > rules.maxClubs}>{t('Clubes')} <b>{tl.clubs}</b>/{rules.maxClubs}</span>
    <span class:bad={tl.jobs > rules.maxJobs || (tl.jobs > 0 && tl.scholarship && rules.scholarshipReplacesJob)}>{t('Trabajo')} <b>{tl.jobs}</b>/{rules.maxJobs}</span>
  </div>
  {#if tl.warnings.length}
    <ul class="warns">{#each tl.warnings as w (w)}<li>{w}</li>{/each}</ul>
  {:else}
    <p class="small okmsg">✓ {t('Todo cuadra: sin choques y dentro de los límites.')}</p>
  {/if}

  <div class="seg tabs" role="tablist">
    <button role="tab" class:on={tab === 'opt'} aria-selected={tab === 'opt'} onclick={() => (tab = 'opt')}>{t('Optativas')}</button>
    <button role="tab" class:on={tab === 'club'} aria-selected={tab === 'club'} onclick={() => (tab = 'club')}>{t('Clubes')}</button>
    {#if cat.teams.length}<button role="tab" class:on={tab === 'team'} aria-selected={tab === 'team'} onclick={() => (tab = 'team')}>Mage Tower</button>{/if}
    <button role="tab" class:on={tab === 'job'} aria-selected={tab === 'job'} onclick={() => (tab = 'job')}>{t('Trabajo')}</button>
  </div>

  {#if tab === 'opt' || tab === 'club'}
    <input type="search" bind:value={q} placeholder={t('Buscar por nombre, docente o lugar')} aria-label={t('Buscar')} />
    <label class="check small"><input type="checkbox" bind:checked={hideClash} /> {t('Ocultar lo que choca con mi horario')}</label>
  {/if}

  {#if tab === 'opt'}
    <p class="small muted">
      {rules.maxLevel2 >= rules.maxElectives
        ? t('Elige de {min} a {max} optativas. Las de Nivel 2.º año se dan con alumnos de 2.º y son más difíciles: se permiten, pero no se recomiendan.', { min: rules.minElectives, max: rules.maxElectives })
        : t('Elige de {min} a {max} optativas. Como mucho {l2} de Nivel 2.º año. Las obligatorias ya están en tu calendario.', { min: rules.minElectives, max: rules.maxElectives, l2: rules.maxLevel2 })}
      {#if rules.classDC}{t('Checks de clase: DC {dc}; Nivel 2.º año: DC {dc2}.', { dc: rules.classDC, dc2: rules.level2DC || rules.classDC })}{/if}
    </p>
    {#each groupBy(shownElectives, (x) => x.college || t('Otras')) as [college, list] (college)}
      <h3>{college}</h3>
      <ul class="items">
        {#each list as x (x.id)}
          {@const on = sch.electives.includes(x.id)}
          {@const cl = clashOf(x.blocks, `course:${x.id}`, on)}
          <li>
            <button class="item" class:on class:clashy={cl.length > 0} aria-pressed={on} disabled={!on && electiveBlocked(x)} onclick={() => toggleElective(x)}>
              <span class="box" aria-hidden="true">{on ? '✓' : ''}</span>
              <span class="body">
                <span class="top"><b class="code">{x.code}</b> <span class="nm">{x.name}</span>{#if x.level2}<span class="lvl">{t('Nivel 2.º año')}</span>{/if}{#if classDC(cat, x)}<span class="dc">DC {classDC(cat, x)}</span>{/if}</span>
                <span class="meta">{whenText(x.blocks, days)} · {x.room} · {x.prof}</span>
                {#if x.desc}<span class="desc">{x.desc}</span>{/if}
                {#if cl.length}<span class="why">{t('Choca con {list}', { list: cl.join(', ') })}</span>{/if}
              </span>
            </button>
          </li>
        {/each}
      </ul>
    {/each}
  {:else if tab === 'club'}
    <p class="small muted">
      {rules.jobUsesClubSlot
        ? t('Puedes estar en {n} clubes, o en un club y un trabajo.', { n: rules.maxClubs })
        : t('Puedes estar en hasta {n} clubes.', { n: rules.maxClubs })}
      {rules.teamCountsAsClub && cat.teams.length ? t('El equipo de Mage Tower cuenta como uno.') : ''}
      {t('Cada club da un Student Die (d4) con sus habilidades.')}
    </p>
    {#each groupBy(shownClubs, (x) => x.category || t('Otros')) as [category, list] (category)}
      <h3>{category}</h3>
      <ul class="items">
        {#each list as x (x.id)}
          {@const on = sch.clubs.includes(x.id)}
          {@const cl = clashOf(x.blocks, `club:${x.id}`, on)}
          <li>
            <button class="item" class:on class:clashy={cl.length > 0} aria-pressed={on} disabled={!on && clubBlocked(x)} onclick={() => toggleClub(x)}>
              <span class="box" aria-hidden="true">{on ? '✓' : ''}</span>
              <span class="body">
                <span class="top"><span class="nm">{x.name}</span></span>
                <span class="meta">{x.when}{x.where ? ` · ${x.where}` : ''}</span>
                <span class="meta">{x.sponsor}</span>
                {#if x.skills.length}<span class="meta"><b>Student Die:</b> {x.skills.join(', ')}</span>{/if}
                {#if x.desc}<span class="desc">{x.desc}</span>{/if}
                {#if x.yearEvent}<span class="meta">{t('Evento del año')}: {x.yearEvent}</span>{/if}
                {#if x.president}<span class="meta">{t('Presidencia')}: {x.president}{x.vice ? ` · ${t('Vicepresidencia')}: ${x.vice}` : ''}</span>{/if}
                {#if cl.length}<span class="why">{t('Choca con {list}', { list: cl.join(', ') })}</span>{/if}
              </span>
            </button>
          </li>
        {/each}
      </ul>
    {/each}
  {:else if tab === 'team'}
    <p class="small muted">
      {t('Los de Año 0 entran como suplentes con media beca. El equipo cuenta como club y la beca sustituye al trabajo. Solo un equipo.')}
      {#if !rules.teamGivesDie}{t('No da Student Die.')}{/if}
      {#if rules.teamPerk}{rules.teamPerk}{/if}
    </p>
    <ul class="items">
      <li>
        <button class="item" class:on={!sch.team} aria-pressed={!sch.team} onclick={() => setTeam('')}>
          <span class="box round" aria-hidden="true">{!sch.team ? '●' : ''}</span>
          <span class="body"><span class="nm">{t('Sin equipo')}</span></span>
        </button>
      </li>
      {#each cat.teams as x (x.id)}
        {@const on = sch.team === x.id}
        {@const cl = clashOf(x.blocks, `team:${x.id}`, on)}
        <li>
          <button class="item" class:on class:clashy={cl.length > 0} aria-pressed={on} onclick={() => setTeam(x.id)}>
            <span class="box round" aria-hidden="true">{on ? '●' : ''}</span>
            <span class="body">
              <span class="top"><span class="nm">{x.name}</span></span>
              <span class="meta">{teamInfo(x)}</span>
              {#if x.desc}<span class="desc">{x.desc}</span>{/if}
              {#if cl.length}<span class="why">{t('Choca con {list}', { list: cl.join(', ') })}</span>{/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="small muted">
      {t('Un trabajo como máximo.')}{rules.pay ? ` ${t('Paga')}: ${rules.pay}.` : ''}
      {t('Elige el lugar y marca los turnos que acuerdes.')}
    </p>
    <label class="check small"><input type="checkbox" checked={sch.scholarship} onchange={(e) => update((s) => (s.scholarship = e.currentTarget.checked))} /> {t('Tengo media beca por otro deporte')}</label>
    <ul class="items">
      <li>
        <button class="item" class:on={!sch.job} aria-pressed={!sch.job} onclick={() => setJob('')}>
          <span class="box round" aria-hidden="true">{!sch.job ? '●' : ''}</span>
          <span class="body"><span class="nm">{t('Sin trabajo')}</span></span>
        </button>
      </li>
      {#each cat.jobs as x (x.id)}
        {@const on = sch.job === x.id}
        <li>
          <button class="item" class:on aria-pressed={on} disabled={!on && rules.maxJobs < 1} onclick={() => setJob(x.id)}>
            <span class="box round" aria-hidden="true">{on ? '●' : ''}</span>
            <span class="body">
              <span class="top"><span class="nm">{x.name}</span></span>
              <span class="meta">{t('Turnos')}: {x.when}</span>
              <span class="meta">{t('Responde ante')}: {x.boss}</span>
              {#if x.desc}<span class="desc">{x.desc}</span>{/if}
            </span>
          </button>
          {#if on && job}
            <div class="job-more">
              {#if job.positions.length}
                <label class="field">
                  <span>{t('Puesto')}</span>
                  <select value={sch.position} onchange={(e) => update((s) => (s.position = e.currentTarget.value))}>
                    <option value="">{t('Sin elegir')}</option>
                    {#each job.positions as p (p)}<option value={p}>{p}</option>{/each}
                  </select>
                </label>
              {/if}
              {#each shiftGroups(job) as [k, list] (k)}
                {@const f = list[0]}
                <div class="turns">
                  <span class="small muted">{f.label} · {f.start !== null && f.end !== null ? fmtSpan(f.start, f.end) : t('hora a convenir')}</span>
                  <div class="turn-days">
                    {#each list as sh (sh.id)}
                      <button class="day" class:on={sch.shifts.includes(sh.id)} class:x={shiftClash(sh)} aria-pressed={sch.shifts.includes(sh.id)} title={shiftClash(sh) ? t('Choca con tu horario') : days[sh.day - 1]} onclick={() => toggleShift(sh.id)}>
                        {days[sh.day - 1]?.slice(0, 3) ?? sh.day}
                      </button>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if rules.classDC && myCourses.length}
  <div class="card stack">
    <h2>{t('Mis clases y checks')}</h2>
    <p class="small muted">{t('Cada clase tiene checks de {dice}, igual que los exámenes. Estudiando y yendo bien en clase ganas un dado de estudio; anótalo aquí.', { dice: rules.checkDice || '2d6' })}</p>
    <ul class="study">
      {#each myCourses as x (x.id)}
        <li>
          <span class="s-name"><b class="code">{x.code}</b> {x.name}</span>
          <span class="dc">DC {classDC(cat, x)}</span>
          <select aria-label={t('Dado de estudio de {name}', { name: x.code || x.name })} value={sch.study[x.id] ?? ''} onchange={(e) => setStudy(x.id, e.currentTarget.value)}>
            <option value="">{t('Sin dado')}</option>
            {#each rules.studyDice as d (d)}<option value={d}>{d}</option>{/each}
          </select>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .dc {
    font-size: 0.7rem;
    border: 1px solid var(--line);
    color: var(--muted);
    border-radius: 999px;
    padding: 0 6px;
    white-space: nowrap;
  }
  .study {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .study li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto 96px;
    gap: 8px;
    align-items: center;
    border-bottom: 1px solid var(--line);
    padding-bottom: 6px;
  }
  .s-name {
    font-size: 0.85rem;
    min-width: 0;
  }
  .counts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    font-size: 0.9rem;
  }
  .counts b {
    font-size: 1.1rem;
  }
  .counts .bad {
    color: var(--bad);
  }
  .counts .ok b {
    color: var(--good, #6c6);
  }
  .warns {
    margin: 0;
    padding-left: 18px;
    font-size: 0.85rem;
    color: var(--bad);
    display: grid;
    gap: 2px;
  }
  .okmsg {
    color: var(--good, #6c6);
    margin: 0;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .tabs button {
    flex: 1;
    min-width: 0;
    padding: 8px 4px;
    font-size: 0.85rem;
  }
  .tabs button.on {
    background: var(--accent);
    color: var(--accent-ink);
    border-color: var(--accent);
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
  h3 {
    margin: 10px 0 2px;
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .item {
    width: 100%;
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    gap: 10px;
    text-align: left;
    padding: 10px;
    min-height: 0;
    font-weight: 400;
  }
  .item.on {
    border-color: var(--accent);
  }
  .item:disabled {
    opacity: 0.45;
  }
  .box {
    width: 22px;
    height: 22px;
    border: 1.5px solid var(--line);
    border-radius: 6px;
    display: grid;
    place-items: center;
    font-size: 0.85rem;
    color: var(--accent-ink);
  }
  .box.round {
    border-radius: 50%;
    font-size: 0.7rem;
    color: var(--accent);
  }
  .item.on .box:not(.round) {
    background: var(--accent);
    border-color: var(--accent);
  }
  .item.on .box.round {
    border-color: var(--accent);
  }
  .body {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .top {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 8px;
    align-items: baseline;
  }
  .code {
    color: var(--accent);
    font-size: 0.85rem;
  }
  .nm {
    font-weight: 600;
  }
  .lvl {
    font-size: 0.7rem;
    border: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 999px;
    padding: 0 6px;
  }
  .meta {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .desc {
    font-size: 0.85rem;
  }
  .why {
    font-size: 0.8rem;
    color: var(--bad);
  }
  .item.clashy:not(.on) .nm {
    color: var(--muted);
  }
  .job-more {
    display: grid;
    gap: 8px;
    padding: 8px 0 4px 34px;
  }
  .turns {
    display: grid;
    gap: 4px;
  }
  .turn-days {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .day {
    min-height: 32px;
    padding: 2px 8px;
    font-size: 0.78rem;
  }
  .day.on {
    background: var(--accent);
    color: var(--accent-ink);
    border-color: var(--accent);
  }
  .day.x:not(.on) {
    border-color: var(--bad);
    color: var(--bad);
  }
</style>
