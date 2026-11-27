<script lang="ts">
  import { untrack } from 'svelte';
  import { t } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';
  import { campaigns } from '../lib/campaigns.svelte';
  import { uid } from '../lib/model/character';
  import StrixCourses from './StrixCourses.svelte';

  /* Pestaña Campaña (opcional): campaña del PJ abierto, sus datos y, si es Strixhaven, calendario y clases. */
  const camp = $derived(campaigns.get(store.c.campaignId));
  const members = $derived(camp ? store.list.filter((x) => x.campaignId === camp.id) : []);

  // Guarda la campaña cuando cambia algo del formulario.
  let lastSaved = '';
  $effect(() => {
    if (!camp) return;
    const json = JSON.stringify(camp);
    untrack(() => {
      if (lastSaved && json !== lastSaved) campaigns.touch(camp.id);
      lastSaved = json;
    });
  });

  let creating = $state(false);
  let newName = $state('');
  let confirmDelete = $state(false);

  function pick(v: string) {
    confirmDelete = false;
    if (v === '__new') {
      creating = true;
      return;
    }
    creating = false;
    store.c.campaignId = v || null;
    const k = campaigns.get(v);
    if (k?.strixhaven) store.c.strixhaven.enabled = true;
  }
  async function create() {
    const k = await campaigns.create(newName.trim() || t('Nueva campaña'));
    store.c.campaignId = k.id;
    creating = false;
    newName = '';
  }
  function setStrix(on: boolean) {
    if (!camp) return;
    camp.strixhaven = on;
    if (on) store.c.strixhaven.enabled = true;
  }
  async function removeCampaign() {
    if (!camp) return;
    if (!confirmDelete) {
      confirmDelete = true;
      return;
    }
    const id = camp.id;
    store.c.campaignId = null;
    await campaigns.remove(id);
    confirmDelete = false;
  }

  /* ---------- Calendario de 10 días ---------- */
  let viewWeek = $state(1);
  let viewFor = '';
  $effect(() => {
    // Al abrir otra campaña, el calendario se ubica en su semana actual.
    if (camp && camp.id !== viewFor) {
      viewFor = camp.id;
      viewWeek = untrack(() => camp.calendar.week);
    }
  });
  const cal = $derived(camp?.calendar);
  function step(d: -1 | 1) {
    if (!camp) return;
    const k = camp.calendar;
    let day = k.day + d;
    let week = k.week;
    if (day > 10) {
      day = 1;
      week += 1;
    } else if (day < 1) {
      if (week === 1) return;
      day = 10;
      week -= 1;
    }
    k.day = day;
    k.week = week;
    viewWeek = week;
  }
  const coursesOn = (d: number) => store.c.strixhaven.courses.filter((x) => x.days.includes(d));
  const eventsOn = (w: number, d: number) => camp?.events.filter((e) => e.week === w && e.day === d) ?? [];

  let addingDay = $state<number | null>(null);
  let eventTitle = $state('');
  function addEvent(d: number) {
    if (!camp || !eventTitle.trim()) return;
    camp.events.push({ id: uid(), week: viewWeek, day: d, title: eventTitle.trim(), notes: '' });
    eventTitle = '';
    addingDay = null;
  }
  function removeEvent(id: string) {
    if (!camp) return;
    camp.events = camp.events.filter((e) => e.id !== id);
  }
  const upcoming = $derived(
    camp
      ? camp.events
          .filter((e) => e.week > camp.calendar.week || (e.week === camp.calendar.week && e.day >= camp.calendar.day))
          .sort((a, b) => a.week - b.week || a.day - b.day)
          .slice(0, 5)
      : []
  );
</script>

<section class="stack">
  <div class="card stack">
    <h2>{t('Campaña')}</h2>
    <label class="field">
      <span>{t('Campaña de {name}', { name: store.c.name || t('este personaje') })}</span>
      <select value={creating ? '__new' : (store.c.campaignId ?? '')} onchange={(e) => pick(e.currentTarget.value)}>
        <option value="">{t('Sin campaña')}</option>
        {#each campaigns.list as k (k.id)}<option value={k.id}>{k.name || t('Sin nombre')}</option>{/each}
        <option value="__new">+ {t('Nueva campaña')}</option>
      </select>
    </label>
    {#if creating}
      <div class="row">
        <input class="grow" bind:value={newName} placeholder={t('Nombre de la campaña')} aria-label={t('Nombre de la campaña')} onkeydown={(e) => e.key === 'Enter' && create()} />
        <button class="primary" onclick={create}>{t('Crear')}</button>
        <button class="ghost" onclick={() => (creating = false)}>{t('Cancelar')}</button>
      </div>
    {/if}
    {#if !camp && !creating}
      <p class="small muted">{t('Crea una campaña o elige una existente para guardar sus detalles y compartirlos entre tus PJs.')}</p>
    {/if}
  </div>

  {#if camp}
    <div class="card stack">
      <h2>{t('Detalles')}</h2>
      <div class="grid2">
        <label class="field"><span>{t('Nombre')}</span><input bind:value={camp.name} /></label>
        <label class="field"><span>DM</span><input bind:value={camp.dm} /></label>
      </div>
      <label class="check">
        <input type="checkbox" checked={camp.strixhaven} onchange={(e) => setStrix(e.currentTarget.checked)} />
        {t('Campaña de Strixhaven (calendario de 10 días y clases)')}
      </label>
      <label class="field">
        <span>{t('Detalles y house rules')}</span>
        <textarea rows="5" bind:value={camp.notes} placeholder={t('Lo que acordaste con tu DM: reglas de la mesa, level inicial, contenido permitido...')}></textarea>
      </label>
      {#if members.length}
        <div class="members">
          <span class="small muted">{t('PJs en esta campaña')}:</span>
          {#each members as m (m.id)}
            {#if m.id === store.currentId}
              <span class="chip on">{m.name}</span>
            {:else}
              <button class="chip" onclick={() => store.select(m.id)}>{m.name}</button>
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    {#if camp.strixhaven && cal}
      <div class="card stack">
        <h2>{t('Calendario')}</h2>
        <div class="grid2">
          <label class="field"><span>{t('Término o período')}</span><input bind:value={camp.calendar.term} placeholder={t('Ej. Year 1, Fall')} /></label>
          <div class="field today">
            <span>{t('Hoy')}</span>
            <div class="row">
              <button class="ghost" aria-label={t('Día anterior')} onclick={() => step(-1)}>◀</button>
              <b class="grow">{t('Semana')} {cal.week} · {cal.dayNames[cal.day - 1]}</b>
              <button class="ghost" aria-label={t('Día siguiente')} onclick={() => step(1)}>▶</button>
            </div>
          </div>
        </div>

        <div class="week-nav">
          <button class="ghost" aria-label={t('Semana anterior')} disabled={viewWeek <= 1} onclick={() => (viewWeek = Math.max(1, viewWeek - 1))}>‹</button>
          <b>{t('Semana')} {viewWeek}</b>
          <button class="ghost" aria-label={t('Semana siguiente')} onclick={() => (viewWeek += 1)}>›</button>
          {#if viewWeek !== cal.week}<button class="ghost small" onclick={() => (viewWeek = cal.week)}>{t('Ir a hoy')}</button>{/if}
        </div>

        <ol class="days">
          {#each cal.dayNames as name, i (i)}
            {@const d = i + 1}
            {@const isToday = viewWeek === cal.week && d === cal.day}
            <li class:today={isToday}>
              <div class="d-head">
                <b>{name}</b>
                {#if isToday}<span class="tag">{t('Hoy')}</span>{/if}
                <span class="spacer"></span>
                <button class="ghost add" aria-label={t('Agregar evento el {day}', { day: name })} onclick={() => ((addingDay = addingDay === d ? null : d), (eventTitle = ''))}>+</button>
              </div>
              {#each coursesOn(d) as x (x.id)}
                <div class="item course" class:elective={x.kind === 'elective'}>{x.name || t('Clase sin nombre')}{x.time ? ` · ${x.time}` : ''}{x.place ? ` · ${x.place}` : ''}</div>
              {/each}
              {#each eventsOn(viewWeek, d) as e (e.id)}
                <div class="item event">
                  <span class="grow">★ {e.title}</span>
                  <button class="ghost x" aria-label={t('Quitar evento {name}', { name: e.title })} onclick={() => removeEvent(e.id)}>✕</button>
                </div>
              {/each}
              {#if addingDay === d}
                <div class="row">
                  <input class="grow" bind:value={eventTitle} placeholder={t('Evento (ej. examen, fiesta, partido)')} aria-label={t('Evento')} onkeydown={(e) => e.key === 'Enter' && addEvent(d)} />
                  <button class="primary" onclick={() => addEvent(d)}>{t('Agregar')}</button>
                </div>
              {/if}
            </li>
          {/each}
        </ol>

        {#if upcoming.length}
          <div class="stack tight">
            <span class="small muted">{t('Próximos eventos')}</span>
            {#each upcoming as e (e.id)}
              <span class="small">{t('Semana')} {e.week} · {cal.dayNames[e.day - 1]}: <b>{e.title}</b></span>
            {/each}
          </div>
        {/if}

        <details>
          <summary class="small">{t('Nombres de los días')}</summary>
          <div class="names">
            {#each camp.calendar.dayNames as _, i (i)}
              <input bind:value={camp.calendar.dayNames[i]} aria-label={t('Nombre del día {n}', { n: i + 1 })} />
            {/each}
          </div>
        </details>
      </div>

      <StrixCourses dayNames={cal.dayNames} />
    {/if}

    <div class="card stack">
      <div class="row">
        <button onclick={() => (store.c.campaignId = null)}>{t('Quitar a este PJ de la campaña')}</button>
        <button class="danger" onclick={removeCampaign}>{confirmDelete ? t('¿Seguro? Toca otra vez para borrar') : t('Borrar campaña')}</button>
      </div>
      <p class="small muted">{t('Borrar la campaña no borra a tus PJs, solo los desvincula.')}</p>
    </div>
  {/if}
</section>

<style>
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .grow {
    flex: 1;
    min-width: 0;
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
  .members {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .chip {
    padding: 4px 10px;
    border: 1px solid var(--line);
    border-radius: 999px;
    min-height: 0;
    font-size: 0.85rem;
  }
  .chip.on {
    border-color: var(--accent);
    color: var(--accent);
  }
  .today .row {
    align-items: center;
    gap: 4px;
  }
  .today b {
    text-align: center;
  }
  .week-nav {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .days {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .days li {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 6px 10px;
    display: grid;
    gap: 4px;
  }
  .days li.today {
    border-color: var(--accent);
  }
  .d-head {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tag {
    font-size: 0.7rem;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 999px;
    padding: 0 6px;
  }
  .spacer {
    flex: 1;
  }
  .add,
  .x {
    min-height: 0;
    padding: 2px 8px;
  }
  .item {
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .item.course {
    color: var(--muted);
  }
  .item.course::before {
    content: '▸ ';
  }
  .item.course.elective {
    font-style: italic;
  }
  .names {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    margin-top: 6px;
  }
  .tight {
    gap: 2px;
  }
</style>
