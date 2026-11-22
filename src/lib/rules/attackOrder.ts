/* Orden de los ataques elegido por el jugador. Claves: "w:<id>" (armas, Unarmed Strike) y "s:<id>" (spells).
   Los ataques que no están en el orden guardado (un arma nueva) van al final, en su orden normal. */
export function orderAttacks<T extends { key: string }>(list: T[], order: string[]): T[] {
  const pos = new Map(order.map((k, i) => [k, i]));
  return list
    .map((x, i) => ({ x, i }))
    .sort((a, b) => (pos.get(a.x.key) ?? 1e6 + a.i) - (pos.get(b.x.key) ?? 1e6 + b.i))
    .map((o) => o.x);
}

/* Mueve un ataque una posición arriba (-1) o abajo (+1) y devuelve el orden completo. */
export function moveAttack(keys: string[], key: string, dir: -1 | 1): string[] {
  const out = [...keys];
  const i = out.indexOf(key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= out.length) return out;
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
