import { fresh, type State } from './simulation.ts';
import { validWorkbench } from './wax-state.ts';
export const KEY = 'wakppu.please.v1';
export function validate(v: unknown): v is State {
  if (!v || typeof v !== 'object') return false;
  const s = v as State;
  const n = (x: unknown, max: number) =>
    typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= max;
  return (
    s.version === 2 &&
    n(s.coins, 1e8) &&
    n(s.sold, 1e7) &&
    n(s.made, 1e7) &&
    n(s.tray, 8) &&
    n(s.shelf, 6) &&
    n(s.carried, 3) &&
    n(s.batch, 1e8) &&
    n(s.waxWork, 1) &&
    (s.workbench === null || validWorkbench(s.workbench)) &&
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
    let s = JSON.parse(raw);
    let migrated = false;
    if (
      s?.version === 1 &&
      Array.isArray(s.wax) &&
      s.wax.length === 80 &&
      s.wax.every((n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)
    ) {
      const { wax: legacyWax, ...prior } = s;
      s = { ...prior, version: 2, waxWork: 0, workbench: null };
      migrated = legacyWax.some((n: number) => n > 0);
    }
    if (!validate(s)) throw Error('Invalid save');
    s.customers = [];
    s.arrival = 2;
    s.serial = 1;
    return { state: s, recovered: false, migrated };
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
