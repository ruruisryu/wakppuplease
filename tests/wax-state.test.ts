import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeSurface, decodeSurface } from '../src/render/wax-surfaces.ts';
import { load, KEY } from '../src/game/save.ts';
import { fresh } from '../src/game/simulation.ts';
test('shared fracture vertices restore at Float32 precision', () => {
  const a = [0.123456789, 0, 0, 0, 1, 0],
    b = [1, 0, 0, 0, 1, 0],
    c = [1, 1, 0, 0, 1, 0],
    d = [0, 1, 0, 0, 1, 0];
  const surface = [
      [a, b, c],
      [a, c, d],
    ],
    encoded = encodeSurface(surface);
  assert.deepEqual(
    decodeSurface(encoded),
    surface.map((t) => t.map((v) => v.map(Math.fround))),
  );
  assert.ok(atob(encoded).length < surface.flat(2).length * 4);
});
test('corrupted wax binary is rejected before mesh creation', () => {
  assert.throws(() => decodeSurface(btoa('bad')));
  const text = encodeSurface([
    [
      [0, 0, 0, 0, 1, 0],
      [1, 0, 0, 0, 1, 0],
      [0, 1, 0, 0, 1, 0],
    ],
  ]);
  assert.throws(() => decodeSurface(text.slice(0, -4)));
});
test('original shop save migrates without losing coins, staff or inventory', () => {
  const { waxWork, workbench, ...state } = fresh();
  const old = {
    ...state,
    version: 1,
    coins: 170,
    tray: 3,
    carried: 1,
    wax: Array(80).fill(0.5),
    upgrades: { ...state.upgrades, runner: true, expansion: true },
  };
  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => (key === KEY ? JSON.stringify(old) : null) },
  });
  try {
    const loaded = load();
    assert.equal(loaded.state.version, 2);
    assert.equal(loaded.state.coins, 170);
    assert.equal(loaded.state.tray, 3);
    assert.equal(loaded.state.carried, 1);
    assert.ok(loaded.state.upgrades.runner);
    assert.ok(loaded.state.upgrades.expansion);
    assert.equal(loaded.state.waxWork, 0);
    assert.equal(loaded.state.workbench, null);
    assert.ok(loaded.migrated);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original });
  }
});
