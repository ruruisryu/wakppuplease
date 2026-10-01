import './style.css';
import { Game, B, fresh } from './game/simulation';
import { load, save } from './game/save';
import { World } from './render/world';
import { Wax } from './render/wax';
import { Audio } from './audio';
import { Input } from './input';
import { setupUI, updateHUD, growth, settings, $ } from './ui';

async function boot() {
  await document.fonts.ready;
  setupUI();
  const loaded = load();
  const game = new Game(loaded.state);
  const world = new World($<HTMLCanvasElement>('world'));
  const audio = new Audio();
  const wax = new Wax(world.scene, game, audio);
  const menu = $<HTMLDialogElement>('menu');
  let menuType = '';
  let toastTimer = 0;
  let last = performance.now(),
    saveTime = 0,
    hudTime = 0;
  let frames = 0,
    elapsed = 0;
  const metrics = { fps: 0, frames: 0, drawCalls: 0 };
  const toast = (message: string) => {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    toastTimer = 3;
  };
  const persist = () => {
    if (!save(game.s)) toast('저장 공간을 사용할 수 없어요. 이번 플레이는 계속할 수 있어요.');
  };
  const enter = () => {
    if (menu.open || wax.active) return;
    if (!game.near({ x: -3.7, z: -1.65 }, 1.15)) return;
    if (game.s.tray >= B.trayCapacity) {
      toast('완성 트레이를 먼저 비워 주세요');
      return;
    }
    input.clear();
    wax.enter();
  };
  const leave = () => {
    wax.leave();
    input.clear();
    persist();
  };
  function close() {
    menu.close();
    menuType = '';
    input.clear();
    persist();
  }
  function open(type: string) {
    input.clear();
    wax.down = false;
    wax.pointerId = -1;
    menuType = type;
    $('menuContent').innerHTML = type === 'growth' ? growth(game) : settings(game);
    if (!menu.open) menu.showModal();
    if (type === 'growth') {
      document.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach(
        (b) =>
          (b.onclick = () => {
            if (game.buy(b.dataset.buy as keyof typeof B.upgrades)) {
              audio.play('upgrade');
              persist();
              open('growth');
            }
          }),
      );
    } else {
      $<HTMLInputElement>('muted').onchange = (e) => {
        game.s.settings.muted = (e.target as HTMLInputElement).checked;
        persist();
      };
      $<HTMLInputElement>('volume').oninput = (e) => {
        game.s.settings.volume = Number((e.target as HTMLInputElement).value);
      };
      $<HTMLInputElement>('reduced').onchange = (e) => {
        game.s.settings.reduced = (e.target as HTMLInputElement).checked;
      };
      $<HTMLInputElement>('quality').onchange = (e) => {
        game.s.settings.quality = (e.target as HTMLInputElement).checked ? 'low' : 'high';
        quality();
      };
      $('reset').onclick = () => {
        $('menuContent').innerHTML =
          '<h1>새 공방을 열까요?</h1><p>이 기기의 코인, 직원, 작업 진행이 초기화됩니다.</p><button id="confirmReset" class="danger">초기화하고 시작</button>';
        $('confirmReset').onclick = () => {
          const prefs = game.s.settings;
          game.s = fresh();
          game.s.settings = prefs;
          game.events = [];
          wax.leave();
          close();
          toast('새로운 말랑한 하루!');
        };
      };
    }
  }
  function quality() {
    world.renderer.setPixelRatio(
      game.s.settings.quality === 'low' ? 1 : Math.min(devicePixelRatio, 1.6),
    );
    world.renderer.shadowMap.enabled = game.s.settings.quality === 'high';
    world.resize();
  }
  const input = new Input(
    audio,
    (key) => {
      if (key === 'Escape') {
        if (menu.open) close();
        else if (wax.active) leave();
        else open('pause');
      } else if (key === 'KeyE') enter();
    },
    () => menu.open || wax.active,
  );
  input.stick($('joystick'));
  $('pause').onclick = () => open('pause');
  $('upgrades').onclick = () => open('growth');
  $('closeMenu').onclick = close;
  $('interact').onclick = enter;
  $('back').onclick = leave;
  $('rotate').onclick = () => {
    wax.down = false;
    wax.rotation += Math.PI / 2;
  };
  $('coating').onclick = () => {
    wax.hard = !wax.hard;
    $('coating').textContent = wax.hard ? '단단한 껍질' : '얇은 껍질';
  };
  $('tool').onclick = () => {
    wax.wide = !wax.wide;
    $('tool').textContent = wax.wide ? '넓은 누르개' : '손끝';
  };
  $('next').onclick = () => {
    if (game.s.tray >= B.trayCapacity) {
      toast('트레이가 가득 찼어요. 매장으로 돌아가 주세요');
      return;
    }
    wax.enter();
  };
  menu.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  const canvas = $<HTMLCanvasElement>('world');
  canvas.addEventListener('pointerdown', (e) => {
    audio.unlock();
    if (!wax.active || menu.open || wax.pointerId !== -1) return;
    canvas.setPointerCapture(e.pointerId);
    wax.pointerId = e.pointerId;
    wax.down = true;
    wax.aim(e.clientX, e.clientY, world.camera);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === wax.pointerId) wax.aim(e.clientX, e.clientY, world.camera);
  });
  const release = (e: PointerEvent) => {
    if (e.pointerId === wax.pointerId) {
      wax.down = false;
      wax.pointerId = -1;
      persist();
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('resize', () => world.resize());
  addEventListener('blur', () => {
    input.clear();
    wax.down = false;
    wax.pointerId = -1;
    if (!menu.open) open('pause');
    persist();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      input.clear();
      wax.down = false;
      wax.pointerId = -1;
      if (!menu.open) open('pause');
      persist();
    }
  });
  addEventListener('pagehide', persist);
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    open('pause');
    toast('그래픽 연결이 끊겼어요. 새로고침하면 저장한 공방을 이어갑니다.');
  });
  canvas.addEventListener('webglcontextrestored', () => location.reload());
  quality();
  if (loaded.recovered) toast('저장 데이터를 읽지 못해 새 공방으로 복구했어요');
  $('loading').remove();
  // Read-only browser QA surface; no economy, movement or reward mutation shortcuts.
  Object.defineProperty(window, '__wakppu', {
    value: {
      snapshot: () =>
        JSON.parse(
          JSON.stringify({
            ...game.s,
            mode: wax.active ? 'bench' : 'shop',
            paused: menu.open,
            progress: wax.progress(),
            done: wax.done,
            metrics,
          }),
        ),
      project: (x: number, y: number, z: number) => world.screen(x, y, z),
    },
  });
  function frame(now: number) {
    const raw = (now - last) / 1000;
    const dt = Math.min(0.15, raw);
    last = now;
    frames++;
    elapsed += raw;
    if (elapsed > 1) {
      metrics.fps = Math.round(frames / elapsed);
      metrics.frames += frames;
      metrics.drawCalls = world.renderer.info.render.calls;
      frames = 0;
      elapsed = 0;
    }
    if (!menu.open && !document.hidden) {
      const v = input.vector();
      const steps = Math.max(1, Math.ceil(dt / 0.025));
      for (let i = 0; i < steps; i++) {
        if (!wax.active) game.move(v.x, v.z, dt / steps);
        game.tick(dt / steps, wax.active);
      }
      wax.tick(dt);
      saveTime += dt;
      if (saveTime > 2) {
        persist();
        saveTime = 0;
      }
      for (const event of game.events) {
        audio.play(event.type);
        if (event.type === 'sale') {
          const p = world.screen(event.x, 1.8, event.z);
          const el = document.createElement('div');
          el.className = 'floating';
          el.textContent = '+10';
          el.style.left = `${p.x}px`;
          el.style.top = `${p.y}px`;
          document.body.append(el);
          setTimeout(() => el.remove(), 1200);
        }
        if (event.type === 'made' && wax.done) toast('바삭! 말랑이 1개 완성');
        if (event.type === 'upgrade') toast('공방이 한 뼘 자랐어요!');
      }
      game.events = [];
    }
    audio.muted = game.s.settings.muted;
    audio.volume = game.s.settings.volume;
    world.update(game, menu.open ? 0 : dt, wax.active);
    world.render();
    hudTime += dt;
    if (hudTime > 0.08) {
      updateHUD(game, wax.active, wax.done);
      $('bar').style.width = `${wax.progress()}%`;
      hudTime = 0;
    }
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) $('toast').classList.remove('show');
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
boot().catch((error) => {
  console.error(error);
  document.getElementById('loading')!.innerHTML =
    '공방을 열지 못했어요<small>인터넷 연결과 WebGL 지원을 확인하고 새로고침해 주세요.</small><button onclick="location.reload()">다시 열기</button>';
});
