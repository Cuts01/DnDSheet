<script lang="ts">
  import { t, i18n } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';

  /* Lista de personajes guardados en el dispositivo: abrir, crear, duplicar y borrar. */
  let { onpicked }: { onpicked?: () => void } = $props();

  const date = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString(i18n.lang === 'en' ? 'en-US' : 'es-PE', { day: 'numeric', month: 'short' }) : '';

  async function open(id: string) {
    await store.select(id);
    onpicked?.();
  }
  async function remove(id: string, name: string) {
    if (!confirm(t('¿Borrar a {name} de este dispositivo? Esto no se puede deshacer si no tienes un respaldo.', { name: name || t('Sin nombre') }))) return;
    await store.remove(id);
  }
  async function duplicate() {
    await store.duplicate();
    onpicked?.();
  }
  async function create() {
    await store.startNew();
    onpicked?.();
  }
</script>

<ul class="chars">
  {#each store.list as ch (ch.id)}
    {@const current = ch.id === store.currentId}
    <li class:current>
      <button class="pick ghost" disabled={!ch.valid} aria-current={current ? 'true' : undefined} onclick={() => open(ch.id)}>
        <span class="nm">{ch.name || t('Sin nombre')}{#if current}<span class="tag">{t('abierto')}</span>{/if}</span>
        <small class="muted">
          {#if ch.valid}{ch.summary} · {t('nivel')} {ch.level} · {ch.ruleset}{ch.updatedAt ? ` · ${date(ch.updatedAt)}` : ''}
          {:else}{t('No se puede abrir: el registro no es válido.')}{/if}
        </small>
      </button>
      <button class="ghost danger del" aria-label={`${t('Borrar')} ${ch.name}`} onclick={() => remove(ch.id, ch.name)}>✕</button>
    </li>
  {/each}
</ul>
<div class="row wrap">
  <button class="primary" onclick={create}>{t('Nuevo personaje')}</button>
  {#if store.hasCharacter}<button onclick={duplicate}>{t('Duplicar {name}', { name: store.c.name || t('Sin nombre') })}</button>{/if}
</div>

<style>
  .chars {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  li {
    display: flex;
    align-items: stretch;
    gap: 6px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--bg);
  }
  li.current {
    border-color: var(--accent);
  }
  .pick {
    flex: 1;
    min-width: 0;
    border: 0;
    text-align: left;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 2px;
    padding: 8px 12px;
  }
  .nm {
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .tag {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 999px;
    padding: 0 7px;
  }
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
  .del {
    border: 0;
    min-width: var(--tap);
    padding: 0;
  }
  .row {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }
  .wrap {
    flex-wrap: wrap;
  }
</style>
