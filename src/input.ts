import type { Audio } from './audio';
export class Input {
  keys = new Set<string>();
  x = 0;
  z = 0;
  stickId = -1;
  origin = { x: 0, y: 0 };
  constructor(
    private audio: Audio,
    private action: (key: string) => void,
    private blocked: () => boolean,
  ) {
    addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (['Escape', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
        e.preventDefault();
      this.audio.unlock();
      if (!e.repeat) this.action(e.code);
      if (!this.blocked()) this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => this.clear());
    addEventListener('pointerdown', () => this.audio.unlock(), { once: true });
  }
  clear() {
    this.keys.clear();
    this.x = 0;
    this.z = 0;
    this.stickId = -1;
    document.querySelector<HTMLElement>('#knob')?.style.setProperty('transform', 'translate(0,0)');
  }
  vector() {
    return {
      x:
        this.x +
        (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
        (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0),
      z:
        this.z +
        (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) -
        (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0),
    };
  }
  stick(el: HTMLElement) {
    const knob = el.querySelector<HTMLElement>('#knob')!;
    el.addEventListener('pointerdown', (e) => {
      if (this.blocked() || this.stickId !== -1) return;
      this.audio.unlock();
      e.preventDefault();
      this.stickId = e.pointerId;
      this.origin = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickId) return;
      const dx = e.clientX - this.origin.x,
        dy = e.clientY - this.origin.y;
      const d = Math.max(40, Math.hypot(dx, dy));
      this.x = dx / d;
      this.z = dy / d;
      knob.style.transform = `translate(${this.x * 30}px,${this.z * 30}px)`;
    });
    const stop = (e: PointerEvent) => {
      if (e.pointerId === this.stickId) this.clear();
    };
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    el.addEventListener('lostpointercapture', stop);
  }
}
