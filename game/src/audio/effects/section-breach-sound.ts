import type { EventDrivenSound } from "../audio-effect.types.js";
import { AUDIO_KEYS } from "../audio-asset-registry.js";
import { pickSoundKey } from "../audio-utils.js";

/**
 * Sonido gemelo de `particles/effects/section-breach-effect.ts` (Subfase 13f):
 * el casco se abre al vacío.
 *
 * NOTA DE ASSET (deuda #17): no hay sonido de descompresión en el pack. Se
 * reutiliza el banco de explosión grave — es la familia más cercana a "algo
 * estructural acaba de reventar" — con volumen alto porque es, junto a la
 * muerte de un tripulante, el peor evento que puede ocurrirle a la nave. El
 * punto de cambio cuando llegue el asset real es `AUDIO_KEYS`, ningún llamador.
 *
 * `section-damaged` queda sin sonido puntual a propósito: se emite en cada
 * cruce de nivel de varias secciones y saturaría; su lectura es visual.
 */
export const sectionBreachedSound: EventDrivenSound<"section-breached"> = {
  kind: "section-breached",
  play(scene): void {
    scene.sound.play(pickSoundKey(AUDIO_KEYS.overloadExplosion), { volume: 0.85 });
  },
};
