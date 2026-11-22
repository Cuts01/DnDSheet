<script lang="ts" generics="T extends { id: string; name: string; source?: string }">
  import type { Ref } from '../../lib/rules/features';
  import { t } from '../../lib/i18n.svelte';

  /* Select de entradas del compendium agrupadas por pack, con filtro de texto si la lista es larga. */
  let {
    options,
    value,
    label,
    placeholder,
    describe,
    note,
    onpick
  }: {
    options: Ref<T>[];
    value: string | null;
    label: string;
    placeholder?: string;
    /** Si se da, muestra la descripción del elegido y una lista para explorar con descripciones. */
    describe?: (item: T) => string;
    /** Línea extra en la lista (ej. el prerequisite). */
    note?: (item: T) => string;
    onpick: (r: Ref<T> | null) => void;
  } = $props();

  let q = $state('');
  let browse = $state(false);
  const current = $derived(options.find((o) => o.value === value) ?? null);
  function choose(o: Ref<T>) {
    onpick(o);
    browse = false;
    q = '';
  }
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
      <option value="">{placeholder ?? t('Elegir...')}</option>
      {#each groups as [pack, list] (pack)}
        <optgroup label={pack}>
          {#each list as o (o.value)}
            <option value={o.value}>{o.item.name}{o.item.source ? ` (${o.item.source})` : ''}</option>
          {/each}
        </optgroup>
      {/each}
    </select>
  </label>
  {#if (options.length > 25 && (!value || q)) || browse}
    <input class="filter" bind:value={q} placeholder={t('Filtrar lista...')} aria-label={`${t('Filtrar')} ${label}`} />
  {/if}
  {#if describe}
    {#if current && !browse}
      {@const d = describe(current.item)}
      {#if d}<p class="desc">{d}</p>{/if}
    {/if}
    <button class="ghost browse" aria-expanded={browse} onclick={() => (browse = !browse)}>
      {browse ? t('Cerrar lista') : t('Ver todos con descripción')}
    </button>
    {#if browse}
      <ul class="list">
        {#each groups as [pack, list] (pack)}
          {#if groups.length > 1}<li class="grp">{pack}</li>{/if}
          {#each list as o (o.value)}
            {@const n = [note?.(o.item) ?? '', o.item.source ?? ''].filter(Boolean).join(' · ')}
            <li>
              <button class="opt" class:on={o.value === value} onclick={() => choose(o)}>
                <span class="nm">{o.item.name}{o.value === value ? ' ✓' : ''}</span>
                {#if n}<span class="note">{n}</span>{/if}
                <span class="d">{describe(o.item)}</span>
              </button>
            </li>
          {/each}
        {:else}
          <li class="muted small empty">{t('Ninguno coincide.')}</li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  .rs {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .desc {
    margin: 0;
    padding: 8px 10px;
    background: var(--surface-2);
    border-radius: 10px;
    font-size: 0.9rem;
    line-height: 1.45;
    white-space: pre-line;
  }
  .browse {
    align-self: flex-start;
    min-height: 36px;
    padding: 0 6px;
    color: var(--accent);
    font-size: 0.85rem;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 420px;
    overflow-y: auto;
    border: 1px solid var(--line);
    border-radius: 10px;
  }
  .list li + li {
    border-top: 1px solid var(--line);
  }
  .grp {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 6px 12px;
    background: var(--surface-2);
    font-size: 0.75rem;
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .empty {
    padding: 10px 12px;
  }
  .opt {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    width: 100%;
    text-align: left;
    border: none;
    border-radius: 0;
    background: transparent;
    padding: 10px 12px;
    min-height: 0;
  }
  .opt.on {
    background: var(--surface-2);
  }
  .opt.on .nm {
    color: var(--accent);
  }
  .nm {
    font-weight: 650;
  }
  .note {
    font-size: 0.78rem;
    color: var(--muted);
  }
  .d {
    font-size: 0.86rem;
    line-height: 1.4;
    font-weight: 400;
    color: var(--text);
    opacity: 0.85;
  }
  .filter {
    min-height: 40px;
    font-size: 0.9rem;
  }
</style>
