import { db, MAIN_ID } from './db';
import { CharacterSchema, blankCharacter, uid, type Character } from './model/character';
import { clampUsage } from './rules/rests';
import { classSummary, totalLevel } from './rules/derive';
import { t as tr } from './i18n.svelte';

/* Resumen de cada personaje guardado, para la lista de personajes. */
export interface CharacterInfo {
  id: string;
  name: string;
  summary: string;
  level: number;
  ruleset: string;
  updatedAt: string;
  /* false si el registro no pasó la validación (se puede borrar, no abrir). */
  valid: boolean;
}

const ACTIVE_KEY = 'hoja5e:active';
const readActive = () => {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
};
const writeActive = (id: string | null) => {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* sin storage: al abrir se elige el más reciente */
  }
};

const infoOf = (id: string, c: Character): CharacterInfo => ({
  id,
  name: c.name,
  summary: classSummary(c),
  level: totalLevel(c),
  ruleset: c.ruleset,
  updatedAt: c.updatedAt,
  valid: true
});

/*
 * Estado global de personajes.
 * - Cada personaje es una fila de IndexedDB (el primero conserva el id 'main' de versiones anteriores).
 * - `c` es el personaje abierto y es reactivo: los formularios pueden enlazarse directo (bind:value).
 * - `apply` ejecuta acciones puras de lib/rules sobre una copia plana.
 * - El guardado lo dispara un $effect en App.svelte y siempre va al id del personaje que se editó.
 */
class CharacterStore {
  c = $state<Character>(blankCharacter());
  currentId = $state<string | null>(null);
  list = $state<CharacterInfo[]>([]);
  loaded = $state(false);
  /* false cuando no hay ningún personaje abierto: la app muestra la pantalla de creación. */
  hasCharacter = $state(false);
  loadError = $state<string | null>(null);
  persisted = $state<boolean | null>(null);

  #timer: ReturnType<typeof setTimeout> | undefined;
  #pending: { id: string; data: Character } | null = null;
  /* Último JSON guardado o cargado, para no reescribir (ni cambiar la fecha) si nada cambió. */
  #last = '';

  async load() {
    try {
      const rows = await db.characters.toArray();
      const parsed = new Map<string, Character>();
      const list: CharacterInfo[] = [];
      for (const row of rows) {
        const r = CharacterSchema.safeParse(row.data);
        if (r.success) {
          parsed.set(row.id, r.data);
          list.push(infoOf(row.id, r.data));
        } else {
          const raw = (row.data ?? {}) as { name?: unknown };
          list.push({ id: row.id, name: String(raw.name ?? '?'), summary: '', level: 0, ruleset: '', updatedAt: '', valid: false });
        }
      }
      this.list = sortList(list);
      if (list.some((x) => !x.valid)) this.loadError = tr('Un personaje guardado no pasó la validación y no se puede abrir. Impórtalo de nuevo desde tu respaldo.');
      const saved = readActive();
      const id = saved && parsed.has(saved) ? saved : this.list.find((x) => x.valid)?.id;
      if (id) this.#open(id, parsed.get(id)!);
    } catch (e) {
      this.loadError = `${tr('No se pudo abrir IndexedDB')}: ${(e as Error).message}`;
    }
    this.loaded = true;
    this.persisted = (await navigator.storage?.persisted?.()) ?? null;
    if (this.persisted === false) this.persisted = (await navigator.storage?.persist?.()) ?? false;
  }

  #open(id: string, c: Character) {
    this.c = c;
    this.currentId = id;
    this.hasCharacter = true;
    this.#last = JSON.stringify(c);
    writeActive(id);
  }

  snapshot(): Character {
    return $state.snapshot(this.c) as Character;
  }

  apply(fn: (c: Character) => Character) {
    this.c = fn(this.snapshot());
  }

  /* Cambia al personaje indicado, guardando antes los cambios pendientes del actual. */
  async select(id: string) {
    if (id === this.currentId) return;
    await this.flush();
    const row = await db.characters.get(id);
    const r = CharacterSchema.safeParse(row?.data);
    if (!r.success) return;
    this.#open(id, r.data);
  }

  /* Guarda un personaje nuevo (creado o importado) y lo abre. */
  async add(next: Character): Promise<string> {
    await this.flush();
    const id = this.currentId || this.list.length ? uid() : MAIN_ID;
    const c = clampUsage(next);
    c.updatedAt = new Date().toISOString();
    await db.characters.put({ id, data: c });
    this.list = sortList([...this.list.filter((x) => x.id !== id), infoOf(id, c)]);
    this.#open(id, c);
    return id;
  }

  /* Reemplaza el personaje abierto (importar un respaldo encima). */
  replace(next: Character) {
    if (!this.currentId) {
      void this.add(next);
      return;
    }
    this.c = clampUsage(next);
    this.hasCharacter = true;
  }

  async duplicate() {
    const copy = this.snapshot();
    copy.name = tr('{name} (copia)', { name: copy.name });
    await this.add(copy);
  }

  /* Borra un personaje del dispositivo. Si era el abierto, abre otro o vuelve a la pantalla de creación. */
  async remove(id: string) {
    if (id === this.currentId) {
      clearTimeout(this.#timer);
      this.#pending = null;
    }
    await db.characters.delete(id);
    this.list = this.list.filter((x) => x.id !== id);
    if (id !== this.currentId) return;
    const next = this.list.find((x) => x.valid);
    if (next) {
      this.currentId = null;
      await this.select(next.id);
    } else {
      this.currentId = null;
      this.hasCharacter = false;
      this.c = blankCharacter();
      writeActive(null);
    }
  }

  /* Sin personaje abierto: la app muestra la pantalla de creación (los demás siguen guardados). */
  async startNew() {
    await this.flush();
    this.hasCharacter = false;
  }

  /* Vuelve al personaje abierto desde la pantalla de creación. */
  cancelNew() {
    if (this.currentId) this.hasCharacter = true;
  }

  queueSave(data: Character) {
    if (!this.currentId) return;
    if (JSON.stringify(data) === this.#last) return;
    this.#pending = { id: this.currentId, data };
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.flush(), 250);
  }

  async flush() {
    clearTimeout(this.#timer);
    const p = this.#pending;
    if (!p) return;
    this.#pending = null;
    const data = { ...p.data, updatedAt: new Date().toISOString() };
    await db.characters.put({ id: p.id, data });
    if (p.id === this.currentId) {
      this.c.updatedAt = data.updatedAt;
      this.#last = JSON.stringify({ ...p.data, updatedAt: data.updatedAt });
    }
    const i = this.list.findIndex((x) => x.id === p.id);
    const info = infoOf(p.id, data);
    if (i >= 0) this.list[i] = info;
    else this.list = sortList([...this.list, info]);
  }

  async requestPersist() {
    this.persisted = (await navigator.storage?.persist?.()) ?? false;
  }
}

const sortList = (l: CharacterInfo[]) => [...l].sort((a, b) => a.name.localeCompare(b.name));

export const store = new CharacterStore();
