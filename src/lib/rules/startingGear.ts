/* Equipo inicial del background: lee el texto ("Dagger, 2 Pouches, Oil (3 flasks), 38 GP (or 50 GP)")
   y lo carga al inventario (opción A) o da el oro (opción B). Lo agregado se recuerda para poder deshacerlo. */
import { uid, type Character, type ItemEntry } from '../model/character';
import type { Pack } from '../model/pack';
import { itemEntryFrom, itemList } from './features';

export interface GearLine {
  name: string;
  qty: number;
  note: string;
}
export interface GearPlan {
  items: GearLine[];
  gp: number;
  /* Oro de la opción B ("or 50 GP"); null si el background no la tiene (2014). */
  alt: number | null;
}

/* Separa por comas fuera de paréntesis. */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

export function parseEquipment(text: string): GearPlan {
  let s = text.trim();
  let alt: number | null = null;
  const m = /\(\s*or\s+(\d+)\s*gp\s*\)\s*$/i.exec(s);
  if (m) {
    alt = Number(m[1]);
    s = s.slice(0, m.index).trim();
  }
  const items: GearLine[] = [];
  let gp = 0;
  for (let tok of splitTop(s)) {
    tok = tok.replace(/^(and|a set of|a|an)\s+/i, '').trim();
    // "a pouch containing 15 gp" o "38 GP"
    const gold = /(\d+)\s*gp\b/i.exec(tok);
    if (gold) {
      gp += Number(gold[1]);
      tok = tok.replace(/(containing\s+)?\d+\s*gp\b/i, '').replace(/^(a|an)\s+/i, '').trim();
      if (!tok || /^pouch$/i.test(tok)) {
        if (/pouch/i.test(tok)) items.push({ name: 'Pouch', qty: 1, note: '' });
        continue;
      }
    }
    let qty = 1;
    let note = '';
    const lead = /^(\d+)\s+(.+)$/.exec(tok);
    if (lead) {
      qty = Number(lead[1]);
      tok = lead[2];
    }
    const par = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(tok);
    if (par) {
      tok = par[1];
      const inner = par[2].trim();
      const n = /^(\d+)\s+\w+/.exec(inner);
      if (n) qty *= Number(n[1]);
      else if (!/same as above|any/i.test(inner)) note = inner;
    }
    if (tok) items.push({ name: tok.charAt(0).toUpperCase() + tok.slice(1), qty, note });
  }
  return { items, gp, alt };
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const singular = (s: string) => s.replace(/ies$/i, 'y').replace(/(ch|sh|x|s)es$/i, '$1').replace(/s$/i, '');

/* Arma las entradas de inventario, usando los objetos del pack cuando el nombre coincide. */
export function gearEntries(plan: GearPlan, packs: Pack[], ruleset: string): ItemEntry[] {
  const items = itemList(packs, ruleset);
  const find = (name: string) => {
    const want = [key(name), key(singular(name))];
    return (
      items.find((r) => want.includes(key(r.item.name))) ??
      items.find((r) => want.includes(key(r.item.name.split(' (')[0]))) ??
      items.find((r) => want.includes(key(singular(r.item.name.split(' (')[0])))) ??
      null
    );
  };
  return plan.items.map((g) => {
    const r = find(g.name);
    const e: ItemEntry = r
      ? itemEntryFrom(r)
      : { id: uid(), ref: null, name: g.name, kind: 'gear', qty: 1, equipped: false, attuned: false, bonus: 0, attackAbility: null, weight: 0, notes: '', weapon: null, armor: null };
    e.qty = g.qty;
    if (g.note) e.notes = e.notes ? `${g.note}. ${e.notes}` : g.note;
    return e;
  });
}

/* Quita lo que se agregó antes (si sigue en el inventario) y devuelve el oro. */
export function undoStartingGear(c: Character): Character {
  const n = structuredClone(c);
  const g = n.startingGear;
  if (!g.choice) return n;
  n.inventory = n.inventory.filter((i) => !g.itemIds.includes(i.id));
  n.currency.gp = Math.max(0, n.currency.gp - g.gp);
  n.startingGear = { choice: '', itemIds: [], gp: 0 };
  return n;
}

export function applyStartingGear(c: Character, text: string, choice: 'A' | 'B', packs: Pack[]): Character {
  const n = undoStartingGear(c);
  const plan = parseEquipment(text);
  if (choice === 'B' && plan.alt != null) {
    n.currency.gp += plan.alt;
    n.startingGear = { choice: 'B', itemIds: [], gp: plan.alt };
    return n;
  }
  const entries = gearEntries(plan, packs, n.ruleset);
  n.inventory.push(...entries);
  n.currency.gp += plan.gp;
  n.startingGear = { choice: 'A', itemIds: entries.map((e) => e.id), gp: plan.gp };
  return n;
}
