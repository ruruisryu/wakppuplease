import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, fresh, B } from '../src/game/simulation.ts';
import { validate } from '../src/game/save.ts';
test('completion is once per batch and never directly gives coins', () => {
  const g = new Game();
  g.s.wax.fill(1);
  assert.ok(g.complete(1));
  assert.equal(g.s.tray, 1);
  assert.equal(g.s.coins, 0);
  assert.equal(g.complete(1), false);
  assert.equal(g.s.tray, 1);
});
test('full output blocks completion without losing work', () => {
  const g = new Game();
  g.s.tray = 8;
  g.s.wax.fill(1);
  assert.equal(g.complete(1), false);
  assert.equal(g.s.batch, 1);
  g.s.tray--;
  assert.ok(g.complete(1));
  assert.equal(g.s.tray, 8);
});
test('no customer or no goods means no passive income', () => {
  const g = new Game();
  for (let i = 0; i < 2000; i++) g.tick(0.05, false);
  assert.equal(g.s.coins, 0);
  assert.ok(g.s.customers.length <= 4);
});
test('physical delivery followed by customer handover yields one net sale', () => {
  const g = new Game();
  g.s.tray = 1;
  g.s.player.x = -0.5;
  g.s.player.z = -1.55;
  g.tick(0.4, false);
  assert.equal(g.s.carried, 1);
  assert.equal(g.s.tray, 0);
  g.s.player.x = -1;
  g.s.player.z = 1.4;
  g.tick(0.4, false);
  assert.equal(g.s.shelf, 1);
  for (let i = 0; i < 500; i++) g.tick(0.05, false);
  assert.equal(g.s.sold, 1);
  assert.equal(g.s.coins, 10);
  assert.equal(g.s.shelf, 0);
});
test('runner moves real goods; production requires expanded workstation', () => {
  const g = new Game();
  g.s.tray = 2;
  g.s.upgrades.runner = true;
  let furthestZ = g.s.runner.z;
  for (let i = 0; i < 80; i++) {
    g.tick(0.05, true);
    furthestZ = Math.max(furthestZ, g.s.runner.z);
  }
  assert.ok(g.s.shelf > 0);
  assert.ok(furthestZ > 0, 'runner must physically visit the shelf before returning');
  assert.equal(g.s.made, 0);
  g.s.upgrades.expansion = true;
  for (let i = 0; i < 250; i++) g.tick(0.05, true);
  assert.equal(g.s.made, 1);
});
test('purchase debits once and changes carry capacity', () => {
  const g = new Game();
  g.s.coins = 30;
  assert.ok(g.buy('carry'));
  assert.equal(g.capacity(), 3);
  assert.equal(g.s.coins, 0);
  assert.equal(g.buy('carry'), false);
  assert.equal(g.buy('runner'), false);
});
test('movement collides with furniture and room edges', () => {
  const g = new Game();
  g.s.player.x = -3.7;
  g.s.player.z = -1.4;
  for (let i = 0; i < 100; i++) g.move(0, -1, 0.05);
  assert.ok(g.s.player.z > -1.9);
  g.s.player.x = 0;
  g.s.player.z = 0;
  for (let i = 0; i < 100; i++) g.move(-1, 0, 0.05);
  assert.ok(g.s.player.x > -6.4);
});
test('save validation rejects damaged and unsupported saves', () => {
  assert.ok(validate(fresh()));
  assert.equal(validate({ ...fresh(), version: 2 }), false);
  assert.equal(validate({ ...fresh(), coins: -1 }), false);
  assert.equal(validate({ ...fresh(), wax: [1] }), false);
  assert.equal(validate({ ...fresh(), runner: null }), false);
  assert.equal(validate({ ...fresh(), settings: { muted: false } }), false);
});
