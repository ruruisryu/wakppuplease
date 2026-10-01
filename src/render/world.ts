import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Game, Person } from '../game/simulation';
const palette = {
  cream: 0xfff4dc,
  mint: 0x63baa3,
  green: 0x267b6d,
  ink: 0x264c4b,
  pink: 0xf28fa6,
  yellow: 0xf4c75c,
};
const mats = new Map<number, T.MeshStandardMaterial>();
export function material(color: number) {
  let m = mats.get(color);
  if (!m) {
    m = new T.MeshStandardMaterial({ color, roughness: 0.65 });
    mats.set(color, m);
  }
  return m;
}
export function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(
    new RoundedBoxGeometry(w, h, d, 2, Math.min(0.12, h / 3, w / 3, d / 3)),
    material(color),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
export function ball(r: number, color: number, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(new T.SphereGeometry(r, 16, 12), material(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
export function label(text: string, width = 2, color = '#315b54', background = '#fff7e7') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.roundRect(4, 4, 504, 120, 28);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = '48px Jua, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const texture = new T.CanvasTexture(c);
  texture.colorSpace = T.SRGBColorSpace;
  const s = new T.Sprite(new T.SpriteMaterial({ map: texture, depthTest: false }));
  s.scale.set(width, width / 4, 1);
  s.renderOrder = 3;
  return s;
}
export function toy(color = palette.pink) {
  const g = new T.Group();
  const b = ball(0.29, color, 0, 0.24, 0);
  b.scale.set(1, 0.85, 0.83);
  g.add(b);
  g.add(ball(0.1, color, -0.17, 0.45, 0), ball(0.1, color, 0.17, 0.45, 0));
  g.add(ball(0.035, palette.ink, -0.09, 0.27, 0.225), ball(0.035, palette.ink, 0.09, 0.27, 0.225));
  return g;
}
function person(color: number, hat = false) {
  const g = new T.Group();
  g.add(box(0.46, 0.64, 0.35, color, 0, 0.77, 0), ball(0.28, 0xffd4ab, 0, 1.3, 0));
  g.add(box(0.35, 0.32, 0.045, 0xfff3d6, 0, 0.71, 0.19));
  g.add(ball(0.03, palette.ink, -0.09, 1.32, 0.255), ball(0.03, palette.ink, 0.09, 1.32, 0.255));
  const legs = [
    box(0.18, 0.34, 0.24, 0x385b62, -0.13, 0.25, 0),
    box(0.18, 0.34, 0.24, 0x385b62, 0.13, 0.25, 0),
  ];
  const arms = [
    box(0.15, 0.4, 0.16, color, -0.31, 0.8, 0),
    box(0.15, 0.4, 0.16, color, 0.31, 0.8, 0),
  ];
  g.add(...legs, ...arms);
  if (hat) {
    g.add(box(0.64, 0.13, 0.53, color, 0, 1.55, 0), ball(0.27, color, 0, 1.57, -0.04));
  } else {
    const hair = ball(0.29, 0x78594f, 0, 1.4, -0.035);
    hair.scale.y = 0.64;
    g.add(hair);
  }
  const cargo = new T.Group();
  cargo.position.set(0, 1.75, 0);
  for (let i = 0; i < 3; i++) {
    const t = toy();
    t.position.y = i * 0.4;
    cargo.add(t);
  }
  g.add(cargo);
  g.userData = { legs, arms, cargo };
  return g;
}
function animatePerson(g: T.Group, p: Person, load = 0, reduced = false) {
  g.position.set(p.x, 0, p.z);
  g.rotation.y = p.heading;
  const swing = reduced ? 0 : Math.sin(p.walk) * 0.45;
  g.userData.legs[0].rotation.x = swing;
  g.userData.legs[1].rotation.x = -swing;
  g.userData.arms[0].rotation.x = load ? -0.8 : -swing;
  g.userData.arms[1].rotation.x = load ? -0.8 : swing;
  g.userData.cargo.children.forEach((c: T.Object3D, i: number) => (c.visible = i < load));
}
export class World {
  scene = new T.Scene();
  camera = new T.OrthographicCamera();
  renderer: T.WebGLRenderer;
  root = new T.Group();
  player = person(palette.green, true);
  runner = person(0xf0af50, true);
  worker = person(0x9184c5, true);
  customers = new Map<number, T.Group>();
  tray: T.Group[] = [];
  shelf: T.Group[] = [];
  expansion = new T.Group();
  locked = new T.Group();
  labels: { sprite: T.Sprite; text: string }[] = [];
  benchTarget = new T.Vector3(-3.7, 1.9, -2.9);
  target = new T.Vector3(0, 0, 0);
  view = 15;
  mode = 0;
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.setClearColor(0xaed4c4);
    this.scene.add(new T.HemisphereLight(0xfff8e6, 0x7eaaa3, 2.5));
    const sun = new T.DirectionalLight(0xfff6dc, 3);
    sun.position.set(-7, 16, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    sun.shadow.normalBias = 0.035;
    sun.shadow.bias = -0.0002;
    this.scene.add(sun);
    this.scene.add(this.root);
    const r = this.root;
    r.add(box(16, 0.6, 12, 0x659e8b, 0, -0.6, 0), box(14, 0.25, 10.2, palette.cream, 0, -0.18, 0));
    for (let parity = 0; parity < 2; parity++) {
      const tiles = new T.InstancedMesh(
        new T.BoxGeometry(0.985, 0.025, 0.985),
        material(parity ? 0xeee7d2 : 0xf6eedb),
        parity ? 58 : 59,
      );
      const matrix = new T.Matrix4();
      let index = 0;
      for (let x = -6; x <= 6; x++)
        for (let z = -4; z <= 4; z++)
          if (Math.abs((x + z) % 2) === parity) {
            matrix.makeTranslation(x, -0.035, z);
            tiles.setMatrixAt(index++, matrix);
          }
      tiles.receiveShadow = true;
      r.add(tiles);
    }
    r.add(box(14, 0.8, 0.25, 0x90bcb0, 0, 0.35, -5), box(0.25, 0.65, 10, 0x90bcb0, -7, 0.27, 0));
    r.add(box(13.8, 0.12, 0.4, 0x478c7e, 0, 0.82, -5));
    const sign = label('WAKPPU!   말랑 공방', 5.7, '#fff8db', '#337e70');
    sign.position.set(0, 3.1, -4.7);
    r.add(sign);
    const sub = label('CRACK · CARRY · HAPPY', 3, '#577e70', '#f6efdc');
    sub.position.set(0, 2.45, -4.7);
    r.add(sub);
    this.table(-3.7, -2.9, palette.mint);
    r.add(box(2.3, 0.07, 1.2, 0xe7f7e8, -3.7, 1.24, -2.9));
    const raw = toy(palette.yellow);
    raw.scale.setScalar(1.3);
    raw.position.set(-3.7, 1.25, -2.9);
    raw.name = 'benchSample';
    r.add(raw);
    this.table(-0.5, -2.7, 0xe2b27c, 1.8, 1.3);
    r.add(box(1.7, 0.07, 1.2, 0xffefc6, -0.5, 1.24, -2.7));
    this.table(-1, 2.55, palette.green, 4.4, 1.25);
    r.add(box(4.5, 0.16, 1.4, palette.cream, -1, 1.28, 2.55));
    r.add(
      box(0.6, 0.4, 0.45, palette.ink, 0.65, 1.56, 2.6),
      box(0.47, 0.25, 0.05, 0xa8e0c9, 0.65, 1.64, 2.85),
    );
    for (let i = 0; i < 8; i++) {
      const t = toy();
      t.scale.setScalar(0.7);
      t.position.set(-1.1 + (i % 4) * 0.4, 1.3, -3 + Math.floor(i / 4) * 0.5);
      r.add(t);
      this.tray.push(t);
    }
    for (let i = 0; i < 6; i++) {
      const t = toy();
      t.position.set(-2.7 + (i % 3) * 0.7, 1.38, 2.2 + Math.floor(i / 3) * 0.55);
      r.add(t);
      this.shelf.push(t);
    }
    this.floorMarker(-3.7, -1.25, 0x61b79e);
    this.floorMarker(-0.5, -1.2, 0xedbd66);
    this.floorMarker(-1, 0.45, 0xf59eb1);
    this.floorMarker(4, -1.4, 0xb8a9d2);
    for (const [text, x, y, z] of [
      ['01  개봉 작업대', -3.7, 2.1, -3.1],
      ['완성 트레이', -0.5, 2.05, -2.7],
      ['02  말랑이 전달', -1, 2.12, 2.6],
    ] as [string, number, number, number][]) {
      const l = label(text, 2);
      l.position.set(x, y, z);
      r.add(l);
    }
    this.locked.add(box(2.8, 0.04, 2, 0xc2c9bf, 4, 0.03, -2.8));
    const lock = label('새 작업실  ·  90', 2.6, '#666987', '#f0eaf6');
    lock.position.set(4, 1.1, -2.8);
    this.locked.add(lock);
    r.add(this.locked, this.expansion);
    this.table(4, -2.9, 0xa294ce, 2.7, 1.5, this.expansion);
    const e = label('두 번째 작업실', 2.5);
    e.position.set(4, 2.1, -3);
    this.expansion.add(e);
    const wt = toy(palette.yellow);
    wt.position.set(4, 1.26, -2.9);
    this.expansion.add(wt);
    this.worker.position.set(4, 0, -1.7);
    this.worker.userData.cargo.visible = false;
    this.expansion.add(this.worker);
    for (const x of [-6.15, 6.15]) {
      r.add(box(0.75, 0.6, 0.75, 0xeeb37c, x, 0.3, -3.9));
      for (let j = 0; j < 3; j++) {
        const leaf = ball(0.44, 0x62a58a, x + (j - 1) * 0.18, 0.9 + j * 0.2, -3.9);
        leaf.scale.set(0.8, 1.4, 0.8);
        r.add(leaf);
      }
    }
    r.add(box(2.8, 0.035, 1, 0x90beaa, 4, 0.02, 4.1));
    const welcome = label('어서 오세요', 1.7);
    welcome.position.set(4, 0.2, 4.7);
    r.add(welcome);
    r.add(this.player, this.runner);
    this.resize();
  }
  table(x: number, z: number, c: number, w = 2.7, d = 1.5, parent = this.root) {
    parent.add(box(w, 1, d, c, x, 0.67, z), box(w + 0.15, 0.17, d + 0.1, 0xf9edda, x, 1.2, z));
    for (const dx of [-w * 0.36, w * 0.36])
      parent.add(box(0.15, 0.25, 0.2, 0x568477, x + dx, 0.13, z));
  }
  floorMarker(x: number, z: number, c: number) {
    const ring = new T.Mesh(
      new T.RingGeometry(0.52, 0.62, 48),
      new T.MeshBasicMaterial({ color: c, side: T.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.025, z);
    this.root.add(ring);
  }
  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
  }
  update(game: Game, dt: number, bench: boolean) {
    const s = game.s;
    this.mode = T.MathUtils.damp(this.mode, bench ? 1 : 0, s.settings.reduced ? 100 : 9, dt);
    const aspect = innerWidth / innerHeight;
    const wide = aspect < 0.8;
    const size = wide ? 20 : 13.7;
    this.view = T.MathUtils.lerp(size, 5.6, this.mode);
    this.camera.left = (-this.view * aspect) / 2;
    this.camera.right = (this.view * aspect) / 2;
    this.camera.top = this.view / 2;
    this.camera.bottom = -this.view / 2;
    this.camera.near = 0.1;
    this.camera.far = 100;
    this.target.set(wide ? s.player.x * 0.32 : 0, 0, wide ? s.player.z * 0.22 : 0);
    this.target.lerp(this.benchTarget, this.mode);
    const offset = new T.Vector3(0, 18, 19).lerp(new T.Vector3(0, 4.8, 7), this.mode);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    animatePerson(this.player, s.player, s.carried, s.settings.reduced);
    this.player.visible = !bench;
    this.root.getObjectByName('benchSample')!.visible = !bench;
    this.runner.visible = s.upgrades.runner;
    animatePerson(this.runner, s.runner, s.runner.load, s.settings.reduced);
    this.locked.visible = !s.upgrades.expansion;
    this.expansion.visible = s.upgrades.expansion;
    this.worker.userData.arms.forEach(
      (a: T.Object3D, i: number) => (a.rotation.x = -0.8 + Math.sin(s.production * 7 + i) * 0.3),
    );
    this.tray.forEach((m, i) => (m.visible = i < s.tray));
    this.shelf.forEach((m, i) => (m.visible = i < s.shelf));
    for (const c of s.customers) {
      let g = this.customers.get(c.id);
      if (!g) {
        g = person([0xdc91a1, 0x85adcc, 0xd9b16d, 0xa092c9][c.id % 4]);
        const order = label('말랑이 1개', 1.05);
        order.position.set(0, 2.1, 0);
        g.add(order);
        g.userData.order = order;
        this.root.add(g);
        this.customers.set(c.id, g);
      }
      animatePerson(g, c, c.paid ? 1 : 0, s.settings.reduced);
      g.userData.order.visible = !c.paid;
    }
    for (const [id, g] of this.customers)
      if (!s.customers.some((c) => c.id === id)) {
        const sprite = g.userData.order as T.Sprite;
        (sprite.material as T.SpriteMaterial).map?.dispose();
        sprite.material.dispose();
        g.traverse((o) => {
          if (o instanceof T.Mesh) o.geometry.dispose();
        });
        g.removeFromParent();
        this.customers.delete(id);
      }
    this.root.traverse((o) => {
      if (o instanceof T.Sprite) o.visible = !bench;
    });
    for (const c of s.customers) {
      this.customers.get(c.id)!.userData.order.visible = !bench && !c.paid;
    }
  }
  render() {
    this.renderer.render(this.scene, this.camera);
  }
  screen(x: number, y: number, z: number) {
    const p = new T.Vector3(x, y, z).project(this.camera);
    return { x: ((p.x + 1) * innerWidth) / 2, y: ((1 - p.y) * innerHeight) / 2 };
  }
}
