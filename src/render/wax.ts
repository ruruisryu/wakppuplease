import * as T from 'three';
import {
  WaxSimulation,
  PRESETS,
  DEFAULT_TOOL,
  canSweepAttached,
} from '../vendor/wakppu/simulation.mjs';
import { B, type Game } from '../game/simulation';
import { type WorkbenchSave, type WaxModelId, type WaxCoating } from '../game/wax-state';
import type { Audio } from '../audio';
import { box } from './world';
import { encodeSurface, decodeSurface } from './wax-surfaces';
import { WaxBatches } from './wax-batches';

export type BenchMode = 'press' | 'rotate' | 'sweep';
// The imported solver runs in its original tabletop coordinates. It shares the
// game's renderer, while this adapter owns loading, controls, saves and inventory.
export class Wax {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(45, 1, 0.1, 50);
  sim: WaxSimulation;
  batches: WaxBatches;
  active = false;
  ready = false;
  done = false;
  pointerId = -1;
  batch = 0;
  mode: BenchMode = 'press';
  coating: WaxCoating = 'classic';
  wide = false;
  model: WaxModelId = 'Butter';
  error = '';
  finish = -1;
  dirty = false;
  revision = 0;
  private held = false;
  private gestureMode: BenchMode = 'press';
  private last: { x: number; y: number } | null = null;
  private sweepPoint: T.Vector3 | null = null;
  private ray = new T.Raycaster();
  private pointer = new T.Vector2();
  private cache = new Map<WaxModelId, Promise<unknown>>();
  constructor(
    renderer: T.WebGLRenderer,
    private game: Game,
    private audio: Audio,
  ) {
    this.scene.background = new T.Color('#b1d4c5');
    this.scene.add(new T.HemisphereLight(0xfffbee, 0x9f948d, 1.65));
    const key = new T.DirectionalLight(0xfff9ec, 2.8);
    key.position.set(-3, 7, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, {
      left: -5,
      right: 5,
      top: 5,
      bottom: -5,
      near: 0.5,
      far: 18,
    });
    key.shadow.normalBias = 0.015;
    key.shadow.bias = -0.00015;
    const fill = new T.DirectionalLight(0xf0f7ff, 1.2);
    fill.position.set(5, 3, -2);
    this.scene.add(
      key,
      fill,
      box(8, 0.35, 6, 0xfff3dd, 0, -0.2, 0),
      box(8.15, 0.25, 6.15, 0x5ba38f, 0, -0.48, 0),
    );
    // Broad reflection panels match the original solid workbench presentation.
    const room = new T.Scene();
    room.background = new T.Color(0xb4b9ae);
    for (const [pos, size] of [
      [
        [-4, 4, 0],
        [1, 5, 7],
      ],
      [
        [4, 3, 2],
        [1, 4, 4],
      ],
      [
        [0, 6, 0],
        [6, 1, 6],
      ],
    ] as [number[], number[]][]) {
      const panel = new T.Mesh(
        new T.BoxGeometry(...(size as [number, number, number])),
        new T.MeshBasicMaterial({ color: 0xffffff }),
      );
      panel.position.fromArray(pos);
      room.add(panel);
    }
    const pmrem = new T.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environmentIntensity = 0.32;
    room.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
    pmrem.dispose();
    this.sim = new WaxSimulation(this.scene, this.audio.crack);
    this.batches = new WaxBatches(this.scene, this.sim);
    this.sim.onchange = () => {
      this.dirty = true;
    };
    void this.prepare('Butter').catch(() => undefined);
  }
  get down() {
    return this.held;
  }
  set down(value: boolean) {
    this.held = value;
    if (!value) {
      this.sim.endPress();
      this.audio.crack.endSweep(true);
      this.last = null;
      this.sweepPoint = null;
    }
  }
  private async prepare(id: WaxModelId) {
    if (!this.cache.has(id))
      this.cache.set(
        id,
        fetch(`${import.meta.env.BASE_URL}assets/models/${id}.json`)
          .then(async (r) => {
            if (!r.ok) throw Error(`Model HTTP ${r.status}`);
            return r.json();
          })
          .catch((e) => {
            this.cache.delete(id);
            throw e;
          }),
      );
    const data = await this.cache.get(id)!;
    this.sim.addModel(data);
    return data;
  }
  async enter() {
    this.down = false;
    this.pointerId = -1;
    this.active = true;
    this.done = false;
    this.ready = false;
    this.error = '';
    this.finish = -1;
    this.batch = this.game.s.batch;
    const revision = ++this.revision;
    const saved = this.game.s.workbench;
    if (saved) {
      this.model = saved.model;
      this.coating = saved.coating;
      this.wide = saved.wide;
    }
    try {
      await this.prepare(this.model);
      if (!this.active || revision !== this.revision) return;
      this.sim.select(this.model);
      this.configure();
      this.sim.reset();
      if (saved) {
        try {
          this.restore(saved);
        } catch {
          this.game.s.workbench = null;
          this.game.s.waxWork = 0;
          this.sim.reset();
        }
      }
      this.ready = true;
      this.batches.sync();
      this.dirty = true;
      this.frameCamera();
    } catch (e) {
      if (revision !== this.revision) return;
      console.error(e);
      this.error = '말랑이를 불러오지 못했어요. 다시 준비를 눌러 주세요.';
    }
  }
  leave() {
    this.capture();
    this.down = false;
    this.pointerId = -1;
    this.active = false;
    this.ready = false;
    ++this.revision;
    this.audio.crack.stopAll();
  }
  configure() {
    this.sim.setSettings({ ...PRESETS[this.coating] });
    this.sim.tool = this.wide
      ? { reach: 1.2, operations: 5, detachReach: 1.02, depth: 1.25 }
      : { ...DEFAULT_TOOL };
    this.dirty = true;
  }
  setMode(mode: BenchMode) {
    this.down = false;
    this.pointerId = -1;
    this.mode = mode;
  }
  async changeModel(id: WaxModelId) {
    if (this.game.s.waxWork > 0 && !this.done) return false;
    this.game.s.workbench = null;
    this.model = id;
    await this.enter();
    return true;
  }
  private frameCamera() {
    const m = this.sim.current;
    const target = new T.Vector3(0, m ? m.height * 0.39 : 1, 0);
    const aspect = innerWidth / innerHeight;
    const d = aspect < 0.85 ? 1.45 : 1.05;
    this.camera.aspect = aspect;
    this.camera.position.set(4.5 * d, 4.5 * d + target.y, 6.6 * d);
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }
  begin(e: PointerEvent) {
    if (!this.active || !this.ready) return;
    this.down = false;
    this.held = true;
    this.gestureMode = e.button === 2 || e.shiftKey || e.altKey ? 'rotate' : this.mode;
    this.aim(e.clientX, e.clientY);
  }
  aim(x: number, y: number) {
    if (!this.ready || !this.down) return;
    this.pointer.set((x / innerWidth) * 2 - 1, 1 - (y / innerHeight) * 2);
    this.ray.setFromCamera(this.pointer, this.camera);
    const pick = this.sim.pick(this.ray);
    const last = this.last;
    this.last = { x, y };
    if (this.gestureMode === 'rotate') {
      if (last) {
        this.sim.rotate((x - last.x) * 0.009, (y - last.y) * 0.007);
        this.dirty = true;
      }
      return;
    }
    if (this.gestureMode === 'press') {
      if (this.sim.gesture) this.sim.movePress(pick);
      else this.sim.beginPress(pick);
      return;
    }
    const ground = this.ray.ray.intersectPlane(
      new T.Plane(new T.Vector3(0, 1, 0), 0),
      new T.Vector3(),
    );
    if (!last) this.audio.crack.beginSweep();
    if (ground && this.sweepPoint)
      this.sim.sweep(ground, ground.x - this.sweepPoint.x, ground.z - this.sweepPoint.z, pick);
    this.sweepPoint = ground;
  }
  pressCenter() {
    if (!this.ready) return;
    this.down = false;
    this.held = true;
    this.gestureMode = 'press';
    this.aim(innerWidth / 2, innerHeight * 0.45);
  }
  rotate(dx: number, dy: number) {
    if (!this.ready) return;
    this.down = false;
    this.sim.rotate(dx, dy);
    this.dirty = true;
  }
  clear() {
    this.down = false;
    const count = this.sim.clear();
    this.dirty = true;
    return count;
  }
  tick(dt: number) {
    if (!this.active || !this.ready) return;
    this.frameCamera();
    this.sim.update(dt);
    this.audio.crack.update();
    if (!this.done) {
      const p = this.sim.progress();
      this.game.s.waxWork = Math.min(1, 0.35 * p.cracked + 0.65 * p.removed);
      if (this.game.s.waxWork >= 0.6 && !this.down) {
        if (this.finish < 0) {
          this.finish = 0.65;
          for (const p of [...this.sim.current!.pieces]) if (!p.detached) this.sim.detach(p, false);
        }
        this.finish -= dt;
        if (this.finish <= 0 && this.game.complete(this.batch)) {
          this.done = true;
          this.dirty = false;
          this.audio.play('made');
        }
      }
    }
  }
  render(renderer: T.WebGLRenderer) {
    this.batches.sync();
    const tone = renderer.toneMapping,
      exposure = renderer.toneMappingExposure;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.render(this.scene, this.camera);
    renderer.toneMapping = tone;
    renderer.toneMappingExposure = exposure;
  }
  progress() {
    return this.done ? 100 : Math.min(100, Math.round((this.game.s.waxWork / 0.6) * 100));
  }
  capture() {
    if (!this.ready || this.done || this.batch !== this.game.s.batch || !this.dirty) return;
    const m = this.sim.current!;
    this.game.s.workbench = {
      engine: 'clicker-v0.9.0',
      encoding: 'indexed-f32-v1',
      model: this.model,
      coating: this.coating,
      wide: this.wide,
      serial: this.sim.serial,
      removedArea: m.removedArea,
      crackedArea: m.crackedArea,
      fractures: m.fractures,
      rebreaks: m.rebreaks,
      quaternion: m.group.quaternion.toArray() as WorkbenchSave['quaternion'],
      position: m.group.position.toArray() as WorkbenchSave['position'],
      plates: m.pieces
        .filter((p) => !p.detached && p.alive)
        .map((p) => ({
          vertices: encodeSurface(p.surface),
          generation: p.generation,
          damaged: p.damaged,
          offset: p.offset.toArray(),
        })),
    };
    this.dirty = false;
  }
  private restore(s: WorkbenchSave) {
    const m = this.sim.current!;
    const surfaces = s.plates.map((p) => decodeSurface(p.vertices));
    const restored = s.plates.map((p, index) => {
      const piece = this.sim.createPiece(surfaces[index], p.generation, 0);
      piece.damaged = p.damaged;
      piece.offset.fromArray(p.offset);
      piece.mesh.position.copy(piece.centre).add(piece.offset);
      return piece;
    });
    for (const p of m.pieces) {
      p.mesh.removeFromParent();
      p.mesh.geometry.dispose();
    }
    m.pieces = restored;
    for (const p of restored) m.group.add(p.mesh);
    m.removedArea = s.removedArea;
    m.crackedArea = s.crackedArea;
    m.fractures = s.fractures;
    m.rebreaks = s.rebreaks;
    m.group.quaternion.fromArray(s.quaternion);
    m.group.position.fromArray(s.position);
    this.sim.serial = s.serial;
    m.pressure = 0;
    m.lastDeformation = -1;
    this.sim.deform(m);
  }
  targets() {
    const m = this.sim.current;
    if (!this.ready || !m) return [];
    this.scene.updateMatrixWorld(true);
    const ray = new T.Raycaster();
    return m.pieces
      .filter((p) => p.alive && !p.detached && p.area > 0.005)
      .map((p) => {
        const pos = new T.Vector3();
        p.mesh.getWorldPosition(pos);
        pos.addScaledVector(p.normal.clone().transformDirection(p.mesh.matrixWorld), 0.006);
        pos.project(this.camera);
        if (Math.abs(pos.x) > 0.9 || Math.abs(pos.y) > 0.7) return null;
        ray.setFromCamera(new T.Vector2(pos.x, pos.y), this.camera);
        const hit = this.sim.pick(ray);
        return hit?.piece === p
          ? {
              x: ((pos.x + 1) * innerWidth) / 2,
              y: ((1 - pos.y) * innerHeight) / 2,
              area: p.area,
              sweepable: canSweepAttached(p),
            }
          : null;
      })
      .filter((p): p is { x: number; y: number; area: number; sweepable: boolean } => !!p)
      .sort((a, b) => b.area - a.area);
  }
  stats() {
    return {
      ...this.sim.stats(),
      engine: 'clicker-v0.9.0',
      ready: this.ready,
      mode: this.mode,
      coating: this.coating,
      wide: this.wide,
      audio: {
        loaded: this.audio.crack.loaded,
        events: this.audio.crack.events,
        kinds: this.audio.crack.eventKinds,
      },
    };
  }
}
