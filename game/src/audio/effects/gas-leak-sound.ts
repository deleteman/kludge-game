import type Phaser from "phaser";

import type { StateDrivenSound } from "../audio-effect.types.js";
import { AUDIO_KEYS } from "../audio-asset-registry.js";

export interface GasLeakSoundState {
  /**
   * Intensidad de la fuga 0..1 (`leak-activity.ts`): cuánto gas está LLEGANDO,
   * no cuánto hay. Antes era la concentración presente y el siseo no se apagaba
   * nunca en una sala que quedaba contaminada.
   */
  readonly intensity: number;
}

const MAX_VOLUME = 0.35;

/** `WebAudioSound`/`HTML5AudioSound` ambas exponen `setVolume`; `BaseSound` no la declara. */
type VolumeControlledSound = Phaser.Sound.BaseSound & { setVolume(value: number): unknown };

/**
 * Loop ambiental de fuga de gas — sonido gemelo de `createGasLeakEffect`
 * (`particles/effects/atmosphere-state-effects.ts`), mismo criterio
 * state-driven (sin `DomainEvent` propio, GDD 11.1: un evento por tick sería
 * ruido). Volumen ∝ intensidad de la fuga; se detiene por completo con `intensity
 * <= 0`, igual que el emisor de partículas se detiene con `emitter.stop()`.
 *
 * Gap de asset (ver `audio-asset-registry.ts`): el pack no trae un siseo de
 * fuga dedicado — usa `AUDIO_KEYS.gasLeakAmbient` (loop de motor grave) como
 * aproximación hasta conseguir un asset real.
 */
export function createGasLeakSound(): StateDrivenSound<GasLeakSoundState> {
  let sound: Phaser.Sound.BaseSound | undefined;

  return {
    start(s: Phaser.Scene): void {
      sound = s.sound.add(AUDIO_KEYS.gasLeakAmbient, { loop: true, volume: 0 });
    },
    update(state: GasLeakSoundState): void {
      if (!sound) return;
      if (state.intensity <= 0) {
        if (sound.isPlaying) sound.stop();
        return;
      }
      const volume = Math.min(state.intensity, 1) * MAX_VOLUME;
      (sound as VolumeControlledSound).setVolume(volume);
      if (!sound.isPlaying) sound.play();
    },
    stop(): void {
      sound?.stop();
      sound?.destroy();
      sound = undefined;
    },
  };
}
