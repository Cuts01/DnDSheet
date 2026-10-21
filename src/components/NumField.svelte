<script lang="ts">
  /* Input numerico que nunca deja el modelo en null o NaN mientras escribes. */
  let {
    value = $bindable(0),
    min = -99,
    max = 999,
    label = '',
    onchange
  }: { value?: number; min?: number; max?: number; label?: string; onchange?: (n: number) => void } = $props();

  function input(e: Event & { currentTarget: HTMLInputElement }) {
    const n = parseInt(e.currentTarget.value, 10);
    if (Number.isNaN(n)) return;
    const v = Math.min(max, Math.max(min, n));
    value = v;
    onchange?.(v);
  }
  function blur(e: FocusEvent & { currentTarget: HTMLInputElement }) {
    e.currentTarget.value = String(value);
  }
</script>

{#if label}
  <label class="field">
    <span>{label}</span>
    <input class="num" type="number" inputmode="numeric" {min} {max} {value} oninput={input} onblur={blur} />
  </label>
{:else}
  <input class="num" type="number" inputmode="numeric" {min} {max} {value} oninput={input} onblur={blur} />
{/if}
