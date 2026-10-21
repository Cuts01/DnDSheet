<script lang="ts" generics="T extends { id: string; name: string; source?: string }">
  import type { Ref } from '../../lib/rules/features';

  /* Select de entradas del compendium agrupadas por pack, con filtro de texto si la lista es larga. */
  let {
    options,
    value,
    label,
    placeholder = 'Elegir...',
    onpick
  }: { options: Ref<T>[]; value: string | null; label: string; placeholder?: string; onpick: (r: Ref<T> | null) => void } =
    $props();

  let q = $state('');
  const groups = $derived.by(() => {
    const term = q.trim().toLowerCase();
    const map = new Map<string, Ref<T>[]>();
    for (const o of options) {
      if (term && !o.item.name.toLowerCase().includes(term) && o.value !== value) continue;
      const key = `${o.pack.pack.name}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    for (const list of map.values()) list.sort((a, b) => a.item.name.localeCompare(b.item.name));
    return [...map.entries()];
  });
</script>

<div class="rs">
  <label class="field">
    <span>{label}</span>
    <select
      value={value ?? ''}
      onchange={(e) => onpick(options.find((o) => o.value === e.currentTarget.value) ?? null)}
    >
      <option value="">{placeholder}</option>
      {#each groups as [pack, list] (pack)}
        <optgroup label={pack}>
          {#each list as o (o.value)}
            <option value={o.value}>{o.item.name}{o.item.source ? ` (${o.item.source})` : ''}</option>
          {/each}
        </optgroup>
      {/each}
    </select>
  </label>
  {#if options.length > 25 && (!value || q)}
    <input class="filter" bind:value={q} placeholder="Filtrar lista..." aria-label={`Filtrar ${label}`} />
  {/if}
</div>

<style>
  .rs {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .filter {
    min-height: 40px;
    font-size: 0.9rem;
  }
</style>
