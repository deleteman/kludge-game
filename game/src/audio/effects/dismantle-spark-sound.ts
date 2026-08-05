import type { EventDrivenSound } from "../audio-effect.types.js";
import { AUDIO_KEYS } from "../audio-asset-registry.js";
import { pickSoundKey } from "../audio-utils.js";

/**
 * Chispazo al arrancar una pieza viva (Subfase 13d). Reutiliza el mismo banco
 * que el corte por sobrecarga (`overloadCut`, chisporroteo/arco): es
 * literalmente el mismo fenómeno eléctrico, con otro origen — no hay asset
 * dedicado en el pack (deuda #17 de `PENDIENTES_OBSERVACIONES.md`).
 */
export const dismantleSparkSound: EventDrivenSound<"dismantle-spark"> = {
  kind: "dismantle-spark",
  play(scene): void {
    scene.sound.play(pickSoundKey(AUDIO_KEYS.overloadCut), { volume: 0.55 });
  },
};
