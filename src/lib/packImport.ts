import { compendium } from './compendium.svelte';
import { parsePack, type Pack } from './model/pack';
import { t as tr } from './i18n.svelte';

/* Los packs de la wiki generados antes de esta fecha no traen spells, passives, spells de subclass ni spells de feats. */
export const MIN_WIKI_BUILT = '2026-10-27T23:33:00Z';
export const isStale = (p: Pack) => p.pack.id.startsWith('wiki-') && (p.pack.built || '') < MIN_WIKI_BUILT;
export const stalePacks = () => compendium.packs.filter(isStale);

export interface ImportResult {
  done: string[];
  errors: string[];
}

/* Importa JSON ya leídos. ask=false reemplaza sin preguntar (botón de actualizar). */
export async function importRaws(items: { name: string; raw: unknown }[], ask = true): Promise<ImportResult> {
  const out: ImportResult = { done: [], errors: [] };
  for (const { name, raw } of items) {
    const r = parsePack(raw);
    if (!r.ok) {
      out.errors.push(...r.errors.map((m) => `${name}: ${m}`));
      continue;
    }
    const old = compendium.packs.find((p) => p.pack.id === r.pack.pack.id);
    if (old && ask && !isStale(old) && !confirm(tr('Ya existe el pack "{id}". ¿Reemplazarlo?', { id: r.pack.pack.id }))) continue;
    await compendium.add(raw, r.pack);
    out.done.push(r.pack.pack.name);
    if (isStale(r.pack))
      out.errors.push(
        tr('{name} es una versión vieja (generado {date}). Usa el archivo más reciente.', { name, date: r.pack.pack.built ? new Date(r.pack.pack.built).toLocaleString() : tr('antes de que los packs tuvieran fecha') })
      );
  }
  return out;
}

export async function importFiles(files: File[]): Promise<ImportResult> {
  const items: { name: string; raw: unknown }[] = [];
  const errors: string[] = [];
  for (const f of files) {
    try {
      items.push({ name: f.name, raw: JSON.parse(await f.text()) });
    } catch {
      errors.push(`${f.name}: ${tr('no es JSON válido.')}`);
    }
  }
  const r = await importRaws(items);
  return { done: r.done, errors: [...errors, ...r.errors] };
}

/* Los packs de la wiki vienen con la app (public/packs). */
export const canLoadLocal = true;
const bundled = (name: string) => `${import.meta.env.BASE_URL}packs/${name}`;

export async function importLocalWiki(): Promise<ImportResult> {
  const items: { name: string; raw: unknown }[] = [];
  const errors: string[] = [];
  for (const name of ['wiki-2014.json', 'wiki-2024.json']) {
    try {
      const res = await fetch(bundled(name), { cache: 'no-cache' });
      if (!res.ok) throw new Error(String(res.status));
      items.push({ name, raw: await res.json() });
    } catch {
      errors.push(`${name}: ${tr('no se pudo cargar (¿sin conexión?).')}`);
    }
  }
  const r = await importRaws(items, false);
  return { done: r.done, errors: [...errors, ...r.errors] };
}

/* Al abrir la app: importa los packs de la wiki que vienen con ella si faltan o si son más nuevos que los guardados.
   Sin conexión no pasa nada: se siguen usando los de IndexedDB. */
export async function autoSyncLocal(): Promise<string[]> {
  const done: string[] = [];
  for (const name of ['wiki-2014.json', 'wiki-2024.json']) {
    try {
      const res = await fetch(bundled(name), { cache: 'no-cache' });
      if (!res.ok) continue;
      const raw = await res.json();
      const r = parsePack(raw);
      if (!r.ok) continue;
      const old = compendium.packs.find((p) => p.pack.id === r.pack.pack.id);
      if (!old || (r.pack.pack.built || '') > (old.pack.built || '')) {
        await compendium.add(raw, r.pack);
        done.push(r.pack.pack.name);
      }
    } catch {
      /* offline */
    }
  }
  return done;
}
