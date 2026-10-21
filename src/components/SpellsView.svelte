<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { compendium } from '../lib/compendium.svelte';
  import { uid, type SpellEntry } from '../lib/model/character';
  import type { PackSpell } from '../lib/model/pack';
  import { fmt, pactSlots, slotMax, spellcasting } from '../lib/rules/derive';
  import {
    castSpell,
    castingFor,
    findSpell,
    inClassList,
    isReady,
    maxSpellLevel,
    slotOptions,
    spellEntryFrom,
    spellLimits,
    spellList,
    spellUsage,
    spellKey,
    subclassSpells,
    featSpells,
    abilityLine,
    type GrantedSpell,
    type SlotOption
  } from '../lib/rules/spells';
  import type { Ref } from '../lib/rules/features';
  import { ABILITY_LABEL } from '../lib/rules/tables';
  import { canLoadLocal, importFiles, importLocalWiki, stalePacks } from '../lib/packImport';
  import { featInstances } from '../lib/rules/features';
  import Pips from './Pips.svelte';

  const c = $derived(store.c);
  const casting = $derived(spellcasting(c));
  const casters = $derived(c.classes.filter((k) => k.caster !== 'none'));
  const slots = $derived(slotMax(c));
  const pact = $derived(pactSlots(c));
  const LEVEL = (l: number) => (l === 0 ? 'Cantrips' : `Nivel ${l}`);

  let mode = $state<'mine' | 'add'>('mine');
  let q = $state('');
  let onlyReady = $state(false);
  let open = $state<string | null>(null);
  let casting_ = $state<string | null>(null); // id de la spell con el selector de slot abierto
  let flash = $state('');

  /* ---------- Spells de subclass ---------- */
  const sub = $derived(subclassSpells(c, compendium.packs));
  const feats = $derived(featSpells(c, compendium.packs));
  // Subclass primero; un feat que repite una spell de subclass solo agrega su uso gratis.
  const allGranted = $derived.by(() => {
    const out: GrantedSpell[] = [...sub.always];
    for (const g of feats.granted) if (!out.some((x) => x.key === g.key)) out.push(g);
    return out;
  });
  const grantedKeys = $derived(new Set(allGranted.map((g) => g.key)));
  const grantedSource = $derived(new Map(allGranted.map((g) => [g.key, g.source])));
  const grantedInfo = $derived(new Map(allGranted.map((g) => [g.key, g])));
  const freeOf = (s: SpellEntry) => {
    const g = feats.granted.find((x) => x.key === spellKey(s.name) && x.uses !== 'none' && x.freeKey);
    if (!g) return null;
    if (g.uses === 'will') return { key: '', label: 'a voluntad', used: false };
    return { key: g.freeKey!, label: g.uses === 'short' ? '1/SR' : '1/LR', used: !!c.freeUsed[g.freeKey!] };
  };
  const lineFor = (s: SpellEntry) => {
    const g = grantedInfo.get(spellKey(s.name));
    return g?.ability ? abilityLine(c, g.ability, g.source) : castingFor(c, s);
  };
  function pick(slotKey: string, index: number, n: number, name: string) {
    const st = (store.c.featSpells[slotKey] ??= { list: '', ability: null, picks: {} });
    const arr = [...(st.picks[index] ?? [])];
    arr[n] = name;
    st.picks[index] = arr;
  }
  function setList(slotKey: string, list: string) {
    const st = (store.c.featSpells[slotKey] ??= { list: '', ability: null, picks: {} });
    st.list = list;
    st.picks = {};
  }
  function setFeatAbility(slotKey: string, a: string) {
    const st = (store.c.featSpells[slotKey] ??= { list: '', ability: null, picks: {} });
    st.ability = a as typeof st.ability;
  }
  // Entradas virtuales: se muestran como siempre preparadas sin guardarse en el personaje.
  const virtual = $derived(
    allGranted
      .filter((g) => !c.spells.some((s) => spellKey(s.name) === g.key))
      .map<SpellEntry>((g) => ({
        id: `g:${g.key}`,
        ref: g.ref?.value ?? null,
        name: g.name,
        level: g.level,
        classId: g.classId,
        prepared: false,
        always: true,
        notes: ''
      }))
  );
  const isVirtual = (s: SpellEntry) => s.id.startsWith('g:');

  // Feats del personaje que ningún pack importado reconoce (no pueden dar spells ni efectos).
  const lostFeats = $derived(featInstances(c, compendium.packs).filter((f) => !f.feat && (f.name || f.ref)).map((f) => f.name || f.ref));

  /* ---------- Packs viejos ---------- */
  const stale = $derived(stalePacks());
  const noSpells = $derived(!compendium.packs.some((p) => p.spells.length));
  let importMsg = $state('');
  let fileInput = $state<HTMLInputElement>();
  async function updateLocal() {
    const r = await importLocalWiki();
    importMsg = r.done.length ? `Actualizado: ${r.done.join(', ')}.` : r.errors.join(' ');
  }
  async function onPackFile(e: Event & { currentTarget: HTMLInputElement }) {
    const files = [...(e.currentTarget.files ?? [])];
    e.currentTarget.value = '';
    const r = await importFiles(files);
    importMsg = r.done.length ? `Importado: ${r.done.join(', ')}.` : r.errors.join(' ');
  }

  /* ---------- Mis spells ---------- */
  const details = (s: SpellEntry): PackSpell | null => findSpell(compendium.packs, s.ref)?.item ?? null;

  const groups = $derived.by(() => {
    const term = q.trim().toLowerCase();
    const list = [...c.spells, ...virtual]
      .filter((s) => !term || s.name.toLowerCase().includes(term))
      .filter((s) => !onlyReady || isReady(c, s))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    const map = new Map<number, SpellEntry[]>();
    for (const s of list) map.set(s.level, [...(map.get(s.level) ?? []), s]);
    return [...map.entries()];
  });

  const needsPrep = (s: SpellEntry) => {
    if (s.level === 0 || s.always || grantedKeys.has(spellKey(s.name))) return false;
    const k = c.classes.find((x) => x.id === s.classId) ?? casters[0];
    return k ? spellLimits(c, k).kind === 'prepared' : false;
  };

  function castFree(s: SpellEntry, key: string) {
    cast(s, null);
    if (key) store.c.freeUsed[key] = true;
    flash = `${s.name} lanzada gratis (sin slot).`;
  }

  function cast(s: SpellEntry, opt: SlotOption | null, ritual = false) {
    const d = details(s);
    const conc = d?.concentration ? s.name : null;
    const prev = c.concentration;
    store.apply((x) => castSpell(x, ritual ? null : opt, conc));
    casting_ = null;
    const how = ritual ? 'como ritual' : opt ? (opt.kind === 'pact' ? `con Pact slot (nivel ${opt.level})` : `con slot de nivel ${opt.level}`) : '';
    flash = `${s.name} lanzada ${how}`.trim() + (conc && prev && prev !== s.name ? `. Terminó la concentration en ${prev}.` : '.');
    setTimeout(() => (flash = ''), 3500);
  }

  function remove(id: string) {
    const i = store.c.spells.findIndex((s) => s.id === id);
    if (i >= 0) store.c.spells.splice(i, 1);
  }

  /* ---------- Agregar ---------- */
  let addClass = $state<string>(''); // classId o '__all'
  let addLevel = $state<number | null>(null);
  let otherRules = $state(false);
  $effect(() => {
    if (!addClass && casters.length) addClass = casters[0].id;
    if (!addClass && !casters.length) addClass = '__all';
  });
  const addTarget = $derived(casters.find((k) => k.id === addClass) ?? null);
  const addMax = $derived(addTarget ? maxSpellLevel(c, addTarget) : 9);
  const have = $derived(new Set([...c.spells.map((s) => s.ref), ...virtual.map((s) => s.ref)].filter(Boolean)));

  const results = $derived.by(() => {
    if (mode !== 'add') return [];
    const term = q.trim().toLowerCase();
    const seen = new Set<string>();
    const out: Ref<PackSpell>[] = [];
    for (const r of spellList(compendium.packs, c.ruleset, otherRules)) {
      const s = r.item;
      const extra = addTarget ? (sub.expanded.get(addTarget.id)?.has(spellKey(s.name)) ?? false) : false;
      if (addTarget && !inClassList(s, addTarget.name) && !extra) continue;
      if (addTarget && s.level > addMax) continue;
      if (addLevel !== null && s.level !== addLevel) continue;
      if (term && !s.name.toLowerCase().includes(term)) continue;
      const k = s.name.toLowerCase();
      if (seen.has(k)) continue; // si hay dos packs con la misma spell, gana el del ruleset del personaje
      seen.add(k);
      out.push(r);
    }
    return out.sort((a, b) => a.item.level - b.item.level || a.item.name.localeCompare(b.item.name));
  });
  const isExpanded = (s: PackSpell) =>
    !!addTarget && !inClassList(s, addTarget.name) && (sub.expanded.get(addTarget.id)?.has(spellKey(s.name)) ?? false);

  /* Límites: no se puede agregar más cantrips (o spells conocidas) que los que da la clase, ni preparar de más. */
  const classOf = (s: SpellEntry) => c.classes.find((x) => x.id === s.classId) ?? casters[0] ?? null;
  function full(k: (typeof casters)[number] | null, level: number): boolean {
    if (!k) return false;
    const lim = spellLimits(c, k);
    const use = spellUsage(c, k, grantedKeys);
    if (level === 0) return lim.cantrips !== null && use.cantrips >= lim.cantrips;
    return lim.kind === 'known' && lim.spells !== null && use.spells >= lim.spells;
  }
  function prepFull(s: SpellEntry): boolean {
    const k = classOf(s);
    if (!k || s.prepared) return false;
    const lim = spellLimits(c, k);
    return lim.kind === 'prepared' && lim.spells !== null && spellUsage(c, k, grantedKeys).spells >= lim.spells;
  }
  const addLimitMsg = $derived.by(() => {
    if (!addTarget) return '';
    const lim = spellLimits(c, addTarget);
    const parts = [];
    if (full(addTarget, 0)) parts.push(`cantrips (${lim.cantrips})`);
    if (full(addTarget, 1)) parts.push(`spells conocidas (${lim.spells})`);
    return parts.length ? `Llegaste al máximo de ${parts.join(' y ')} de ${addTarget.name} ${addTarget.level}. Quita una para elegir otra.` : '';
  });

  function add(r: Ref<PackSpell>) {
    if (full(addTarget, r.item.level)) return;
    const classId = addTarget?.id ?? casters[0]?.id ?? null;
    store.c.spells.push(spellEntryFrom(r, classId));
  }

  let customName = $state('');
  let customLevel = $state(0);
  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    store.c.spells.push({ id: uid(), ref: null, name, level: customLevel, classId: casters[0]?.id ?? null, prepared: false, always: false, notes: '' });
    customName = '';
  }

  const tags = (d: PackSpell | null) => [d?.concentration ? 'C' : '', d?.ritual ? 'R' : ''].filter(Boolean);
  const shortTime = (t: string) =>
    t.replace(/^(1 )?bonus action.*/i, 'BA').replace(/^(1 )?reaction.*/i, 'Reacción').replace(/^(1 )?action.*/i, 'Acción');
</script>

<section class="spells">
  {#if stale.length || noSpells}
    <div class="card stack warnbox">
      <p class="small">
        {#if stale.length}
          Tu pack <b>{stale.map((p) => p.pack.id).join(', ')}</b> es de una versión anterior y le faltan datos que esta app ya usa (por ejemplo, las spells de feats como Fey Touched).
        {:else}
          Ningún pack importado trae spells.
        {/if}
        Importa de nuevo <b>content/dist/wiki-{c.ruleset}.json</b> de la carpeta nueva del proyecto.
      </p>
      <div class="row-btns">
        {#if canLoadLocal}<button class="primary" onclick={updateLocal}>Actualizar packs de la wiki</button>{/if}
        <button onclick={() => fileInput?.click()}>Elegir archivo...</button>
        <input bind:this={fileInput} type="file" accept="application/json,.json" multiple hidden onchange={onPackFile} />
      </div>
      {#if importMsg}<p class="small muted">{importMsg}</p>{/if}
    </div>
  {/if}

  {#if lostFeats.length}
    <div class="card warnbox">
      <p class="small">
        Estos feats no se encuentran en los packs importados, así que no pueden dar sus spells: <b>{lostFeats.join(', ')}</b>.
        Elígelos de nuevo de la lista en Editar > Clases y mejoras.
      </p>
    </div>
  {/if}

  {#if c.concentration}
    <div class="conc card">
      <span><small class="muted">Concentration</small><b>{c.concentration}</b></span>
      <button onclick={() => (store.c.concentration = '')}>Terminar</button>
    </div>
  {/if}
  {#if flash}<p class="flash small" role="status">{flash}</p>{/if}

  <div class="card top">
    {#each casters as k (k.id)}
      {@const line = casting.find((l) => l.classId === k.id)}
      {@const lim = spellLimits(c, k)}
      {@const use = spellUsage(c, k, grantedKeys)}
      {@const variant = sub.variants.find((v) => v.classId === k.id)}
      <div class="cls">
        <div class="cls-head">
          <b>{k.name} {k.level}</b>
          {#if line}<span class="muted">({ABILITY_LABEL[line.ability]})</span>{/if}
        </div>
        {#if line}
          <div class="nums">
            <span class="pair num"><small>Attack</small><b>{fmt(line.attack)}</b></span>
            <span class="pair num"><small>Save DC</small><b>{line.dc}</b></span>
            {#if lim.cantrips !== null}
              <span class="pair num" class:over={use.cantrips > lim.cantrips}><small>Cantrips</small><b>{use.cantrips}/{lim.cantrips}</b></span>
            {/if}
            {#if lim.spells !== null}
              <span class="pair num" class:over={use.spells > lim.spells}
                ><small>{lim.kind === 'prepared' ? 'Preparadas' : 'Conocidas'}</small><b>{use.spells}/{lim.spells}</b></span
              >
            {/if}
          </div>
        {/if}
        {#if (lim.cantrips !== null && use.cantrips > lim.cantrips) || (lim.spells !== null && use.spells > lim.spells)}
          <p class="warn small">Tienes más de las permitidas: quita las que sobran en Mis spells.</p>
        {/if}
        {#if variant}
          <label class="field variant">
            <span>{variant.subclass}: terreno</span>
            <select value={variant.value} onchange={(e) => (store.c.spellVariants[k.id] = e.currentTarget.value)}>
              {#each variant.options as o (o)}<option value={o}>{o}</option>{/each}
            </select>
          </label>
        {/if}
      </div>
    {:else}
      <p class="muted small">Ninguna de tus clases lanza spells. Igual puedes agregar spells de feats o rasgos desde "Agregar".</p>
    {/each}

    {#if pact.count > 0 || slots.some((m) => m > 0)}
      <div class="slots">
        {#if pact.count > 0}
          <div class="slot-row">
            <span class="slot-lvl pact num">P{pact.slotLevel}</span>
            <Pips total={pact.count} used={c.slotsUsed.pact} color="var(--pact)" label="Pact slot" onchange={(u) => (store.c.slotsUsed.pact = u)} />
          </div>
        {/if}
        {#each slots as max, i (i)}
          {#if max > 0}
            <div class="slot-row">
              <span class="slot-lvl num">{i + 1}</span>
              <Pips total={max} used={c.slotsUsed.levels[i]} label={`slot de nivel ${i + 1}`} onchange={(u) => (store.c.slotsUsed.levels[i] = u)} />
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>

  {#each feats.slots.filter((f) => f.picks.length || f.chooseAbility) as f (f.key)}
    <div class="card stack featsp">
      <h2>{f.name}: spells</h2>
      <div class="feat-opts">
        {#if f.lists.length > 1}
          <label class="field">
            <span>Lista de clase</span>
            <select value={f.list} onchange={(e) => setList(f.key, e.currentTarget.value)}>
              <option value="">Elegir...</option>
              {#each f.lists as l (l)}<option value={l}>{l}</option>{/each}
            </select>
          </label>
        {/if}
        {#if f.chooseAbility}
          <label class="field">
            <span>Ability</span>
            <select value={f.ability} onchange={(e) => setFeatAbility(f.key, e.currentTarget.value)}>
              {#each ['int', 'wis', 'cha'] as a (a)}<option value={a}>{ABILITY_LABEL[a as keyof typeof ABILITY_LABEL]}</option>{/each}
            </select>
          </label>
        {/if}
      </div>
      {#each f.picks as p (p.index)}
        <div class="feat-opts">
          {#each Array.from({ length: p.count }, (_, n) => n) as n (n)}
            <label class="field">
              <span>
                {p.level === 0 ? 'Cantrip' : `Nivel ${p.level}`}{p.schools.length ? ` (${p.schools.join(' o ')})` : ''}{p.attackOnly ? ' con attack roll' : ''}{p.uses === 'will' ? ', sin slot' : p.uses !== 'none' ? `, gratis ${p.uses === 'short' ? '1/SR' : '1/LR'}` : ''}{p.ritualOnly ? ' (ritual)' : ''}
              </span>
              <select value={p.chosen[n] ?? ''} disabled={p.lists.length > 0 && !f.list} onchange={(e) => pick(f.key, p.index, n, e.currentTarget.value)}>
                <option value="">{p.lists.length > 0 && !f.list ? 'Elige la lista primero' : 'Elegir...'}</option>
                {#each p.options as o (o.value)}<option value={o.item.name}>{o.item.name}</option>{/each}
              </select>
            </label>
          {/each}
        </div>
      {/each}
      <p class="muted small">Se lanzan con {ABILITY_LABEL[f.ability]}: attack {fmt(abilityLine(c, f.ability, f.name).attack)}, DC {abilityLine(c, f.ability, f.name).dc}. Aparecen en tu lista con ★ y no cuentan para el límite.</p>
    </div>
  {/each}

  <div class="seg" role="tablist">
    <button role="tab" class:on={mode === 'mine'} aria-selected={mode === 'mine'} onclick={() => (mode = 'mine')}
      >Mis spells ({c.spells.length + virtual.length})</button
    >
    <button role="tab" class:on={mode === 'add'} aria-selected={mode === 'add'} onclick={() => (mode = 'add')}>Agregar</button>
  </div>
  <input bind:value={q} placeholder="Buscar spell..." aria-label="Buscar spell" />

  {#if mode === 'mine'}
    <label class="check">
      <input type="checkbox" bind:checked={onlyReady} />
      <span>Solo las que puedo lanzar (cantrips, preparadas o conocidas)</span>
    </label>

    {#each groups as [lvl, list] (lvl)}
      <div class="card">
        <h2>{LEVEL(lvl)}</h2>
        {#each list as s (s.id)}
          {@const d = details(s)}
          {@const opts = slotOptions(c, s.level)}
          {@const line = lineFor(s)}
          {@const from = grantedSource.get(spellKey(s.name))}
          {@const free = freeOf(s)}
          <div class="sp" class:unready={!isReady(c, s)}>
            <div class="sp-row">
              {#if needsPrep(s)}
                <button
                  class="prep"
                  class:on={s.prepared}
                  aria-pressed={s.prepared}
                  aria-label={s.prepared ? `Despreparar ${s.name}` : `Preparar ${s.name}`}
                  disabled={prepFull(s)}
                  title={prepFull(s) ? 'Ya tienes el máximo de spells preparadas' : undefined}
                  onclick={() => (s.prepared = !s.prepared)}>{s.prepared ? '●' : '○'}</button
                >
              {:else}
                <span class="prep fixed" aria-hidden="true">{s.always || from ? '★' : s.level === 0 ? '✦' : '●'}</span>
              {/if}
              <button class="sp-name ghost" aria-expanded={open === s.id} onclick={() => (open = open === s.id ? null : s.id)}>
                <span class="nm">{s.name}</span>
                <span class="meta muted small">
                  {#if d}{shortTime(d.castingTime)} · {d.range}{/if}
                  {#each tags(d) as t (t)}<span class="tag">{t}</span>{/each}
                  {#if from}<span class="tag src">{from}</span>{/if}
                  {#if free}<span class="tag free" class:used={free.used}>{free.used ? 'gratis usado' : free.key ? `gratis ${free.label}` : 'sin slot'}</span>{/if}
                </span>
              </button>
              {#if s.level > 0 || d?.concentration || free}
                <button class="cast" onclick={() => (s.level === 0 && !free ? cast(s, null) : (casting_ = casting_ === s.id ? null : s.id))}>Lanzar</button>
              {/if}
            </div>

            {#if casting_ === s.id}
              <div class="chooser">
                {#each opts as o (o.kind + o.level)}
                  <button class:pact={o.kind === 'pact'} disabled={o.left <= 0} onclick={() => cast(s, o)}>
                    {o.kind === 'pact' ? `Pact ${o.level}` : `Nivel ${o.level}`} <small class="muted">({o.left})</small>
                  </button>
                {:else}
                  <span class="muted small">No tienes slots de nivel {s.level} o mayor.</span>
                {/each}
                {#if free}<button class="freebtn" disabled={free.used} onclick={() => castFree(s, free.key)}>{free.key ? `Gratis (${free.used ? 'usado' : free.label})` : 'Sin slot (a voluntad)'}</button>{/if}
                {#if d?.ritual}<button onclick={() => cast(s, null, true)}>Ritual (+10 min)</button>{/if}
                <button class="ghost" onclick={() => cast(s, null)}>Sin slot</button>
              </div>
            {/if}

            {#if open === s.id}
              <div class="body">
                {#if d}
                  <dl class="facts small">
                    <div><dt>Casting time</dt><dd>{d.castingTime}{d.ritual ? ' (ritual)' : ''}</dd></div>
                    <div><dt>Range</dt><dd>{d.range}</dd></div>
                    <div><dt>Components</dt><dd>{d.components}{d.material ? ` (${d.material})` : ''}</dd></div>
                    <div><dt>Duration</dt><dd>{d.duration}</dd></div>
                    <div><dt>School</dt><dd>{d.school}{line ? ` · ${line.className}: ${fmt(line.attack)} / DC ${line.dc}` : ''}</dd></div>
                  </dl>
                  <p class="text">{d.text || 'Sin texto.'}</p>
                  {#if d.higher}<p class="text higher"><b>{s.level === 0 ? 'Mejora' : 'Slot mayor'}:</b> {d.higher}</p>{/if}
                  {#if d.source}<p class="muted small">{d.source} · {d.classes.join(', ')}</p>{/if}
                {:else}
                  <p class="muted small">{s.ref ? 'El pack de esta spell no está importado.' : 'Spell agregada a mano.'}</p>
                {/if}
                {#if isVirtual(s)}
                  <p class="muted small">
                    Siempre preparada por {from}. No cuenta para tu límite.{free ? (free.key ? ` Una vez gratis por ${free.label === '1/SR' ? 'Short o Long Rest' : 'Long Rest'}, o con tus slots.` : ' Se lanza sin gastar slot, cuando quieras.') : ''}
                  </p>
                {:else}
                  <textarea bind:value={s.notes} placeholder="Notas (daño al subir de nivel, usos gratis, etc.)" aria-label="Notas"></textarea>
                  <div class="opts">
                    {#if casters.length > 1}
                      <label class="field small">
                        <span>Clase</span>
                        <select bind:value={s.classId}>
                          {#each casters as k (k.id)}<option value={k.id}>{k.name}</option>{/each}
                        </select>
                      </label>
                    {/if}
                    {#if s.level > 0 && !from}
                      <label class="check small">
                        <input type="checkbox" bind:checked={s.always} />
                        <span>Siempre preparada (no cuenta)</span>
                      </label>
                    {/if}
                    <button class="danger" onclick={() => remove(s.id)}>Quitar</button>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="card">
        <p class="muted small">
          {c.spells.length ? 'Ninguna spell coincide.' : 'Aún no tienes spells. Toca "Agregar" para elegirlas de tu lista de clase.'}
        </p>
      </div>
    {/each}
  {:else}
    <div class="card stack">
      <div class="filters">
        <label class="field">
          <span>Lista</span>
          <select bind:value={addClass}>
            {#each casters as k (k.id)}<option value={k.id}>{k.name} (hasta nivel {maxSpellLevel(c, k)})</option>{/each}
            <option value="__all">Todas las listas</option>
          </select>
        </label>
        <label class="field">
          <span>Nivel</span>
          <select
            value={addLevel === null ? '' : String(addLevel)}
            onchange={(e) => (addLevel = e.currentTarget.value === '' ? null : Number(e.currentTarget.value))}
          >
            <option value="">Todos</option>
            {#each Array.from({ length: (addTarget ? addMax : 9) + 1 }, (_, i) => i) as l (l)}<option value={String(l)}>{LEVEL(l)}</option>{/each}
          </select>
        </label>
      </div>
      <label class="check small">
        <input type="checkbox" bind:checked={otherRules} />
        <span>Incluir spells del otro ruleset</span>
      </label>
      {#if addLimitMsg}<p class="warn small">{addLimitMsg}</p>{/if}
      <ul class="results">
        {#each results as r (r.value)}
          {@const s = r.item}
          {@const added = have.has(r.value)}
          {@const capped = !added && full(addTarget, s.level)}
          <li>
            <div class="res-row">
              <button class="ghost res-name" aria-expanded={open === r.value} onclick={() => (open = open === r.value ? null : r.value)}>
                <span class="nm">{s.name}</span>
                <span class="muted small"
                  >{s.level === 0 ? 'Cantrip' : `Nivel ${s.level}`} · {s.school}{s.concentration ? ' · C' : ''}{s.ritual ? ' · R' : ''}{isExpanded(s)
                    ? ' · lista expandida'
                    : ''}</span
                >
              </button>
              <button class="add" disabled={added || capped} aria-label={`Agregar ${s.name}`} title={capped ? 'Máximo alcanzado' : undefined} onclick={() => add(r)}
                >{added ? '✓' : capped ? '–' : '+'}</button
              >
            </div>
            {#if open === r.value}
              <div class="body small">
                <p class="muted">{s.castingTime}{s.ritual ? ' (ritual)' : ''} · {s.range} · {s.components}{s.material ? ` (${s.material})` : ''} · {s.duration}</p>
                <p class="text">{s.text}</p>
                {#if s.higher}<p class="text higher"><b>{s.level === 0 ? 'Mejora' : 'Slot mayor'}:</b> {s.higher}</p>{/if}
                <p class="muted">{s.source} · {s.classes.join(', ')}</p>
              </div>
            {/if}
          </li>
        {:else}
          <li class="muted small">Sin resultados.</li>
        {/each}
      </ul>
    </div>

    <div class="card stack">
      <h2>Agregar a mano</h2>
      <div class="custom">
        <input bind:value={customName} placeholder="Nombre (homebrew o de otra fuente)" aria-label="Nombre de la spell" />
        <select bind:value={customLevel} aria-label="Nivel">
          {#each Array.from({ length: 10 }, (_, i) => i) as l (l)}<option value={l}>{l === 0 ? 'Cantrip' : l}</option>{/each}
        </select>
        <button onclick={addCustom}>+</button>
      </div>
    </div>
  {/if}
</section>

<style>
  .spells {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }
  .warnbox {
    border-color: color-mix(in srgb, var(--accent) 60%, var(--line));
  }
  .warn {
    color: var(--accent);
    margin: 0;
  }
  .warnbox p {
    margin: 0;
  }
  .row-btns {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .conc {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    border-color: color-mix(in srgb, var(--pact) 60%, var(--line));
  }
  .conc span {
    display: flex;
    flex-direction: column;
  }
  .flash {
    margin: 0;
    padding: 10px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--good) 15%, var(--surface));
    color: var(--good);
  }
  .top {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  }
  .top > p,
  .top > .slots {
    grid-column: 1 / -1;
  }
  .cls-head {
    display: flex;
    gap: 6px;
    align-items: baseline;
    margin-bottom: 6px;
  }
  .nums {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
  }
  .pair {
    display: flex;
    flex-direction: column;
  }
  .pair small {
    font-size: 0.7rem;
    color: var(--muted);
  }
  .pair b {
    font-size: 1.15rem;
  }
  .pair.over b {
    color: var(--bad);
  }
  .variant {
    margin-top: 8px;
  }
  .variant select {
    min-height: 40px;
  }
  .slots {
    display: grid;
    gap: 6px;
    border-top: 1px solid var(--line);
    padding-top: 10px;
  }
  .slot-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .slot-lvl {
    width: 28px;
    font-weight: 700;
    color: var(--muted);
  }
  .slot-lvl.pact {
    color: var(--pact);
  }
  .seg {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    background: var(--bg);
    padding: 4px;
    border-radius: 12px;
  }
  .seg button {
    border: none;
    background: transparent;
    min-height: 42px;
  }
  .seg button.on {
    background: var(--surface-2);
    color: var(--accent);
    font-weight: 650;
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
  .sp {
    border-top: 1px solid var(--line);
  }
  .sp:first-of-type {
    border-top: none;
  }
  .sp.unready .nm {
    color: var(--muted);
  }
  .sp-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: var(--tap);
  }
  .prep {
    width: 36px;
    min-height: 36px;
    padding: 0;
    border-radius: 50%;
    flex-shrink: 0;
    color: var(--muted);
    display: grid;
    place-items: center;
  }
  .prep.on {
    color: var(--accent);
    border-color: var(--accent);
  }
  .prep.fixed {
    border: none;
    color: var(--accent);
  }
  .sp-name,
  .res-name {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    border: none;
    padding: 6px 4px;
  }
  .nm {
    font-weight: 600;
  }
  .meta {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }
  .tag {
    font-size: 0.68rem;
    padding: 0 6px;
    border-radius: 999px;
    border: 1px solid var(--line);
  }
  .tag.free {
    color: var(--good);
    border-color: color-mix(in srgb, var(--good) 50%, var(--line));
  }
  .tag.free.used {
    color: var(--muted);
    border-color: var(--line);
    text-decoration: line-through;
  }
  .chooser button.freebtn {
    border-color: var(--good);
    color: var(--good);
  }
  .feat-opts {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
  }
  .featsp h2 {
    margin-bottom: 0;
  }
  .featsp p {
    margin: 0;
  }
  .tag.src {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 50%, var(--line));
  }
  .cast {
    min-height: 38px;
    padding: 0 12px;
    font-size: 0.85rem;
  }
  .chooser {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 0 10px 42px;
  }
  .chooser button {
    min-height: 40px;
    padding: 0 12px;
    font-size: 0.85rem;
  }
  .chooser button.pact {
    border-color: var(--pact);
    color: var(--pact);
  }
  .body {
    padding: 0 0 12px 42px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .facts {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 6px 12px;
    margin: 0;
  }
  .facts dt {
    color: var(--muted);
    font-size: 0.72rem;
  }
  .facts dd {
    margin: 0;
  }
  .text {
    margin: 0;
    line-height: 1.5;
    white-space: pre-line;
  }
  .higher {
    color: var(--muted);
  }
  .body p {
    margin: 0;
  }
  .body textarea {
    min-height: 60px;
  }
  .opts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .opts .field {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .opts select {
    width: auto;
    min-height: 40px;
  }
  .opts button {
    min-height: 40px;
  }
  .filters {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .field > span {
    font-size: 0.78rem;
    color: var(--muted);
  }
  .results {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .results li {
    border-top: 1px solid var(--line);
  }
  .res-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .add {
    width: 44px;
    padding: 0;
    flex-shrink: 0;
  }
  .results .body {
    padding-left: 4px;
  }
  .custom {
    display: grid;
    grid-template-columns: 1fr 96px 48px;
    gap: 6px;
  }
  .custom button {
    padding: 0;
  }
</style>
