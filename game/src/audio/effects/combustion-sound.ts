import type { EventDrivenSound } from "../audio-effect.types.js";
import { AUDIO_KEYS } from "../audio-asset-registry.js";
import { pickSoundKey } from "../audio-utils.js";

/**
 * Sonido gemelo de `particles/effects/combustion-effect.ts`. Nota
 * (`PENDIENTES_OBSERVACIONES.md` #16): `CombustionEvent` no tiene ningún
 * llamador real en `MissionRuntime` todavía — este sonido queda listo pero
 * solo suena hoy en `particle-gallery-scene.ts` (demo), no en partida real,
 * hasta que se resuelva ese pendiente.
 */
export const combustionSound: EventDrivenSound<"combustion"> = {
  kind: "combustion",
  play(scene): void {
    scene.sound.play(pickSoundKey(AUDIO_KEYS.combustion), { volume: 0.6 });
  },
};
