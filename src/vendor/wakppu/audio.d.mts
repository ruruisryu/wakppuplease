// Types for the ported Wax Studio recorded-audio player (plain JS module).
export class CrackAudio {
  enabled: boolean; loaded: boolean; loadError: unknown; events: number; eventKinds: Record<string, number>;
  volume: number;
  attach(context: AudioContext, output: AudioNode): Promise<void>;
  retry(): Promise<void> | undefined;
  select(id: string): void;
  crack(intensity?: number): void;
  progress(intensity: number, delta: number): void;
  peel(intensity: number): void;
  beginSweep(): void;
  endSweep(stop?: boolean): void;
  update(): void;
  swept(moved: number): void;
  suspend(): void;
  stopAll(): void;
}
