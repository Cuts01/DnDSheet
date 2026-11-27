import { db } from './db';
import { CampaignSchema, blankCampaign, type Campaign } from './model/campaign';
import { uid } from './model/character';

const ENABLED_KEY = 'hoja5e:campaigns';
const readEnabled = () => {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
};

/*
 * Campañas guardadas en IndexedDB (tabla campaigns). Son opcionales: la pestaña aparece solo si se activan en Datos.
 * Los formularios editan `list` directo; `touch` programa el guardado de esa campaña.
 */
class CampaignStore {
  list = $state<Campaign[]>([]);
  loaded = $state(false);
  enabled = $state(readEnabled());

  #timers = new Map<string, ReturnType<typeof setTimeout>>();

  async load() {
    try {
      const rows = await db.campaigns.toArray();
      this.list = rows
        .map((r) => CampaignSchema.safeParse(r.data))
        .filter((r) => r.success)
        .map((r) => r.data!)
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      this.list = [];
    }
    this.loaded = true;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    try {
      localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
    } catch {
      /* sin storage: dura hasta recargar */
    }
  }

  get(id: string | null | undefined): Campaign | null {
    return id ? (this.list.find((x) => x.id === id) ?? null) : null;
  }

  async create(name: string): Promise<Campaign> {
    const c = blankCampaign(uid(), name);
    c.updatedAt = new Date().toISOString();
    await db.campaigns.put({ id: c.id, data: c });
    this.list = [...this.list, c].sort((a, b) => a.name.localeCompare(b.name));
    return this.get(c.id)!;
  }

  /* Agrega (o actualiza) una campaña que viene en un respaldo. */
  async upsert(raw: unknown): Promise<Campaign | null> {
    const r = CampaignSchema.safeParse(raw);
    if (!r.success) return null;
    await db.campaigns.put({ id: r.data.id, data: r.data });
    this.list = [...this.list.filter((x) => x.id !== r.data.id), r.data].sort((a, b) => a.name.localeCompare(b.name));
    return this.get(r.data.id);
  }

  /* Programa el guardado de una campaña editada en el formulario. */
  touch(id: string) {
    clearTimeout(this.#timers.get(id));
    this.#timers.set(
      id,
      setTimeout(() => void this.save(id), 300)
    );
  }

  async save(id: string) {
    clearTimeout(this.#timers.get(id));
    this.#timers.delete(id);
    const c = this.get(id);
    if (!c) return;
    c.updatedAt = new Date().toISOString();
    await db.campaigns.put({ id, data: $state.snapshot(c) });
  }

  async flush() {
    await Promise.all([...this.#timers.keys()].map((id) => this.save(id)));
  }

  async remove(id: string) {
    clearTimeout(this.#timers.get(id));
    this.#timers.delete(id);
    await db.campaigns.delete(id);
    this.list = this.list.filter((x) => x.id !== id);
  }
}

export const campaigns = new CampaignStore();
