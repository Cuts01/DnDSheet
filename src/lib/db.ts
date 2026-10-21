import Dexie, { type EntityTable } from 'dexie';

export interface CharacterRow {
  id: string;
  data: unknown;
}

export interface PackRow {
  id: string;
  /* JSON original del pack. Se vuelve a validar al cargar, asi sobrevive a cambios de formato. */
  raw: unknown;
  importedAt: string;
}

/*
 * IndexedDB via Dexie.
 * v1: personaje. v2: packs de contenido importados.
 */
export const db = new Dexie('hoja5e') as Dexie & {
  characters: EntityTable<CharacterRow, 'id'>;
  packs: EntityTable<PackRow, 'id'>;
};

db.version(1).stores({
  characters: 'id'
});
db.version(2).stores({
  characters: 'id',
  packs: 'id'
});

export const MAIN_ID = 'main';
