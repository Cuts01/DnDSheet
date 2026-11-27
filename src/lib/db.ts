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
 * v1: personaje. v2: packs de contenido importados. v3: campañas.
 */
export interface CampaignRow {
  id: string;
  data: unknown;
}

export const db = new Dexie('hoja5e') as Dexie & {
  characters: EntityTable<CharacterRow, 'id'>;
  packs: EntityTable<PackRow, 'id'>;
  campaigns: EntityTable<CampaignRow, 'id'>;
};

db.version(1).stores({
  characters: 'id'
});
db.version(2).stores({
  characters: 'id',
  packs: 'id'
});
/* v3: campañas (opcionales), compartidas entre PJs. */
db.version(3).stores({
  characters: 'id',
  packs: 'id',
  campaigns: 'id'
});

export const MAIN_ID = 'main';
