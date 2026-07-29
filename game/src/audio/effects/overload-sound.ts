import type { FailureMode } from "engine";

import type { EventDrivenSound } from "../audio-effect.types.js";
import { AUDIO_KEYS } from "../audio-asset-registry.js";
import { pickSoundKey } from "../audio-utils.js";

/**
 * Sonido gemelo de `particles/effects/overload-effect.ts`: mismo criterio,
 * tres `failureMode` → tres fenómenos sonoros distintos (chisporroteo, llamarada,
 * explosión). Sin asset "zumbido eléctrico" dedicado en el pack — se usa
 * `forceField` (chisporroteo/arco) como aproximación para `cut`, señalado en
 * `audio-asset-registry.ts`.
 */
const SOUND_KEY_BY_MODE: Readonly<Record<FailureMode, readonly string[]>> = {
  cut: AUDIO_KEYS.overloadCut,
  fire: AUDIO_KEYS.overloadFire,
  explosion: AUDIO_KEYS.overloadExplosion,
};

export const overloadSound: EventDrivenSound<"overload"> = {
  kind: "overload",
  play(scene, event): void {
    scene.sound.play(pickSoundKey(SOUND_KEY_BY_MODE[event.failureMode]), { volume: 0.6 });
  },
};
