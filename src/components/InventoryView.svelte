<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { compendium } from '../lib/compendium.svelte';
  import { ABILITIES, uid, type ItemEntry } from '../lib/model/character';
  import { armorClassInfo, score } from '../lib/rules/derive';
  import { itemEntryFrom, itemList, proficiencies, type Ref } from '../lib/rules/features';
  import type { PackItem } from '../lib/model/pack';
  import { ABILITY_LABEL } from '../lib/rules/tables';
  import NumField from './NumField.svelte';

  const c = $derived(store.c);
  const all = $derived(itemList(compendium.packs, c.ruleset));
  const profs = $derived(proficiencies(c, compendium.packs));
  const ac = $derived(armorClassInfo(c));

  type Tab = 'weapon' | 'armor' | 'gear' | 'tool';
  const tabs: [Tab, string][] = [
    ['weapon', 'Weapons'],
    ['armor', 'Armor'],
    ['gear', 'Gear'],
    ['tool', 'Tools']
  ];
  let tab = $state<Tab>('weapon');
  let q = $state('');
  let adding = $state(false);
  let open = $state<string | null>(null);

  // Si hay packs de los dos rulesets, se prefiere el del personaje para no duplicar items.
  const results = $derived.by(() => {
    const term = q.trim().toLowerCase();
    const seen = new Set<string>();
    const out: Ref<PackItem>[] = [];
    for (const r of all) {
      if (r.item.kind !== tab) continue;
      if (term && !r.item.name.toLowerCase().includes(term)) continue;
      const key = r.item.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out.sort((a, b) => a.item.name.localeCompare(b.item.name)).slice(0, term ? 60 : 200);
  });

  const weight = $derived(c.inventory.reduce((s, i) => s + i.weight * i.qty, 0));
  const capacity = $derived(score(c, 'str') * 15);
  const attuned = $derived(c.inventory.filter((i) => i.attuned).length);

  function add(r: Ref<PackItem>) {
    const existing = store.c.inventory.find((i) => i.ref === r.value && !i.weapon && !i.armor);
    if (existing) existing.qty += 1;
    else store.c.inventory.push(itemEntryFrom(r));
  }

  const isBody = (i: ItemEntry) => !!i.armor && i.armor.category !== 'shield';
  const isShield = (i: ItemEntry) => i.armor?.category === 'shield';
  const equippable = (i: ItemEntry) => !!i.weapon || !!i.armor;

  // Solo una armadura y un shield equipados a la vez.
  function toggleEquip(i: number) {
    const it = store.c.inventory[i];
    const next = !it.equipped;
    if (next && isBody(it)) store.c.inventory.forEach((x) => isBody(x) && (x.equipped = false));
    if (next && isShield(it)) store.c.inventory.forEach((x) => isShield(x) && (x.equipped = false));
    it.equipped = next;
    // Equipar armor o shield activa el AC automatico (los personajes de versiones anteriores estaban en manual).
    if (next && it.armor && store.c.ac.mode !== 'auto') {
      store.c.ac.mode = 'auto';
      store.c.ac.shield = false;
      acSwitched = true;
    }
  }
  let acSwitched = $state(false);

  function remove(i: number) {
    if (confirm(`¿Quitar ${store.c.inventory[i].name}?`)) store.c.inventory.splice(i, 1);
  }

  // Item propio (homebrew o magic item): por defecto gear, se puede volver weapon o armor.
  let custom = $state({ name: '', kind: 'gear' as ItemEntry['kind'] });
  function addCustom() {
    const name = custom.name.trim();
    if (!name) return;
    const entry: ItemEntry = {
      id: uid(), ref: null, name, kind: custom.kind, qty: 1, equipped: false, attuned: false, bonus: 0,
      attackAbility: null, weight: 0, notes: '',
      weapon: custom.kind === 'weapon' ? { category: 'simple', range: 'melee', damage: '1d6', damageType: 'slashing', versatile: null, properties: [], normalRange: null, longRange: null, mastery: null } : null,
      armor: custom.kind === 'armor' ? { category: 'light', ac: 11, dexMax: null, strength: null, stealthDisadvantage: false } : null
    };
    store.c.inventory.push(entry);
    open = entry.id;
    custom = { name: '', kind: 'gear' };
    adding = false;
  }

  const coins = ['pp', 'gp', 'ep', 'sp', 'cp'] as const;
  const kindLabel: Record<ItemEntry['kind'], string> = { weapon: 'Weapon', armor: 'Armor', gear: 'Gear', tool: 'Tool', other: 'Otro' };
  const sorted = $derived(
    c.inventory
      .map((it, i) => ({ it, i }))
      .sort((a, b) => Number(b.it.equipped) - Number(a.it.equipped) || a.it.name.localeCompare(b.it.name))
  );
</script>

<section class="inv">
  <div class="card stack">
    <h2>Equipado <span class="muted">· AC {ac.total}</span></h2>
    <p class="small">{ac.label}</p>
    {#if c.ac.mode !== 'auto'}
      <p class="small warn">
        El AC está en modo manual y no usa el inventario.
        <button class="ghost small" onclick={() => (store.c.ac.mode = 'auto')}>Usar automático</button>
      </p>
    {:else if acSwitched}
      <p class="small muted">El AC pasó a modo automático para usar tu armor.</p>
    {/if}
    <div class="coins">
      {#each coins as k (k)}
        <NumField label={k.toUpperCase()} bind:value={store.c.currency[k]} min={0} max={999999} />
      {/each}
    </div>
    <p class="small muted">
      Peso <b class="num">{weight.toFixed(1)}</b> / {capacity} lb · Attunement <b class="num">{attuned}</b> / 3
    </p>
  </div>

  <div class="card stack list">
    <h2>Inventario <span class="muted">· {c.inventory.length}</span></h2>
    {#each sorted as { it, i } (it.id)}
      <div class="item" class:eq={it.equipped}>
        <div class="item-row">
          <button class="name ghost" onclick={() => (open = open === it.id ? null : it.id)} aria-expanded={open === it.id}>
            <span>{it.name}{it.bonus ? ` +${it.bonus}` : ''}</span>
            <small class="muted">
              {kindLabel[it.kind]}{it.weapon ? ` · ${it.weapon.damage} ${it.weapon.damageType}` : ''}{it.armor ? ` · AC ${it.armor.category === 'shield' ? '+' : ''}${it.armor.ac}` : ''}{it.attuned ? ' · attuned' : ''}
            </small>
          </button>
          {#if equippable(it)}
            <button class="eqbtn" class:on={it.equipped} aria-pressed={it.equipped} onclick={() => toggleEquip(i)}>
              {it.equipped ? 'Equipado' : 'Equipar'}
            </button>
          {:else}
            <div class="qty">
              <button aria-label="Menos" onclick={() => (store.c.inventory[i].qty = Math.max(0, it.qty - 1))}>-</button>
              <b class="num">{it.qty}</b>
              <button aria-label="Más" onclick={() => (store.c.inventory[i].qty = it.qty + 1)}>+</button>
            </div>
          {/if}
        </div>

        {#if open === it.id}
          <div class="details stack">
            <label class="field"><span>Nombre</span><input bind:value={store.c.inventory[i].name} /></label>
            <div class="grid3">
              <NumField label="Cantidad" bind:value={store.c.inventory[i].qty} min={0} max={9999} />
              <NumField label="Bonus mágico" bind:value={store.c.inventory[i].bonus} min={-5} max={10} />
              <label class="field"><span>Peso (lb)</span><input type="number" step="0.1" min="0" bind:value={store.c.inventory[i].weight} /></label>
            </div>

            {#if it.weapon}
              <div class="grid3">
                <label class="field"><span>Daño</span><input bind:value={store.c.inventory[i].weapon!.damage} /></label>
                <label class="field"><span>Tipo</span><input bind:value={store.c.inventory[i].weapon!.damageType} /></label>
                <label class="field">
                  <span>Categoría</span>
                  <select bind:value={store.c.inventory[i].weapon!.category}>
                    <option value="simple">Simple</option>
                    <option value="martial">Martial</option>
                  </select>
                </label>
                <label class="field">
                  <span>Alcance</span>
                  <select bind:value={store.c.inventory[i].weapon!.range}>
                    <option value="melee">Melee</option>
                    <option value="ranged">Ranged</option>
                  </select>
                </label>
                <label class="field">
                  <span>Ability de ataque</span>
                  <select bind:value={store.c.inventory[i].attackAbility}>
                    <option value={null}>Automática</option>
                    {#each ABILITIES as a (a)}<option value={a}>{ABILITY_LABEL[a]}</option>{/each}
                  </select>
                </label>
              </div>
              <label class="field">
                <span>Properties (separadas por coma)</span>
                <input
                  value={it.weapon.properties.join(', ')}
                  onchange={(e) => (store.c.inventory[i].weapon!.properties = e.currentTarget.value.split(',').map((x) => x.trim()).filter(Boolean))}
                />
              </label>
              <p class="small muted">
                Ability automática: DEX en ranged, la mejor en finesse, STR en el resto. Cámbiala para Hex Warrior, Pact of the Blade o Battle Smith.
              </p>
            {/if}

            {#if it.armor}
              <div class="grid3">
                <label class="field">
                  <span>Tipo</span>
                  <select bind:value={store.c.inventory[i].armor!.category}>
                    <option value="light">Light</option>
                    <option value="medium">Medium</option>
                    <option value="heavy">Heavy</option>
                    <option value="shield">Shield</option>
                  </select>
                </label>
                <NumField label={it.armor.category === 'shield' ? 'Bonus AC' : 'AC base'} bind:value={store.c.inventory[i].armor!.ac} min={0} max={30} />
                <NumField label="STR requerida" value={it.armor.strength ?? 0} min={0} max={30} onchange={(n) => (store.c.inventory[i].armor!.strength = n || null)} />
              </div>
            {/if}

            <label class="check"><input type="checkbox" bind:checked={store.c.inventory[i].attuned} /><span>Attuned</span></label>
            <label class="field"><span>Notas</span><textarea rows="3" bind:value={store.c.inventory[i].notes}></textarea></label>
            <button class="danger" onclick={() => remove(i)}>Quitar del inventario</button>
          </div>
        {/if}
      </div>
    {:else}
      <p class="muted small">Inventario vacío.</p>
    {/each}
    <p class="small muted">
      Weapon proficiencies: {profs.weapons.join(', ') || 'ninguna'} · Armor: {profs.armor.join(', ') || 'ninguna'}
    </p>
  </div>

  <div class="card stack">
    <h2>Agregar</h2>
    {#if all.length}
      <div class="seg">
        {#each tabs as [id, label] (id)}
          <button class:on={tab === id} onclick={() => (tab = id)}>{label}</button>
        {/each}
      </div>
      <input bind:value={q} placeholder="Buscar..." aria-label="Buscar item" />
      <ul class="results">
        {#each results as r (r.value)}
          <li>
            <div class="r-info">
              <span>{r.item.name}</span>
              <small class="muted">
                {#if r.item.weapon}{r.item.weapon.category} {r.item.weapon.range} · {r.item.weapon.damage} {r.item.weapon.damageType}{r.item.weapon.properties.length ? ` · ${r.item.weapon.properties.join(', ')}` : ''}
                {:else if r.item.armor}{r.item.armor.category} · AC {r.item.armor.category === 'shield' ? '+' : ''}{r.item.armor.ac}{r.item.armor.dexMax === null ? ' + DEX' : r.item.armor.dexMax ? ` + DEX (máx. ${r.item.armor.dexMax})` : ''}
                {:else}{r.item.category}{/if}{r.item.cost ? ` · ${r.item.cost}` : ''}
              </small>
            </div>
            <button class="addbtn" aria-label={`Agregar ${r.item.name}`} onclick={() => add(r)}>+</button>
          </li>
        {:else}
          <li class="muted small">Sin resultados.</li>
        {/each}
      </ul>
    {:else}
      <p class="small muted">Importa un pack con items para elegir de una lista.</p>
    {/if}

    {#if adding}
      <div class="grid2">
        <label class="field"><span>Nombre</span><input bind:value={custom.name} placeholder="Ej. Pistol, Bag of Holding" /></label>
        <label class="field">
          <span>Tipo</span>
          <select bind:value={custom.kind}>
            {#each Object.entries(kindLabel) as [k, l] (k)}<option value={k}>{l}</option>{/each}
          </select>
        </label>
      </div>
      <div class="row">
        <button onclick={() => (adding = false)}>Cancelar</button>
        <button class="primary" onclick={addCustom} disabled={!custom.name.trim()}>Crear</button>
      </div>
    {:else}
      <button onclick={() => (adding = true)}>Item propio (homebrew o magic item)</button>
    {/if}
  </div>
</section>

<style>
  .inv {
    display: grid;
    gap: var(--gap);
  }
  @container (min-width: 760px) {
    .inv {
      grid-template-columns: 1fr 1fr;
      align-items: start;
    }
    .list {
      grid-row: span 2;
    }
  }
  .card h2 {
    margin-bottom: 0;
  }
  p {
    margin: 0;
  }
  .warn {
    color: var(--accent);
  }
  .warn button {
    min-height: 32px;
    padding: 0 8px;
    text-decoration: underline;
  }
  .coins {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }
  .coins :global(input) {
    padding: 0 6px;
    text-align: center;
  }
  .item {
    border-top: 1px solid var(--line);
  }
  .item.eq .name span {
    color: var(--accent);
  }
  .item-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 56px;
  }
  .name {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    border: none;
    padding: 6px 0;
  }
  .name span {
    font-weight: 600;
  }
  .eqbtn {
    min-height: 40px;
    padding: 0 12px;
    font-size: 0.85rem;
  }
  .eqbtn.on {
    border-color: var(--accent);
    color: var(--accent);
  }
  .qty {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .qty button {
    width: 40px;
    min-height: 40px;
    padding: 0;
  }
  .qty b {
    min-width: 20px;
    text-align: center;
  }
  .details {
    padding: 4px 0 14px;
  }
  .grid2,
  .grid3 {
    display: grid;
    gap: 8px;
    grid-template-columns: 1fr 1fr;
  }
  .grid3 {
    grid-template-columns: repeat(3, 1fr);
  }
  @container (max-width: 380px) {
    .grid3 {
      grid-template-columns: 1fr 1fr;
    }
  }
  .seg {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    background: var(--bg);
    padding: 4px;
    border-radius: 12px;
  }
  .seg button {
    border: none;
    background: transparent;
    min-height: 40px;
    padding: 0;
    font-size: 0.85rem;
  }
  .seg button.on {
    background: var(--surface-2);
    color: var(--accent);
    font-weight: 650;
  }
  .results {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 420px;
    overflow-y: auto;
  }
  .results li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border-top: 1px solid var(--line);
  }
  .r-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .addbtn {
    width: var(--tap);
    padding: 0;
    font-size: 1.3rem;
  }
  .check {
    display: flex;
    gap: 10px;
    align-items: center;
    min-height: 40px;
  }
  .check input {
    width: 22px;
    min-height: 22px;
    accent-color: var(--accent);
  }
</style>
