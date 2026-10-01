import balance from './balance.json' with { type: 'json' };
export const B = balance;
export type Upgrade = keyof typeof B.upgrades;
export type Person = { x: number; z: number; heading: number; walk: number };
export type Customer = Person & {
  id: number;
  phase: 'in' | 'wait' | 'out';
  wait: number;
  service: number;
  paid: boolean;
};
export type State = {
  version: 1;
  coins: number;
  sold: number;
  made: number;
  tray: number;
  shelf: number;
  carried: number;
  player: Person;
  upgrades: Record<Upgrade, boolean>;
  wax: number[];
  batch: number;
  customers: Customer[];
  arrival: number;
  serial: number;
  runner: Person & { load: number; target: 'tray' | 'shelf' };
  production: number;
  settings: { muted: boolean; volume: number; reduced: boolean; quality: 'high' | 'low' };
};
export const spots = {
  bench: { x: -3.7, z: -1.65 },
  tray: { x: -0.5, z: -1.55 },
  shelf: { x: -1, z: 0.45 },
  expand: { x: 4, z: -1.4 },
};
export const obstacles = [
  { x: -3.7, z: -2.9, w: 2.7, d: 1.5 },
  { x: -0.5, z: -2.7, w: 1.8, d: 1.3 },
  { x: -1, z: 2.55, w: 4.4, d: 1.25 },
  { x: 4, z: -2.9, w: 2.7, d: 1.5 },
];
export const fresh = (): State => ({
  version: 1,
  coins: 0,
  sold: 0,
  made: 0,
  tray: 0,
  shelf: 0,
  carried: 0,
  player: { x: -3.7, z: 0, heading: 0, walk: 0 },
  upgrades: { carry: false, runner: false, runnerCarry: false, expansion: false },
  wax: Array(80).fill(0),
  batch: 1,
  customers: [],
  arrival: 2,
  serial: 1,
  runner: { x: -0.5, z: -1.4, heading: 0, walk: 0, load: 0, target: 'tray' },
  production: 0,
  settings: { muted: false, volume: 0.45, reduced: false, quality: 'high' },
});
export type Event = {
  type: 'pick' | 'drop' | 'sale' | 'made' | 'upgrade';
  x: number;
  z: number;
  amount?: number;
};
export class Game {
  s: State;
  events: Event[] = [];
  transfer = 0;
  constructor(s = fresh()) {
    this.s = s;
  }
  near(p: { x: number; z: number }, radius = 1) {
    return Math.hypot(this.s.player.x - p.x, this.s.player.z - p.z) < radius;
  }
  capacity() {
    return B.carry + (this.s.upgrades.carry ? 1 : 0);
  }
  move(dx: number, dz: number, dt: number) {
    const p = this.s.player;
    const len = Math.hypot(dx, dz);
    if (!len) return;
    dx /= Math.max(1, len);
    dz /= Math.max(1, len);
    const valid = (x: number, z: number) =>
      x > -6.4 &&
      x < 6.4 &&
      z > -4.2 &&
      z < 4.6 &&
      !obstacles.some(
        (o) => Math.abs(x - o.x) < o.w / 2 + 0.27 && Math.abs(z - o.z) < o.d / 2 + 0.27,
      );
    const x = p.x + dx * B.speed * dt,
      z = p.z + dz * B.speed * dt;
    if (valid(x, p.z)) p.x = x;
    if (valid(p.x, z)) p.z = z;
    p.heading = Math.atan2(dx, dz);
    p.walk += dt * 12;
  }
  complete(batch: number) {
    const s = this.s;
    if (batch !== s.batch || s.tray >= B.trayCapacity || s.wax.filter((x) => x >= 1).length < 64)
      return false;
    s.tray++;
    s.made++;
    s.batch++;
    s.wax.fill(0);
    this.events.push({ type: 'made', ...spots.tray });
    return true;
  }
  buy(key: Upgrade) {
    const s = this.s;
    if (
      s.upgrades[key] ||
      s.coins < B.upgrades[key] ||
      (key === 'runnerCarry' && !s.upgrades.runner)
    )
      return false;
    s.coins -= B.upgrades[key];
    s.upgrades[key] = true;
    this.events.push({ type: 'upgrade', ...spots.expand });
    return true;
  }
  tick(dt: number, bench: boolean) {
    const s = this.s;
    this.transfer -= dt;
    if (!bench && this.transfer <= 0) {
      if (this.near(spots.tray) && s.tray > 0 && s.carried < this.capacity()) {
        s.tray--;
        s.carried++;
        this.transfer = 0.32;
        this.events.push({ type: 'pick', ...spots.tray });
      } else if (this.near(spots.shelf) && s.carried > 0 && s.shelf < B.shelfCapacity) {
        s.carried--;
        s.shelf++;
        this.transfer = 0.32;
        this.events.push({ type: 'drop', ...spots.shelf });
      }
    }
    s.arrival -= dt;
    if (s.arrival <= 0 && s.customers.filter((c) => c.phase !== 'out').length < 4) {
      s.customers.push({
        id: s.serial++,
        x: 5.7,
        z: 4.3,
        heading: 0,
        walk: 0,
        phase: 'in',
        wait: 0,
        service: 0,
        paid: false,
      });
      s.arrival = B.arrivalSeconds;
    }
    let index = 0;
    for (const c of s.customers) {
      if (c.phase === 'out') {
        walk(c, 6.8, 4.3, dt, 2);
        continue;
      }
      const targetX = -2 + index * 1.25;
      index++;
      if (walk(c, targetX, 3.7, dt, 2)) {
        c.phase = 'wait';
        c.heading = Math.PI;
        c.walk = 0;
      }
      c.wait += dt;
      if (index === 1 && c.phase === 'wait' && s.shelf > 0) {
        c.service += dt;
        if (c.service >= B.serviceSeconds) {
          s.shelf--;
          s.coins += B.netPrice;
          s.sold++;
          c.paid = true;
          c.phase = 'out';
          this.events.push({ type: 'sale', x: c.x, z: c.z, amount: B.netPrice });
        }
      }
      if (c.wait > B.patienceSeconds) c.phase = 'out';
    }
    s.customers = s.customers.filter((c) => !(c.phase === 'out' && c.x > 6.6));
    if (s.upgrades.runner) {
      const r = s.runner;
      const target = r.target === 'tray' ? spots.tray : spots.shelf;
      if (walk(r, target.x + 0.8, target.z, dt, 2.2)) {
        if (r.target === 'tray' && s.tray > 0) {
          r.load = Math.min(s.tray, s.upgrades.runnerCarry ? 2 : 1);
          s.tray -= r.load;
          r.target = 'shelf';
          this.events.push({ type: 'pick', ...spots.tray });
        } else if (r.target === 'shelf' && s.shelf < B.shelfCapacity) {
          const n = Math.min(r.load, B.shelfCapacity - s.shelf);
          s.shelf += n;
          r.load -= n;
          if (!r.load) r.target = 'tray';
          this.events.push({ type: 'drop', ...spots.shelf });
        }
      }
    }
    if (s.upgrades.expansion && s.tray < B.trayCapacity) {
      s.production += dt;
      if (s.production >= B.workerSeconds) {
        s.production -= B.workerSeconds;
        s.tray++;
        s.made++;
        this.events.push({ type: 'made', ...spots.expand });
      }
    }
  }
}
function walk(p: Person, x: number, z: number, dt: number, speed: number) {
  const dx = x - p.x,
    dz = z - p.z,
    d = Math.hypot(dx, dz);
  if (d < 0.06) return true;
  const step = Math.min(d, dt * speed);
  p.x += (dx / d) * step;
  p.z += (dz / d) * step;
  p.heading = Math.atan2(dx, dz);
  p.walk += dt * 10;
  return d <= step;
}
