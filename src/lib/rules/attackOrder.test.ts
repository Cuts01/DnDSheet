import { describe, expect, it } from 'vitest';
import { moveAttack, orderAttacks } from './attackOrder';

const L = ['w:a', 'w:b', 's:c'].map((key) => ({ key }));
describe('attack order', () => {
  it('respeta el orden guardado y deja los nuevos al final en su orden', () => {
    expect(orderAttacks(L, ['s:c', 'w:a']).map((x) => x.key)).toEqual(['s:c', 'w:a', 'w:b']);
    expect(orderAttacks(L, []).map((x) => x.key)).toEqual(['w:a', 'w:b', 's:c']);
  });
  it('mueve con los vecinos y no se sale de los bordes', () => {
    expect(moveAttack(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(moveAttack(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(moveAttack(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
  });
});
