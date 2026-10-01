import { CrackAudio } from './vendor/wakppu/audio.mjs';
export class Audio {
  readonly crack = new CrackAudio();
  context?: AudioContext;
  private master?: GainNode;
  last = 0;
  private muteValue = false;
  private volumeValue = 0.45;
  get muted() {
    return this.muteValue;
  }
  set muted(v: boolean) {
    if (v !== this.muteValue) {
      this.muteValue = v;
      this.apply();
    }
  }
  get volume() {
    return this.volumeValue;
  }
  set volume(v: number) {
    if (v !== this.volumeValue) {
      this.volumeValue = v;
      this.apply();
    }
  }
  private apply() {
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        this.muteValue ? 0 : this.volumeValue,
        this.context.currentTime,
        0.02,
      );
  }
  unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.apply();
      void this.crack
        .attach(this.context, this.master)
        .catch((e) => console.error('Wax audio decode failed', e));
    }
    void this.context.resume().catch(() => undefined);
  }
  play(kind: string) {
    const c = this.context;
    if (!c || this.muted || c.state !== 'running' || c.currentTime - this.last < 0.055) return;
    this.last = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0.14, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.14);
    g.connect(this.master!);
    {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(
        kind === 'sale' ? 880 : kind === 'made' ? 660 : kind === 'upgrade' ? 1100 : 440,
        c.currentTime,
      );
      o.frequency.exponentialRampToValueAtTime(kind === 'sale' ? 1320 : 700, c.currentTime + 0.12);
      o.connect(g);
      o.start();
      o.stop(c.currentTime + 0.16);
    }
  }
}
