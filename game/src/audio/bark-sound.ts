import type Phaser from "phaser";
import type { BarkEventType } from "engine";

import { AUDIO_KEYS } from "./audio-asset-registry.js";
import { pickSoundKey } from "./audio-utils.js";

/**
 * Blip corto que acompaña la burbuja de texto de un bark (`bark-controller.ts`),
 * Subfase 12b. NO es voz hablada: `game/assets/audio/voices/` son clips
 * genéricos en inglés ("hurry_up", "correct"...) que no corresponden a las
 * líneas i18n ya escritas en `engine/src/crew/bark-bank.ts` — usar esos como
 * locución real requeriría re-grabar, fuera de alcance de esta subfase. Se
 * mapea por CATEGORÍA de evento (no por rasgo de personalidad, GDD 6.7), para
 * no multiplicar combinaciones sin una razón sonora real.
 */
const SOUND_KEYS_BY_EVENT_TYPE: Readonly<Record<BarkEventType, readonly string[]>> = {
  "crisis-start": AUDIO_KEYS.barkCrisisOrDanger,
  "dangerous-task": AUDIO_KEYS.barkCrisisOrDanger,
  success: AUDIO_KEYS.barkSuccess,
  failure: AUDIO_KEYS.barkFailureOrInjury,
  "severe-injury": AUDIO_KEYS.barkFailureOrInjury,
  "crew-death": AUDIO_KEYS.barkCrewDeath,
  "unstable-substance": AUDIO_KEYS.barkUnstableSubstance,
};

export function playBarkSound(scene: Phaser.Scene, eventType: BarkEventType): void {
  scene.sound.play(pickSoundKey(SOUND_KEYS_BY_EVENT_TYPE[eventType]), { volume: 0.4 });
}
