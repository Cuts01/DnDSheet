<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from './lib/store.svelte';
  import { classSummary, totalLevel } from './lib/rules/derive';
  import CombatView from './components/CombatView.svelte';
  import SheetView from './components/SheetView.svelte';
  import EditView from './components/EditView.svelte';
  import DataView from './components/DataView.svelte';
  import CreateView from './components/CreateView.svelte';
  import FeaturesView from './components/FeaturesView.svelte';
  import InventoryView from './components/InventoryView.svelte';
  import SpellsView from './components/SpellsView.svelte';
  import { spellcasting } from './lib/rules/derive';
  import { featSpells } from './lib/rules/spells';
  import { autoSyncLocal } from './lib/packImport';
  import { compendium } from './lib/compendium.svelte';

  type View = 'combat' | 'sheet' | 'spells' | 'features' | 'gear' | 'edit' | 'data';

  let view = $state<View>('combat');
  // Desde 768 px de ancho de ventana (Tab S9 vertical u horizontal) Combate y Hoja se ven juntos.
  let wide = $state(false);

  // La pestaña Spells aparece si alguna clase lanza spells o ya hay spells en la lista.
  const showSpells = $derived(
    spellcasting(store.c).length > 0 || store.c.spells.length > 0 || featSpells(store.c, compendium.packs).slots.length > 0
  );
  const spellsTab = { id: 'spells' as View, label: 'Spells', icon: '✧' };
  const tabs = $derived(
    (wide
      ? [
          { id: 'combat' as View, label: 'Juego', icon: '⚔' },
          spellsTab,
          { id: 'features' as View, label: 'Rasgos', icon: '✦' },
          { id: 'gear' as View, label: 'Equipo', icon: '⚒' },
          { id: 'edit' as View, label: 'Editar', icon: '✎' },
          { id: 'data' as View, label: 'Datos', icon: '⇅' }
        ]
      : [
          { id: 'combat' as View, label: 'Combate', icon: '⚔' },
          { id: 'sheet' as View, label: 'Hoja', icon: '☰' },
          spellsTab,
          { id: 'features' as View, label: 'Rasgos', icon: '✦' },
          { id: 'gear' as View, label: 'Equipo', icon: '⚒' },
          { id: 'edit' as View, label: 'Editar', icon: '✎' },
          { id: 'data' as View, label: 'Datos', icon: '⇅' }
        ]
    ).filter((t) => t.id !== 'spells' || showSpells)
  );
  const isActive = (id: View) => view === id || (wide && id === 'combat' && view === 'sheet');

  onMount(() => {
    const mq = matchMedia('(min-width: 768px)');
    wide = mq.matches;
    const onMq = (e: MediaQueryListEvent) => (wide = e.matches);
    mq.addEventListener('change', onMq);

    // Guarda de inmediato si la app pasa a segundo plano (cambio de app, pantalla apagada).
    const onHide = () => document.visibilityState === 'hidden' && store.flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);

    compendium.load().then(() => autoSyncLocal());
    store.load();
    return () => {
      mq.removeEventListener('change', onMq);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  });

  // Autoguardado: cualquier cambio en el personaje se encola para IndexedDB.
  $effect(() => {
    const snap = store.snapshot();
    if (store.loaded && store.hasCharacter) store.queueSave(snap);
  });

  function go(id: View) {
    view = id;
    window.scrollTo({ top: 0 });
  }
</script>

{#if store.loaded && !store.hasCharacter}
  <CreateView oncreated={() => go('edit')} />
{:else}
<div class="app">
  <header class="top">
    <div class="who">
      <h1>{store.c.name || 'Sin nombre'}</h1>
      <p class="muted">{classSummary(store.c)} · nivel {totalLevel(store.c)} · {store.c.ruleset}</p>
    </div>
  </header>

  {#if store.loadError}
    <p class="banner">{store.loadError}</p>
  {/if}

  <main>
    {#if !store.loaded}
      <p class="muted">Cargando...</p>
    {:else if view === 'combat' || view === 'sheet'}
      {#if wide}
        <div class="play">
          <div class="col-combat"><CombatView /></div>
          <div class="col-sheet"><SheetView /></div>
        </div>
      {:else if view === 'combat'}
        <CombatView />
      {:else}
        <SheetView />
      {/if}
    {:else if view === 'spells'}
      <SpellsView />
    {:else if view === 'features'}
      <FeaturesView />
    {:else if view === 'gear'}
      <InventoryView />
    {:else if view === 'edit'}
      <EditView />
    {:else}
      <DataView />
    {/if}
  </main>

  <nav class="tabbar" aria-label="Secciones">
    {#each tabs as t (t.id)}
      <button class:active={isActive(t.id)} aria-current={isActive(t.id) ? 'page' : undefined} onclick={() => go(t.id)}>
        <span class="icon" aria-hidden="true">{t.icon}</span>
        <span>{t.label}</span>
      </button>
    {/each}
  </nav>
</div>
{/if}

<style>
  .app {
    min-height: 100dvh;
    padding: env(safe-area-inset-top) 0 0;
  }
  .top {
    padding: 14px 16px 6px;
    max-width: 1400px;
    margin: 0 auto;
  }
  h1 {
    margin: 0;
    font-size: 1.35rem;
    line-height: 1.2;
  }
  .who p {
    margin: 2px 0 0;
    font-size: 0.85rem;
  }
  .banner {
    margin: 8px 16px;
    padding: 10px 12px;
    border: 1px solid var(--bad);
    border-radius: 10px;
    color: var(--bad);
  }
  main {
    padding: 8px 12px calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 20px);
    max-width: 1400px;
    margin: 0 auto;
    /* Los layouts internos de cada vista responden al ancho de su contenedor, no de la pantalla. */
    container-type: inline-size;
  }
  .col-combat,
  .col-sheet {
    container-type: inline-size;
  }

  .play {
    display: grid;
    grid-template-columns: minmax(330px, 1fr) 1.15fr;
    gap: var(--gap);
    align-items: start;
  }
  @media (min-width: 1180px) {
    .play {
      grid-template-columns: minmax(360px, 1fr) 1.6fr;
    }
  }

  .tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: center;
    gap: 4px;
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(10px);
    border-top: 1px solid var(--line);
    z-index: 10;
  }
  .tabbar button {
    flex: 1;
    min-width: 0;
    max-width: 180px;
    padding: 0 2px;
    min-height: 52px;
    border: none;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-size: 0.72rem;
    color: var(--muted);
    border-radius: 12px;
  }
  .tabbar button.active {
    color: var(--accent);
    background: var(--surface);
  }
  .icon {
    font-size: 1.2rem;
    line-height: 1;
  }
</style>
