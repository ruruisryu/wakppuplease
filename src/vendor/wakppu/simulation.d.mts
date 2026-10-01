// Types for the ported Wax Studio simulation (plain JS module).
import type * as THREE from 'three';
export interface Tool { reach: number; operations: number; detachReach: number; depth: number }
export interface FeelSettings { brittleness: number; thickness: number; softness: number; adhesion: number }
export const DEFAULT_TOOL: Tool;
export const PRESETS: { soft: FeelSettings; classic: FeelSettings; hard: FeelSettings };
export const SWEEP_LIMITS: { maxArea: number; maxDiameter: number };
export function canSweepAttached(piece: unknown): boolean;
export interface Pick { hit: THREE.Intersection; piece: any; local: THREE.Vector3; inward: THREE.Vector3 }
export interface WaxModel { id: string; group: THREE.Group; height: number; pieces: any[]; cores: any[]; originals: any[]; totalArea: number; coreSize: THREE.Vector3; removedArea: number; crackedArea: number; fractures: number; rebreaks: number; pressure: number; lastDeformation: number; cleared: number }
export class WaxSimulation {
  constructor(scene: THREE.Scene, audio: object);
  models: Map<string, WaxModel>;
  current: WaxModel | null;
  settings: FeelSettings;
  tool: Tool;
  wax: THREE.Material;
  inside: THREE.Material;
  gesture: { serial: number; pressure: number } | null;
  onchange: () => void;
  onfracture: () => void;
  addModel(data: unknown): WaxModel;
  select(id: string): WaxModel;
  pick(raycaster: THREE.Raycaster): Pick | null;
  beginPress(pick: Pick | null | { piece: any; local: THREE.Vector3; inward: THREE.Vector3 }): boolean;
  movePress(pick: Pick | null): void;
  endPress(): void;
  update(dt: number): void;
  rotate(dx: number, dy: number): void;
  clear(): number;
  sweep(world: THREE.Vector3, dx: number, dz: number, pick?: Pick | null): void;
  reset(): void;
  setSettings(settings: Partial<FeelSettings>): void;
  prune(target: number): number;
  progress(): { cracked: number; removed: number };
  stats(): { id: string | null; fractures?: number; rebreaks?: number; peeled?: number; pieces?: number; loose?: number; cleared?: number; pressure?: number; gesture?: number };
  serial: number;
  createPiece(surface: number[][][], generation: number, born: number): any;
  deform(model: WaxModel): void;
  detach(piece: any, playSound?: boolean): void;
}
