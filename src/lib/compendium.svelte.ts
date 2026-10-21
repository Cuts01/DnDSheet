import { db } from './db';
import { parsePack, type Pack } from './model/pack';

/* Packs de contenido importados. Viven en IndexedDB, separados del personaje. */
class CompendiumStore {
  packs = $state<Pack[]>([]);
  broken = $state<string[]>([]);

  async load() {
    const rows = await db.packs.toArray();
    const ok: Pack[] = [];
    const bad: string[] = [];
    for (const row of rows) {
      const r = parsePack(row.raw);
      if (r.ok) ok.push(r.pack);
      else bad.push(row.id);
    }
    this.packs = ok.sort((a, b) => a.pack.name.localeCompare(b.pack.name));
    this.broken = bad;
  }

  has(id: string) {
    return this.packs.some((p) => p.pack.id === id);
  }

  async add(raw: unknown, pack: Pack) {
    await db.packs.put({ id: pack.pack.id, raw, importedAt: new Date().toISOString() });
    await this.load();
  }

  async remove(id: string) {
    await db.packs.delete(id);
    await this.load();
  }

  async exportRaw(id: string): Promise<unknown> {
    return (await db.packs.get(id))?.raw;
  }
}

export const compendium = new CompendiumStore();
