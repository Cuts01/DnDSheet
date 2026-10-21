<script lang="ts">
  import { t } from '../../lib/i18n.svelte';
  import { compendium } from '../../lib/compendium.svelte';
  import { uid, type Character } from '../../lib/model/character';
  import type { PackInvocation } from '../../lib/model/pack';
  import { classLevel, invocationsKnown } from '../../lib/rules/derive';
  import { findInvocation, invocationList, type Ref } from '../../lib/rules/features';
  import RefSelect from './RefSelect.svelte';

  let { c = $bindable() }: { c: Character } = $props();

  const level = $derived(classLevel(c, 'warlock'));
  const max = $derived(invocationsKnown(c));
  const all = $derived(invocationList(compendium.packs, c.ruleset));
  // Filtra por nivel de Warlock y Pact Boon (2014). En 2024 los Pact Boons son invocations.
  const eligible = $derived(
    all.filter((o) => o.item.minLevel <= level && (!o.item.pact || c.ruleset === '2024' || o.item.pact === c.pactBoon))
  );

  function pick(i: number, r: Ref<PackInvocation> | null) {
    c.invocations[i].ref = r?.value ?? null;
    c.invocations[i].name = r?.item.name ?? '';
  }
  const info = (ref: string | null) => findInvocation(compendium.packs, ref)?.item ?? null;
</script>

{#if level > 0}
  <div class="card stack">
    <h2>Eldritch Invocations <span class="muted">· {c.invocations.length} / {max}</span></h2>

    {#if c.ruleset === '2014' && level >= 3}
      <label class="field">
        <span>Pact Boon</span>
        <select bind:value={c.pactBoon}>
          <option value="none">{t('Sin elegir')}</option>
          <option value="blade">Pact of the Blade</option>
          <option value="chain">Pact of the Chain</option>
          <option value="tome">Pact of the Tome</option>
          <option value="talisman">Pact of the Talisman</option>
        </select>
      </label>
    {/if}

    {#each c.invocations as inv, i (inv.id)}
      {@const it = info(inv.ref)}
      <div class="inv">
        <div class="grow">
          {#if all.length}
            <RefSelect options={eligible} value={inv.ref} label={`Invocation ${i + 1}`} onpick={(r) => pick(i, r)} />
          {:else}
            <label class="field"><span>Invocation {i + 1}</span><input bind:value={c.invocations[i].name} /></label>
          {/if}
          {#if it?.prerequisite}<p class="small muted">{t('Requisito')}: {it.prerequisite}</p>{/if}
        </div>
        <button class="ghost danger del" aria-label={t('Quitar invocation')} onclick={() => c.invocations.splice(i, 1)}>✕</button>
      </div>
    {/each}

    {#if c.invocations.length < max}
      <button onclick={() => c.invocations.push({ id: uid(), ref: null, name: '' })}>{t('Agregar invocation')}</button>
    {:else if c.invocations.length > max}
      <p class="small err">{t('Tienes más invocations de las que permite tu nivel de Warlock ({n}).', { n: max })}</p>
    {/if}
    <p class="muted small">{c.ruleset === '2014' ? t('La lista solo muestra las que cumplen el nivel y tu Pact Boon. Los demás requisitos se indican en cada una.') : t('La lista solo muestra las que cumplen el nivel. Los demás requisitos se indican en cada una.')}</p>
  </div>
{/if}

<style>
  .card h2 {
    margin-bottom: 0;
  }
  p {
    margin: 0;
  }
  .err {
    color: var(--bad);
  }
  .inv {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .grow {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .del {
    width: var(--tap);
    padding: 0;
    margin-top: 22px;
  }
</style>
