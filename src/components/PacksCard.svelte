<script lang="ts">
  import { compendium } from '../lib/compendium.svelte';
  import { MIN_WIKI_BUILT, canLoadLocal, importFiles, importLocalWiki, isStale, type ImportResult } from '../lib/packImport';
  const when = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  let input: HTMLInputElement;
  let errors = $state<string[]>([]);
  let message = $state('');

  async function onFile(e: Event & { currentTarget: HTMLInputElement }) {
    const files = [...(e.currentTarget.files ?? [])];
    e.currentTarget.value = '';
    show(await importFiles(files));
  }

  function show(r: ImportResult) {
    errors = r.errors;
    message = r.done.length ? `Importado: ${r.done.join(', ')}.` : '';
  }

  let loading = $state(false);
  async function loadLocal() {
    loading = true;
    show(await importLocalWiki());
    loading = false;
  }

  async function exportPack(id: string) {
    const raw = await compendium.exportRaw(id);
    const url = URL.createObjectURL(new Blob([JSON.stringify(raw, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function remove(id: string, name: string) {
    if (confirm(`¿Borrar el pack "${name}"? Los personajes que usen sus subclasses quedan con el nombre en texto libre.`)) {
      await compendium.remove(id);
    }
  }

  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
</script>

<div class="card stack">
  <h2>Contenido</h2>
  <p class="small muted">
    Packs JSON con clases, subclasses, spells, razas, backgrounds, feats e items. Puedes importar varios a la vez (2014, 2024 y homebrew). Los de la wiki están en la carpeta content/dist del proyecto.
  </p>
  <div class="row wrap">
    <button class="primary" onclick={() => input.click()}>Importar packs</button>
    <input bind:this={input} type="file" accept="application/json,.json" multiple hidden onchange={onFile} />
    {#if canLoadLocal}
      <button onclick={loadLocal} disabled={loading}>{loading ? 'Cargando...' : 'Actualizar packs de la wiki'}</button>
    {/if}
    <a class="btn" href="./packs/ejemplo-homebrew.json" download>Plantilla de ejemplo</a>
    <a class="btn" href="./packs/pack.schema.json" download>JSON Schema</a>
  </div>

  {#if message}<p class="ok small">{message}</p>{/if}
  {#if errors.length}
    <div class="errors small">
      <b>No se pudo importar:</b>
      <ul>{#each errors.slice(0, 12) as e (e)}<li>{e}</li>{/each}</ul>
    </div>
  {/if}
  {#if compendium.broken.length}
    <p class="errors small">Packs guardados que ya no pasan la validación: {compendium.broken.join(', ')}. Vuelve a importarlos.</p>
  {/if}

  {#if compendium.packs.length}
    <ul class="packs">
      {#each compendium.packs as p (p.pack.id)}
        {@const features =
          p.classes.reduce((s, k) => s + k.features.length, 0) + p.subclasses.reduce((s, k) => s + k.features.length, 0)}
        <li>
          <div class="info">
            <b>{p.pack.name}</b>
            <span class="tags">
              <span class="tag">{p.pack.ruleset}</span>
              {#if p.pack.homebrew}<span class="tag hb">homebrew</span>{/if}
            </span>
            <span class="muted small">
              {count(p.classes.length, 'clase', 'clases')} · {count(p.subclasses.length, 'subclass', 'subclasses')} ·
              {count(features, 'feature', 'features')} · {count(p.spells.length, 'spell', 'spells')} ·
              {count(p.feats.length, 'feat', 'feats')} · {count(p.items.length, 'item', 'items')}
              {#if p.pack.built}· generado {when(p.pack.built)}{/if}
            </span>
            {#if isStale(p)}
              <span class="stale small"
                >Versión vieja{p.pack.built ? ` (${when(p.pack.built)})` : ''}: le faltan datos que esta app ya usa (spells de feats como Fey Touched y otros). Importa el {p.pack.id}.json generado el {when(MIN_WIKI_BUILT)} o después.</span
              >
            {/if}
          </div>
          <div class="row">
            <button onclick={() => exportPack(p.pack.id)}>Exportar</button>
            <button class="danger ghost" aria-label={`Borrar ${p.pack.name}`} onclick={() => remove(p.pack.id, p.pack.name)}>✕</button>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="small muted">Sin packs importados.</p>
  {/if}
</div>

<style>
  .stale {
    color: var(--accent);
  }
  .card h2 {
    margin-bottom: 0;
  }
  p {
    margin: 0;
  }
  .wrap {
    flex-wrap: wrap;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap);
    padding: 0 16px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface-2);
    color: var(--text);
    text-decoration: none;
  }
  .packs {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .packs li {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 10px 0;
    border-top: 1px solid var(--line);
  }
  .info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tags {
    display: flex;
    gap: 6px;
  }
  .tag {
    font-size: 0.72rem;
    padding: 1px 8px;
    border-radius: 999px;
    border: 1px solid var(--line);
    color: var(--muted);
  }
  .tag.hb {
    color: var(--pact);
    border-color: color-mix(in srgb, var(--pact) 50%, transparent);
  }
  .packs button.ghost {
    width: var(--tap);
    padding: 0;
  }
  .ok {
    color: var(--good);
  }
  .errors {
    color: var(--bad);
  }
  .errors ul {
    margin: 4px 0 0;
    padding-left: 18px;
  }
</style>
