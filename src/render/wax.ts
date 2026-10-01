import * as T from 'three';
import { material, ball } from './world';
import type { Game } from '../game/simulation';
import type { Audio } from '../audio';
export class Wax {
  group = new T.Group();
  core: T.Mesh;
  pieces: T.Mesh[] = [];
  rest: Float32Array;
  point = new T.Vector3();
  ray = new T.Raycaster();
  pointer = new T.Vector2();
  active = false;
  down = false;
  pointerId = -1;
  done = false;
  batch = 0;
  finish = -1;
  hard = false;
  wide = false;
  rotation = 0;
  hit = false;
  pressure = 0;
  shards: { mesh: T.Mesh; v: T.Vector3; age: number }[] = [];
  constructor(
    private scene: T.Scene,
    private game: Game,
    private audio: Audio,
  ) {
    this.group.position.set(-3.7, 1.9, -2.9);
    this.scene.add(this.group);
    const geometry = new T.SphereGeometry(0.88, 40, 28);
    geometry.scale(1, 0.85, 0.85);
    this.core = new T.Mesh(
      geometry,
      new T.MeshPhysicalMaterial({ color: 0xef95b1, roughness: 0.36, clearcoat: 0.45 }),
    );
    this.rest = new Float32Array(geometry.attributes.position.array);
    this.group.add(this.core);
    this.group.add(ball(0.19, 0xef95b1, -0.43, 0.51, 0), ball(0.19, 0xef95b1, 0.43, 0.51, 0));
    for (const x of [-0.27, 0.27]) {
      this.group.add(ball(0.075, 0x325b52, x, 0.05, 0.69));
    }
    this.group.add(ball(0.07, 0xf6c5c6, 0, -0.13, 0.74));
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 10; col++) {
        const geo = new T.SphereGeometry(
          0.97,
          4,
          3,
          (col * Math.PI) / 5,
          Math.PI / 5,
          (row * Math.PI) / 8,
          Math.PI / 8,
        );
        geo.scale(1, 0.85, 0.85);
        const m = new T.Mesh(geo, material((row + col) % 3 === 0 ? 0xf6ce75 : 0xf8d891));
        m.userData.index = this.pieces.length;
        m.castShadow = true;
        this.pieces.push(m);
        this.group.add(m);
      }
    this.group.visible = false;
  }
  enter() {
    this.active = true;
    this.done = false;
    this.batch = this.game.s.batch;
    this.finish = -1;
    this.group.visible = true;
    this.rotation = 0;
    this.clearShards();
    this.pieces.forEach((p, i) => {
      p.position.set(0, 0, 0);
      p.rotation.set(0, 0, 0);
      p.scale.setScalar(1);
      this.group.add(p);
      p.visible = this.game.s.wax[i] < 1;
    });
  }
  leave() {
    this.active = false;
    this.down = false;
    this.pointerId = -1;
    this.group.visible = false;
    this.clearShards();
  }
  clearShards() {
    for (const s of this.shards) {
      s.mesh.visible = false;
      this.group.add(s.mesh);
    }
    this.shards = [];
  }
  aim(x: number, y: number, camera: T.Camera) {
    this.pointer.set((x / innerWidth) * 2 - 1, 1 - (y / innerHeight) * 2);
    this.ray.setFromCamera(this.pointer, camera);
    this.group.updateMatrixWorld(true);
    const hits = this.ray.intersectObjects(
      [this.core, ...this.pieces.filter((p) => p.visible && p.parent === this.group)],
      false,
    );
    this.hit = !!hits.length;
    if (this.hit) this.point.copy(this.group.worldToLocal(hits[0].point.clone()));
  }
  detach(i: number) {
    const p = this.pieces[i];
    if (!p.visible || p.parent !== this.group) return;
    const center = new T.Vector3();
    p.geometry.computeBoundingBox();
    p.geometry.boundingBox!.getCenter(center);
    const direction = center.clone().normalize();
    p.position.copy(direction).multiplyScalar(0.07);
    this.shards.push({
      mesh: p,
      v: direction.multiplyScalar(1.5).add(new T.Vector3(0, 1.1, 0)),
      age: 0,
    });
    this.audio.play('crack');
  }
  tick(dt: number) {
    if (!this.active) return;
    if (this.done) this.rotation = T.MathUtils.damp(this.rotation, 0, 8, dt);
    this.group.rotation.set(this.rotation * 0.55, this.rotation, 0);
    const s = this.game.s;
    this.pressure = T.MathUtils.damp(this.pressure, this.down && this.hit ? 1 : 0, 12, dt);
    if (this.down && this.hit && !this.done) {
      const reach = this.wide ? 0.95 : 0.74;
      this.pieces.forEach((p, i) => {
        if (s.wax[i] >= 1) return;
        const center = new T.Vector3();
        p.geometry.boundingBox ?? p.geometry.computeBoundingBox();
        p.geometry.boundingBox!.getCenter(center);
        const distance = center.distanceTo(this.point);
        if (distance < reach) {
          s.wax[i] = Math.min(
            1,
            s.wax[i] + dt * (this.hard ? 1.6 : 3.6) * (1 - (distance / reach) * 0.6),
          );
          p.scale.setScalar(s.wax[i] > 0.35 ? 0.974 : 1);
          if (s.wax[i] >= 1) this.detach(i);
        }
      });
    }
    const pos = this.core.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = this.rest[i * 3],
        y = this.rest[i * 3 + 1],
        z = this.rest[i * 3 + 2];
      const d = Math.hypot(x - this.point.x, y - this.point.y, z - this.point.z);
      const dent = Math.max(0, 1 - d / 0.7) * 0.19 * this.pressure;
      pos.setXYZ(i, x * (1 - dent), y * (1 - dent), z * (1 - dent));
    }
    pos.needsUpdate = true;
    this.core.geometry.computeVertexNormals();
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const p = this.shards[i];
      p.age += dt;
      p.v.y -= dt * 5;
      p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.rotation.x += dt * 1.5;
      p.mesh.rotation.z += dt;
      if (p.mesh.position.y < -0.8) {
        p.mesh.position.y = -0.8;
        p.v.set(0, 0, 0);
      }
      if (p.age > 1.6) {
        p.mesh.visible = false;
        this.shards.splice(i, 1);
      }
    }
    if (!this.done && !this.down && s.wax.filter((x) => x >= 1).length >= 64) {
      if (this.finish < 0) {
        this.finish = 0.65;
        this.pieces.forEach((_, i) => {
          if (s.wax[i] < 1) {
            this.detach(i);
            s.wax[i] = 1;
          }
        });
      }
      this.finish -= dt;
      if (this.finish <= 0 && this.game.complete(this.batch)) {
        this.done = true;
        this.audio.play('made');
      }
    }
  }
  progress() {
    return this.done
      ? 100
      : Math.min(100, Math.round((this.game.s.wax.filter((x) => x >= 1).length / 64) * 100));
  }
}
