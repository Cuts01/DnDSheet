<script lang="ts">
  import { t } from '../lib/i18n.svelte';

  /* Candado para evitar cambios sin querer. Ícono de línea fina; dorado si está cerrado. */
  let { locked = $bindable(), what }: { locked?: boolean; what: string } = $props();
  const label = $derived(locked ? t('Desbloquear {what}', { what }) : t('Bloquear {what}', { what }));
</script>

<button class="lock" class:locked={!!locked} aria-pressed={!!locked} aria-label={label} title={label} onclick={() => (locked = !locked)}>
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    {#if locked}
      <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
    {:else}
      <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 6.6-1.6" />
    {/if}
    <path d="M12 14.5v2" />
  </svg>
</button>

<style>
  .lock {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    min-height: 40px;
    padding: 0;
    border-radius: 999px;
    border: none;
    background: transparent;
    color: var(--muted);
    transition:
      color 0.15s,
      background 0.15s;
  }
  .lock:hover {
    background: var(--surface-2);
  }
  .lock.locked {
    color: var(--accent);
    background: var(--surface-2);
  }
</style>
