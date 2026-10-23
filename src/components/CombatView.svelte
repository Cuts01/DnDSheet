<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';
  import {
    armorClassInfo,
    attacks,
    casterLevel,
    fmt,
    hitDicePools,
    initiative,
    maxHp,
    pactSlots,
    pb,
    speed,
    slotMax,
    spellcasting
  } from '../lib/rules/derive';
  import { damage, heal, longRest, setTemp } from '../lib/rules/rests';
  import { ABILITY_LABEL } from '../lib/rules/tables';
  import Pips from './Pips.svelte';
  import { compendium } from '../lib/compendium.svelte';
  import { allGrantedEffects as grantedEffects, proficiencies } from '../lib/rules/features';
  import { EFFECT_LABEL, type Effect } from '../lib/model/character';
  import ShortRestDialog from './ShortRestDialog.svelte';
  import { featSpells, spellAttacks, subclassSpells } from '../lib/rules/spells';
  import { featureChoiceSlots, featureResources, resistances } from '../lib/rules/grants';

  const c = $derived(store.c);
  const pact = $derived(pactSlots(c));
  const slots = $derived(slotMax(c));
  const hasSlots = $derived(casterLevel(c) > 0);
  const casting = $derived(spellcasting(c));
  const pools = $derived(hitDicePools(c));
  const hpMax = $derived(maxHp(c));
  const hpPct = $derived(hpMax > 0 ? Math.max(0, Math.min(1, c.hp.current / hpMax)) : 0);

  const granted = $derived(grantedEffects(c, compendium.packs));
  const ac = $derived(armorClassInfo(c, granted));
  const atk = $derived(attacks(c, proficiencies(c, compendium.packs).weapons, granted));
  const splitDmg = (d: string): [string, string] => {
    const m = /^(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*(.*)$/.exec(d);
    return m ? [m[1], m[2]] : [d, ''];
  };
  const spellAtk = $derived(
    spellAttacks(c, compendium.packs, [...subclassSpells(c, compendium.packs).always, ...featSpells(c, compendium.packs).granted])
  );
  const toggles = $derived([
    ...c.effects.filter((e) => e.conditional).map((e) => ({ e, fromFeature: false })),
    ...granted.filter((e) => e.conditional).map((e) => ({ e, fromFeature: true }))
  ]);

  function flip(e: Effect, fromFeature: boolean) {
    if (fromFeature) {
      store.c.toggles[e.id] = !e.active;
    } else {
      const i = store.c.effects.findIndex((x) => x.id === e.id);
      if (i >= 0) store.c.effects[i].active = !e.active;
    }
  }

  const fres = $derived(featureResources(c, compendium.packs));
  const resist = $derived(resistances(c, compendium.packs));
  const optionText = $derived(
    new Map(featureChoiceSlots(c, compendium.packs).flatMap((s) => s.options.map((o) => [`${s.featureId}|${o.name}`, o.text] as const)))
  );
  let openPick = $state<string | null>(null);
  const rechargeLabel = (r: string) => (r === 'short' ? 'Short Rest' : r === 'short1' ? t('1 por Short Rest') : r === 'long' ? 'Long Rest' : 'manual');

  let amount = $state<number | null>(null);
  let shortOpen = $state(false);

  function act(kind: 'dmg' | 'heal' | 'temp') {
    const n = amount ?? 0;
    if (n <= 0 && kind !== 'temp') return;
    store.apply((ch) => (kind === 'dmg' ? damage(ch, n) : kind === 'heal' ? heal(ch, n) : setTemp(ch, n)));
    amount = null;
  }

  function doLongRest() {
    const hd = c.ruleset === '2024' ? t('todos los Hit Dice') : t('la mitad de tus Hit Dice');
    if (confirm(t('Long Rest: HP al máximo, temp HP a 0, todos los slots y recursos, y {hd}. ¿Continuar?', { hd }))) {
      store.apply(longRest);
    }
  }
</script>

<section class="stack">
  {#if c.concentration}
    <div class="card conc">
      <span><small class="muted">Concentration</small> <b>{c.concentration}</b></span>
      <button onclick={() => (store.c.concentration = '')}>{t('Terminar')}</button>
    </div>
  {/if}
  <div class="rests">
    <button onclick={() => (shortOpen = true)}>Short Rest</button>
    <button class="primary" onclick={doLongRest}>Long Rest</button>
  </div>

  <div class="card hp">
    <h2>Hit Points</h2>
    <div class="hp-top">
      <div class="hp-num num">
        <b class:low={hpPct <= 0.25} class:zero={c.hp.current <= 0}>{c.hp.current}</b>
        <span class="muted">/ {hpMax}</span>
      </div>
      {#if c.hp.temp > 0}
        <div class="temp num" title="Temp HP">+{c.hp.temp} temp</div>
      {/if}
    </div>
    <div class="bar" aria-hidden="true">
      <span style:width={`${hpPct * 100}%`}></span>
    </div>
    <div class="hp-actions">
      <input
        class="num"
        type="number"
        inputmode="numeric"
        min="0"
        placeholder="0"
        aria-label={t('Cantidad')}
        bind:value={amount}
        onkeydown={(e) => e.key === 'Enter' && act('dmg')}
      />
      <button class="danger" onclick={() => act('dmg')}>{t('Daño')}</button>
      <button class="heal" onclick={() => act('heal')}>{t('Curar')}</button>
      <button class="tempbtn" onclick={() => act('temp')}>Temp</button>
    </div>
    <p class="muted small hint">{t('Temp fija el valor. Los temp HP no se suman: quédate con el mayor.')}</p>
  </div>

  <div class="quick">
    <div class="stat" title={ac.label}><span>AC</span><b class="num">{ac.total}</b></div>
    <div class="stat"><span>Initiative</span><b class="num">{fmt(initiative(c, granted))}</b></div>
    <div class="stat"><span>Speed</span><b class="num">{speed(c, granted)}</b></div>
    <div class="stat"><span>Prof.</span><b class="num">{fmt(pb(c))}</b></div>
  </div>

  {#if resist.length}
    <p class="resist small"><span class="muted">{t('Resistencias')}:</span> {resist.join(', ')}</p>
  {/if}

  {#if toggles.length}
    <div class="toggles" role="group" aria-label={t('Efectos condicionales')}>
      {#each toggles as { e, fromFeature } (e.id)}
        <button class="toggle" class:on={e.active} aria-pressed={e.active} onclick={() => flip(e, fromFeature)}>
          {e.source || t('Efecto')} <span class="num">{fmt(e.value)}{e.target === 'speed' ? ' ft' : e.target === 'ac' ? ' AC' : e.target === 'initiative' ? ' init' : ' ' + EFFECT_LABEL[e.target]}</span>
        </button>
      {/each}
    </div>
  {/if}

  <div class="card">
    <h2>{t('Ataques')}</h2>
    <ul class="attacks">
      {#each atk as w (w.id)}
        <li>
          <div class="atk-main">
            <span class="atk-name">{w.name}</span>
            <span class="pair num"><small>Hit</small><b>{fmt(w.toHit)}</b></span>
            <span class="pair num dmg"><small>{t('Daño')}</small><b>{w.damage}</b></span>
          </div>
          <div class="atk-sub muted small">
            {w.damageType}{w.versatile ? ` · versatile ${w.versatile}` : ''}{w.notes.length ? ` · ${w.notes.join(' · ')}` : ''}
          </div>
        </li>
      {/each}
      {#each spellAtk as s (s.id)}
        <li class="spell">
          <div class="atk-main">
            <span class="atk-name">{s.name}</span>
            {#if s.kind === 'attack'}
              <span class="pair num"><small>Hit</small><b>{fmt(s.toHit)}</b></span>
            {:else if s.kind === 'save'}
              <span class="pair num"><small>{s.save ? ABILITY_LABEL[s.save as keyof typeof ABILITY_LABEL] : 'Save'}</small><b>DC {s.dc}</b></span>
            {:else}
              <span class="pair num"><small>{t('Impacta')}</small><b>auto</b></span>
            {/if}
            <span class="pair num dmg"><small>{t('Daño')}</small><b>{splitDmg(s.damage)[0]}</b></span>
          </div>
          <div class="atk-sub muted small">
            spell · {splitDmg(s.damage)[1] || t('daño')}{s.note ? ` · ${s.note}` : ''}
          </div>
        </li>
      {/each}
    </ul>
    <p class="muted small hint">{t('Equipa weapons en la pestaña Equipo. Los spells de daño que puedes lanzar aparecen aquí.')}</p>
  </div>

  {#if casting.length}
    <div class="card">
      <h2>Spellcasting</h2>
      <div class="casting">
        {#each casting as line (line.classId)}
          <div class="cast-line">
            <span>{line.className} <span class="muted">({ABILITY_LABEL[line.ability]})</span></span>
            <span class="pair num"><small>Spell attack</small><b>{fmt(line.attack)}</b></span>
            <span class="pair num"><small>Save DC</small><b>{line.dc}</b></span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if pact.count > 0}
    <div class="card">
      <h2>Pact slots <span class="lvl">{t('nivel')} {pact.slotLevel}</span></h2>
      <Pips
        total={pact.count}
        used={c.slotsUsed.pact}
        color="var(--pact)"
        label="Pact slot"
        onchange={(u) => (store.c.slotsUsed.pact = u)}
      />
      <p class="muted small hint">{t('Se recuperan en Short Rest.')}</p>
    </div>
  {/if}

  {#if hasSlots}
    <div class="card">
      <h2>Spell slots</h2>
      <div class="slots">
        {#each slots as max, i (i)}
          {#if max > 0}
            <div class="slot-row">
              <span class="slot-lvl num">{i + 1}</span>
              <Pips
                total={max}
                used={c.slotsUsed.levels[i]}
                label={t('slot de nivel {n}', { n: i + 1 })}
                onchange={(u) => (store.c.slotsUsed.levels[i] = u)}
              />
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}

  {#if c.resources.length || fres.length}
    <div class="card">
      <h2>{t('Recursos')}</h2>
      <div class="resources">
        {#each fres as r (r.key)}
          <div class="res">
            <div class="res-name">
              <span>{r.name}{#if r.die}<span class="die num">{r.die}</span>{/if}</span>
              <span class="muted small">{rechargeLabel(r.recharge)}</span>
            </div>
            <Pips total={r.max} used={r.used} color="var(--good)" label={r.name} onchange={(u) => (store.c.featureUsed[r.key] = u)} />
          </div>
          {#if r.picks.length}
            <div class="picks">
              {#each r.picks as p (p)}
                {@const k = `${r.featureId}|${p}`}
                <button class="pickchip" class:open={openPick === k} aria-expanded={openPick === k} onclick={() => (openPick = openPick === k ? null : k)}>{p}</button>
              {/each}
            </div>
            {#each r.picks as p (p)}
              {#if openPick === `${r.featureId}|${p}`}<p class="pick-text small">{optionText.get(`${r.featureId}|${p}`) || t('Sin texto.')}</p>{/if}
            {/each}
          {/if}
        {/each}
        {#each c.resources as r, i (r.id)}
          {#if r.max > 0}
            <div class="res">
              <div class="res-name">
                {r.name}
                <span class="muted small"
                  >{rechargeLabel(r.recharge)}</span
                >
              </div>
              <Pips
                total={r.max}
                used={r.used}
                color="var(--good)"
                label={r.name}
                onchange={(u) => (store.c.resources[i].used = u)}
              />
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}

  <div class="card">
    <h2>Hit Dice</h2>
    <div class="hd">
      {#each pools as p (p.die)}
        <div class="hd-pool num">
          <b>{p.available}</b><span class="muted">/ {p.total}</span> <span>d{p.die}</span>
        </div>
      {/each}
    </div>
    <p class="muted small hint">{t('Se gastan desde Short Rest.')}</p>
  </div>
</section>

<ShortRestDialog bind:open={shortOpen} />

<style>
  .conc {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border-color: color-mix(in srgb, var(--pact) 60%, var(--line));
  }
  .rests {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .rests button {
    min-height: 52px;
    font-weight: 600;
  }

  .hp-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  .hp-num b {
    font-size: 3rem;
    line-height: 1;
    font-weight: 700;
  }
  .hp-num b.low {
    color: var(--bad);
  }
  .hp-num b.zero {
    color: var(--bad);
    opacity: 0.7;
  }
  .hp-num span {
    font-size: 1.3rem;
  }
  .temp {
    color: var(--temp);
    font-weight: 650;
    border: 1px solid color-mix(in srgb, var(--temp) 50%, transparent);
    border-radius: 999px;
    padding: 4px 10px;
  }
  .bar {
    height: 6px;
    background: var(--surface-2);
    border-radius: 3px;
    margin: 10px 0 12px;
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--good);
    transition: width 0.2s;
  }
  .hp-actions {
    display: grid;
    grid-template-columns: 1fr repeat(3, auto);
    gap: 6px;
  }
  .hp-actions input {
    font-size: 1.2rem;
    text-align: center;
    min-width: 0;
  }
  .hp-actions button {
    padding: 0 12px;
  }
  .heal {
    color: var(--good);
  }
  .tempbtn {
    color: var(--temp);
  }
  .hint {
    margin: 8px 0 0;
  }

  .quick {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .stat {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 10px 6px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .stat span {
    font-size: 0.72rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .stat b {
    font-size: 1.6rem;
  }

  .toggles {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .toggle {
    border-radius: 999px;
    font-weight: 600;
    color: var(--muted);
  }
  .toggle.on {
    border-color: var(--good);
    color: var(--good);
    background: color-mix(in srgb, var(--good) 12%, var(--surface-2));
  }
  .attacks {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .attacks li {
    padding: 6px 0;
    border-bottom: 1px solid var(--line);
  }
  .attacks li:last-child {
    border-bottom: none;
  }
  .atk-main {
    display: grid;
    grid-template-columns: 1fr auto minmax(86px, auto);
    gap: 12px;
    align-items: center;
  }
  .atk-name {
    font-weight: 600;
  }
  .dmg b {
    font-size: 1.05rem;
    color: var(--text);
  }
  .attacks li.spell .atk-name::before {
    content: '✧ ';
    color: var(--pact);
  }
  .atk-sub {
    margin-top: 2px;
  }
  .casting {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .cast-line {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 14px;
    align-items: center;
  }
  .pair {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .pair small {
    font-size: 0.68rem;
    color: var(--muted);
    text-transform: uppercase;
  }
  .pair b {
    font-size: 1.35rem;
    color: var(--accent);
  }

  .lvl {
    color: var(--pact);
    text-transform: none;
    letter-spacing: 0;
    margin-left: 6px;
  }

  .slots {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .slot-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .slot-lvl {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: var(--surface-2);
    font-weight: 700;
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  .resources {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .res {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 4px 12px;
  }
  .res-name {
    display: flex;
    flex-direction: column;
  }
  .resist {
    margin: 0;
    padding: 0 4px;
  }
  .die {
    margin-left: 8px;
    font-size: 0.8rem;
    padding: 1px 7px;
    border-radius: 999px;
    border: 1px solid var(--line);
    color: var(--muted);
  }
  .picks {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: -2px;
  }
  .pickchip {
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    font-size: 0.85rem;
  }
  .pickchip.open {
    border-color: var(--accent);
    color: var(--accent);
  }
  .pick-text {
    margin: 0;
    line-height: 1.45;
    color: var(--muted);
  }

  .hd {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  .hd-pool b {
    font-size: 1.6rem;
  }
  .hd-pool span:last-child {
    margin-left: 4px;
    font-weight: 600;
  }

  @container (max-width: 340px) {
    .cast-line {
      grid-template-columns: 1fr auto;
    }
    .cast-line > :first-child {
      grid-column: 1 / -1;
    }
  }
</style>
