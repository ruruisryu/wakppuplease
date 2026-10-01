import * as T from 'three';
import type { WaxModel, WaxSimulation } from '../vendor/wakppu/simulation.mjs';
type Entry = {
  geometry: T.BufferGeometry;
  outer: number;
  inner: number;
  outerInstance: number;
  innerInstance: number;
  outerCount: number;
  innerCount: number;
};
// Render the original solver meshes through two GPU batches. The original meshes
// retain their geometry and transforms for picking, deformation and physics.
export class WaxBatches {
  private model: WaxModel | null = null;
  private outer?: T.BatchedMesh;
  private inner?: T.BatchedMesh;
  private entries = new Map<T.Mesh, Entry>();
  private outerUsed = 0;
  private innerUsed = 0;
  private outerCapacity = 0;
  private innerCapacity = 0;
  constructor(
    private scene: T.Scene,
    private sim: WaxSimulation,
  ) {}
  sync() {
    const m = this.sim.current;
    if (!m) return;
    if (this.model !== m) {
      this.dispose();
      this.model = m;
      this.outerCapacity = Math.max(
        16384,
        m.pieces.reduce((sum, p) => sum + p.mesh.geometry.groups[0].count, 0) * 3,
      );
      this.innerCapacity = Math.max(
        32768,
        m.pieces.reduce((sum, p) => sum + p.mesh.geometry.groups[1].count, 0) * 3,
      );
      this.outer = new T.BatchedMesh(320, this.outerCapacity, 0, this.sim.wax);
      this.inner = new T.BatchedMesh(320, this.innerCapacity, 0, this.sim.inside);
      for (const batch of [this.outer, this.inner]) {
        batch.frustumCulled = false;
        batch.perObjectFrustumCulled = false;
        batch.sortObjects = false;
        batch.castShadow = true;
        batch.receiveShadow = true;
        this.scene.add(batch);
      }
    }
    const meshes = new Set<T.Mesh>(m.pieces.filter((p) => p.alive).map((p) => p.mesh));
    for (const [mesh, entry] of this.entries) {
      if (!meshes.has(mesh) || mesh.geometry !== entry.geometry) {
        this.outer!.deleteGeometry(entry.outer);
        this.inner!.deleteGeometry(entry.inner);
        this.entries.delete(mesh);
      }
    }
    this.scene.updateMatrixWorld(true);
    for (const mesh of meshes) {
      let entry = this.entries.get(mesh);
      if (!entry) {
        const [a, b] = mesh.geometry.groups;
        if (
          this.outerUsed + a.count > this.outerCapacity ||
          this.innerUsed + b.count > this.innerCapacity
        ) {
          this.outer!.optimize();
          this.inner!.optimize();
          this.outerUsed = 0;
          this.innerUsed = 0;
          for (const v of this.entries.values()) {
            this.outerUsed += v.outerCount;
            this.innerUsed += v.innerCount;
          }
        }
        if (this.outerUsed + a.count > this.outerCapacity) {
          this.outerCapacity = Math.max(this.outerCapacity * 2, this.outerUsed + a.count);
          this.outer!.setGeometrySize(this.outerCapacity, 0);
        }
        if (this.innerUsed + b.count > this.innerCapacity) {
          this.innerCapacity = Math.max(this.innerCapacity * 2, this.innerUsed + b.count);
          this.inner!.setGeometrySize(this.innerCapacity, 0);
        }
        const outerGeo = range(mesh.geometry, a.start, a.count),
          innerGeo = range(mesh.geometry, b.start, b.count);
        const outer = this.outer!.addGeometry(outerGeo),
          inner = this.inner!.addGeometry(innerGeo);
        entry = {
          geometry: mesh.geometry,
          outer,
          inner,
          outerInstance: this.outer!.addInstance(outer),
          innerInstance: this.inner!.addInstance(inner),
          outerCount: a.count,
          innerCount: b.count,
        };
        outerGeo.dispose();
        innerGeo.dispose();
        this.outerUsed += a.count;
        this.innerUsed += b.count;
        this.entries.set(mesh, entry);
      }
      mesh.visible = false;
      this.outer!.setMatrixAt(entry.outerInstance, mesh.matrixWorld);
      this.inner!.setMatrixAt(entry.innerInstance, mesh.matrixWorld);
    }
  }
  dispose() {
    for (const b of [this.outer, this.inner])
      if (b) {
        b.removeFromParent();
        b.dispose();
      }
    this.outer = undefined;
    this.inner = undefined;
    this.entries.clear();
    this.outerUsed = 0;
    this.innerUsed = 0;
    this.model = null;
  }
}
function range(geometry: T.BufferGeometry, start: number, count: number) {
  const part = new T.BufferGeometry();
  for (const name of ['position', 'normal']) {
    const a = geometry.getAttribute(name) as T.BufferAttribute;
    part.setAttribute(
      name,
      new T.BufferAttribute((a.array as Float32Array).subarray(start * 3, (start + count) * 3), 3),
    );
  }
  return part;
}
