<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import { compendium } from '../lib/compendium.svelte';
  import type { ClassEntry } from '../lib/model/character';
  import { findClass, subclassOptions } from '../lib/rules/features';

  /* Subclass: lista desde los packs importados, o texto libre (homebrew rapido o sin packs). */
  let { entry = $bindable(), ruleset }: { entry: ClassEntry; ruleset: string } = $props();

  const options = $derived(subclassOptions(compendium.packs, entry.name, ruleset));
  const cls = $derived(findClass(compendium.packs, entry.name, ruleset)?.cls ?? null);
  const label = $derived(cls?.subclassLabel && cls.subclassLabel !== 'Subclass' ? `Subclass (${cls.subclassLabel})` : 'Subclass');
  let freeMode = $state(false);
  const selected = $derived(
    entry.subclassId && options.some((o) => o.value === entry.subclassId)
      ? entry.subclassId
      : entry.subclass || freeMode
        ? '__free'
        : ''
  );
  const early = $derived(cls && entry.level < cls.subclassLevel);

  function pick(v: string) {
    if (v === '' || v === '__free') {
      entry.subclassId = null;
      entry.subclass = '';
      freeMode = v === '__free';
      return;
    }
    const o = options.find((x) => x.value === v);
    if (!o) return;
    entry.subclassId = v;
    entry.subclass = o.sub.name;
    // Subclasses como Eldritch Knight o Arcane Trickster convierten la clase en caster.
    if (o.sub.caster) {
      entry.caster = o.sub.caster;
      entry.spellAbility = o.sub.spellAbility ?? entry.spellAbility;
    }
  }
</script>

<div class="sub">
  {#if options.length}
    <label class="field">
      <span>{label}</span>
      <select value={selected} onchange={(e) => pick(e.currentTarget.value)}>
        <option value="">{t('Sin elegir')}</option>
        <option value="__free">{t('Otra (escribir)')}</option>
        {#each options as o (o.value)}
          <option value={o.value}>
            {o.sub.name} · {o.pack.pack.ruleset}{o.pack.pack.homebrew ? ' · homebrew' : ''}
          </option>
        {/each}
      </select>
    </label>
    {#if selected === '__free'}
      <input bind:value={entry.subclass} placeholder={t('Nombre (sin features automáticos)')} aria-label={t('Subclass en texto libre')} />
    {/if}
  {:else}
    <label class="field">
      <span>{label}</span>
      <input bind:value={entry.subclass} placeholder={t('Importa un pack para elegir de una lista')} />
    </label>
  {/if}
  {#if early}
    <p class="muted small">{t('{name} elige subclass en nivel {n}.', { name: entry.name, n: cls?.subclassLevel ?? '' })}</p>
  {/if}
</div>

<style>
  .sub {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  p {
    margin: 0;
  }
</style>
