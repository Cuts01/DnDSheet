<script lang="ts">
  /*
   * Contador de usos. Punto lleno = disponible.
   * Tocar un punto lleno gasta uno; tocar uno vacio lo recupera.
   * Con mas de 8 usos se muestra un contador con botones.
   */
  let {
    total,
    used,
    color = 'var(--accent)',
    label,
    onchange
  }: { total: number; used: number; color?: string; label: string; onchange: (used: number) => void } = $props();

  const available = $derived(Math.max(0, total - used));
  const set = (u: number) => onchange(Math.min(total, Math.max(0, u)));
</script>

{#if total <= 8}
  <div class="pips" role="group" aria-label={label} style:--c={color}>
    {#each Array(total) as _, i (i)}
      {@const full = i < available}
      <button
        class="pip"
        class:full
        aria-label={full ? `Gastar ${label}` : `Recuperar ${label}`}
        onclick={() => set(full ? used + 1 : used - 1)}
      ><span></span></button>
    {/each}
  </div>
{:else}
  <div class="counter" style:--c={color}>
    <button aria-label={`Gastar ${label}`} onclick={() => set(used + 1)} disabled={available === 0}>-</button>
    <span class="num"><b>{available}</b> / {total}</span>
    <button aria-label={`Recuperar ${label}`} onclick={() => set(used - 1)} disabled={used === 0}>+</button>
  </div>
{/if}

<style>
  .pips {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }
  .pip {
    width: var(--tap);
    min-width: var(--tap);
    padding: 0;
    border: none;
    background: transparent;
    display: grid;
    place-items: center;
  }
  .pip span {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid var(--c);
    transition: background 0.12s;
  }
  .pip.full span {
    background: var(--c);
  }
  .counter {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .counter button {
    width: var(--tap);
    padding: 0;
    font-size: 1.3rem;
  }
  .counter b {
    color: var(--c);
    font-size: 1.2rem;
  }
</style>
