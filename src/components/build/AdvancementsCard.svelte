<script lang="ts">
  import { t } from '../../lib/i18n.svelte';
  import { compendium } from '../../lib/compendium.svelte';
  import { ABILITIES, uid, type Ability, type Advancement, type Character } from '../../lib/model/character';
  import type { PackFeat } from '../../lib/model/pack';
  import { asiSlots } from '../../lib/rules/derive';
  import { featList, findFeat, packAsiLevels, type Ref } from '../../lib/rules/features';
  import { ABILITY_LABEL } from '../../lib/rules/tables';
  import RefSelect from './RefSelect.svelte';

  let { c = $bindable() }: { c: Character } = $props();

  const slots = $derived(asiSlots(c, packAsiLevels(compendium.packs, c.ruleset)));
  const feats = $derived(featList(compendium.packs, c.ruleset));
  const is2024 = $derived(c.ruleset === '2024');
  const forSlot = (epic: boolean) =>
    feats.filter((f) => {
      const cat = f.item.category.toLowerCase();
      if (!is2024) return true;
      return epic ? true : !cat.includes('epic');
    });
  const forOrigin = $derived(is2024 ? feats.filter((f) => f.item.category.toLowerCase().includes('origin')) : feats);

  const emptyAdv = (): Advancement => ({ kind: 'asi', asi: [{ ability: 'str', amount: 2 }], featRef: null, featName: '', featAbility: null });
  const adv = (key: string) => c.advancements[key];

  function ensure(key: string, epic: boolean) {
    if (!c.advancements[key]) c.advancements[key] = epic ? { ...emptyAdv(), kind: 'feat', asi: [] } : emptyAdv();
  }
  function setKind(key: string, kind: 'asi' | 'feat') {
    ensure(key, false);
    c.advancements[key].kind = kind;
    if (kind === 'asi' && !c.advancements[key].asi.length) c.advancements[key].asi = [{ ability: 'str', amount: 2 }];
  }
  function setAsiMode(key: string, mode: 'one' | 'two') {
    const a = c.advancements[key];
    const first = a.asi[0]?.ability ?? 'str';
    a.asi = mode === 'one' ? [{ ability: first, amount: 2 }] : [{ ability: first, amount: 1 }, { ability: ABILITIES.find((x) => x !== first)!, amount: 1 }];
  }
  function pickFeat(target: { featRef?: string | null; featName?: string; featAbility?: Ability | null }, r: Ref<PackFeat> | null) {
    target.featRef = r?.value ?? null;
    target.featName = r?.item.name ?? '';
    target.featAbility = r?.item.asi?.from[0] ?? null;
  }
  const featOf = (ref: string | null) => findFeat(compendium.packs, ref)?.item ?? null;

  function addOther() {
    c.feats.push({ id: uid(), ref: null, name: '', source: 'other', ability: null });
  }
  function pickOther(i: number, r: Ref<PackFeat> | null) {
    const f = c.feats[i];
    f.ref = r?.value ?? null;
    f.name = r?.item.name ?? '';
    f.ability = r?.item.asi?.from[0] ?? null;
  }
  const srcLabel = { species: 'De tu raza', background: 'Del background', other: 'Feat adicional' } as const;
</script>

<div class="card stack">
  <h2>{t('ASI y feats')}</h2>
  {#if !slots.length && !c.feats.length}
    <p class="muted small">{t('Todavía no tienes niveles de Ability Score Improvement.')}</p>
  {/if}

  {#each slots as s (s.key)}
    {@const a = adv(s.key)}
    <div class="slot">
      <div class="slot-head">
        <b>{s.className} {s.level}</b>
        <span class="muted small">{s.epic ? 'Epic Boon' : 'Ability Score Improvement'}</span>
      </div>
      {#if !s.epic}
        <div class="seg">
          <button class:on={!a || a.kind === 'asi'} onclick={() => setKind(s.key, 'asi')}>{t('Subir abilities')}</button>
          <button class:on={a?.kind === 'feat'} onclick={() => setKind(s.key, 'feat')}>Feat</button>
        </div>
      {/if}
      {#if !s.epic && (!a || a.kind === 'asi')}
        {#if !a}
          <button onclick={() => ensure(s.key, false)}>{t('Elegir')}</button>
        {:else}
          <div class="row wrap">
            <select value={a.asi.length === 1 ? 'one' : 'two'} onchange={(e) => setAsiMode(s.key, e.currentTarget.value as 'one' | 'two')} aria-label={t('Modo')}>
              <option value="one">{t('+2 a una')}</option>
              <option value="two">{t('+1 a dos')}</option>
            </select>
            {#each a.asi as b, i (i)}
              <div class="bonus">
                <b class="num">+{b.amount}</b>
                <select bind:value={c.advancements[s.key].asi[i].ability} aria-label="Ability">
                  {#each ABILITIES as x (x)}<option value={x}>{ABILITY_LABEL[x]}</option>{/each}
                </select>
              </div>
            {/each}
          </div>
        {/if}
      {:else if !a}
        <button onclick={() => ensure(s.key, true)}>{t('Elegir Epic Boon')}</button>
      {:else}
        {@const f = featOf(a.featRef)}
        {#if feats.length}
          <RefSelect options={forSlot(s.epic)} value={a.featRef} label="Feat" onpick={(r) => pickFeat(c.advancements[s.key], r)} />
        {:else}
          <label class="field"><span>Feat</span><input bind:value={c.advancements[s.key].featName} placeholder={t('Importa un pack con feats')} /></label>
        {/if}
        {#if f}
          {#if f.prerequisite}<p class="small muted">{t('Requisito')}: {f.prerequisite}</p>{/if}
          {#if f.asi}
            <div class="bonus self">
              <b class="num">+1</b>
              <select bind:value={c.advancements[s.key].featAbility} aria-label={t('Ability del feat')}>
                {#each f.asi.from as x (x)}<option value={x}>{ABILITY_LABEL[x]}</option>{/each}
              </select>
            </div>
          {/if}
        {/if}
      {/if}
    </div>
  {/each}

  {#each c.feats as f, i (f.id)}
    {@const pf = featOf(f.ref)}
    <div class="slot">
      <div class="slot-head">
        <b>{t(srcLabel[f.source])}</b>
        {#if f.source === 'other'}
          <button class="ghost danger del" aria-label={t('Quitar feat')} onclick={() => c.feats.splice(i, 1)}>✕</button>
        {/if}
      </div>
      {#if feats.length}
        <RefSelect options={f.source === 'other' ? feats : forOrigin} value={f.ref} label="Feat" onpick={(r) => pickOther(i, r)} />
      {:else}
        <label class="field"><span>Feat</span><input bind:value={c.feats[i].name} /></label>
      {/if}
      {#if pf?.asi}
        <div class="bonus self">
          <b class="num">+1</b>
          <select bind:value={c.feats[i].ability} aria-label={t('Ability del feat')}>
            {#each pf.asi.from as x (x)}<option value={x}>{ABILITY_LABEL[x]}</option>{/each}
          </select>
        </div>
      {/if}
    </div>
  {/each}

  <button onclick={addOther}>{t('Agregar feat adicional')}</button>
  <p class="muted small">{t('Para feats que no vienen de un ASI: Fighting Style 2024, bonus de un DM, etc.')}</p>
</div>

<style>
  .card h2 {
    margin-bottom: 0;
  }
  p {
    margin: 0;
  }
  .slot {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: 12px;
  }
  .slot-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .wrap {
    flex-wrap: wrap;
  }
  .row select {
    width: auto;
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
    min-height: 40px;
  }
  .seg button.on {
    background: var(--surface-2);
    color: var(--accent);
    font-weight: 650;
  }
  .bonus {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--surface-2);
    border-radius: 10px;
    padding: 2px 4px 2px 10px;
  }
  .bonus.self {
    align-self: flex-start;
  }
  .bonus b {
    color: var(--accent);
  }
  .bonus select {
    width: auto;
    min-height: 40px;
  }
  .del {
    width: 40px;
    min-height: 36px;
    padding: 0;
  }
</style>
