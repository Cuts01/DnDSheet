import { db, MAIN_ID } from './db';
import { CharacterSchema, blankCharacter, type Character } from './model/character';
import { clampUsage } from './rules/rests';
import { t as tr } from './i18n.svelte';

/*
 * Estado global del personaje.
 * - `c` es reactivo: los formularios pueden enlazarse directo (bind:value).
 * - `apply` ejecuta acciones puras de lib/rules sobre una copia plana.
 * - El guardado en IndexedDB lo dispara un $effect en App.svelte.
 */
class CharacterStore {
  c = $state<Character>(blankCharacter());
  loaded = $state(false);
  /* false hasta que se crea o importa un personaje: la app muestra la pantalla de creacion. */
  hasCharacter = $state(false);
  loadError = $state<string | null>(null);
  persisted = $state<boolean | null>(null);

  #timer: ReturnType<typeof setTimeout> | undefined;
  #pending: Character | null = null;

  async load() {
    try {
      const row = await db.characters.get(MAIN_ID);
      if (row) {
        const parsed = CharacterSchema.safeParse(row.data);
        if (parsed.success) {
          this.c = parsed.data;
          this.hasCharacter = true;
        } else this.loadError = tr('El personaje guardado no pasó la validación. Se cargó uno nuevo: importa tu respaldo.');
      }
    } catch (e) {
      this.loadError = `${tr('No se pudo abrir IndexedDB')}: ${(e as Error).message}`;
    }
    this.loaded = true;
    this.persisted = (await navigator.storage?.persisted?.()) ?? null;
    if (this.persisted === false) this.persisted = (await navigator.storage?.persist?.()) ?? false;
  }

  snapshot(): Character {
    return $state.snapshot(this.c) as Character;
  }

  apply(fn: (c: Character) => Character) {
    this.c = fn(this.snapshot());
  }

  replace(next: Character) {
    this.c = clampUsage(next);
    this.hasCharacter = true;
  }

  /* Borra el personaje del dispositivo y vuelve a la pantalla de creacion. */
  async discard() {
    clearTimeout(this.#timer);
    this.#pending = null;
    await db.characters.delete(MAIN_ID);
    this.hasCharacter = false;
    this.c = blankCharacter();
  }

  queueSave(data: Character) {
    this.#pending = data;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.flush(), 250);
  }

  async flush() {
    clearTimeout(this.#timer);
    const data = this.#pending;
    if (!data) return;
    this.#pending = null;
    await db.characters.put({ id: MAIN_ID, data: { ...data, updatedAt: new Date().toISOString() } });
  }

  async requestPersist() {
    this.persisted = (await navigator.storage?.persist?.()) ?? false;
  }
}

export const store = new CharacterStore();
