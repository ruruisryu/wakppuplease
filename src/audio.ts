export class Audio {
  context?: AudioContext;
  last = 0;
  muted = false;
  volume = 0.45;
  unlock() {
    this.context ??= new AudioContext();
    void this.context.resume();
  }
  play(kind: string) {
    const c = this.context;
    if (!c || this.muted || c.state !== 'running' || c.currentTime - this.last < 0.055) return;
    this.last = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(this.volume * 0.14, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.14);
    g.connect(c.destination);
    if (kind === 'crack') {
      const b = c.createBuffer(1, c.sampleRate * 0.09, c.sampleRate);
      const a = b.getChannelData(0);
      for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * Math.exp(-i / 500);
      const n = c.createBufferSource();
      n.buffer = b;
      n.connect(g);
      n.start();
    } else {
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
