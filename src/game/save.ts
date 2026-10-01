import { fresh, type State } from './simulation.ts';
export const KEY = 'wakppu.please.v1';
export function validate(v: unknown): v is State {
  if (!v || typeof v !== 'object') return false;
  const s = v as State;
  const n = (x: unknown, max: number) =>
    typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= max;
  return (
    s.version === 1 &&
    n(s.coins, 1e8) &&
    n(s.sold, 1e7) &&
    n(s.made, 1e7) &&
    n(s.tray, 8) &&
    n(s.shelf, 6) &&
    n(s.carried, 3) &&
    n(s.batch, 1e8) &&
    s.wax?.length === 80 &&
    s.wax.every((x) => n(x, 1)) &&
    !!s.player &&
    Number.isFinite(s.player.x) &&
    Math.abs(s.player.x) < 7 &&
    Number.isFinite(s.player.z) &&
    Math.abs(s.player.z) < 5 &&
    !!s.upgrades &&
    ['carry', 'runner', 'runnerCarry', 'expansion'].every(
      (k) => typeof s.upgrades[k as keyof State['upgrades']] === 'boolean',
    ) &&
    !!s.settings &&
    typeof s.settings.muted === 'boolean' &&
    typeof s.settings.reduced === 'boolean' &&
    n(s.settings.volume, 1) &&
    ['high', 'low'].includes(s.settings.quality) &&
    !!s.runner &&
    n(s.runner.load, 2) &&
    Number.isFinite(s.runner.x) &&
    Number.isFinite(s.runner.z) &&
    ['tray', 'shelf'].includes(s.runner.target) &&
    n(s.production, 12)
  );
}
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { state: fresh(), recovered: false };
    const s = JSON.parse(raw);
    if (!validate(s)) throw Error('Invalid save');
    s.customers = [];
    s.arrival = 2;
    s.serial = 1;
    return { state: s, recovered: false };
  } catch {
    return { state: fresh(), recovered: true };
  }
}
export function save(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
