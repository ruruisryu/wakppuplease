export const WAX_MODELS = [
  'Butter',
  'Chocolate',
  'Corn',
  'CrunchMango',
  'JumboCheese',
  'Peach',
] as const;
export type WaxModelId = (typeof WAX_MODELS)[number];
export type WaxCoating = 'soft' | 'classic' | 'hard';
export type SavedPlate = {
  vertices: string;
  generation: number;
  damaged: boolean;
  offset: [number, number, number];
};
export type WorkbenchSave = {
  engine: 'clicker-v0.9.0';
  encoding: 'indexed-f32-v1';
  model: WaxModelId;
  coating: WaxCoating;
  wide: boolean;
  serial: number;
  removedArea: number;
  crackedArea: number;
  fractures: number;
  rebreaks: number;
  quaternion: [number, number, number, number];
  position: [number, number, number];
  plates: SavedPlate[];
};
const finiteVector = (v: unknown, size: number) =>
  Array.isArray(v) && v.length === size && v.every((n) => Number.isFinite(n) && Math.abs(n) < 100);
export function validWorkbench(v: unknown): v is WorkbenchSave {
  if (!v || typeof v !== 'object') return false;
  const s = v as WorkbenchSave;
  const n = (v: number) => Number.isFinite(v) && v >= 0 && v < 1e7;
  return (
    s.engine === 'clicker-v0.9.0' &&
    s.encoding === 'indexed-f32-v1' &&
    WAX_MODELS.includes(s.model) &&
    ['soft', 'classic', 'hard'].includes(s.coating) &&
    typeof s.wide === 'boolean' &&
    n(s.serial) &&
    n(s.removedArea) &&
    n(s.crackedArea) &&
    n(s.fractures) &&
    n(s.rebreaks) &&
    finiteVector(s.quaternion, 4) &&
    finiteVector(s.position, 3) &&
    Array.isArray(s.plates) &&
    s.plates.length <= 320 &&
    s.plates.every(
      (p) =>
        Number.isInteger(p.generation) &&
        p.generation >= 0 &&
        p.generation <= 4 &&
        typeof p.damaged === 'boolean' &&
        finiteVector(p.offset, 3) &&
        typeof p.vertices === 'string' &&
        p.vertices.length > 0 &&
        p.vertices.length <= 4e6 &&
        p.vertices.length % 4 === 0 &&
        /^[A-Za-z0-9+/]+={0,2}$/.test(p.vertices),
    ) &&
    s.plates.reduce((sum, p) => sum + p.vertices.length, 0) <= 8e6
  );
}
