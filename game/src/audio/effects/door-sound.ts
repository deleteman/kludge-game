import type { EventDrivenSound } from "../audio-effect.types.js";
import { AUDIO_KEYS } from "../audio-asset-registry.js";
import { pickSoundKey } from "../audio-utils.js";

/**
 * Sonido de puerta (Subfase 13h, ronda 2 de playtest).
 *
 * Se engancha a `door-transition` y no a `door-settled` porque el evento de
 * transición marca el ARRANQUE del movimiento: el sonido tiene que empezar
 * cuando la hoja empieza a moverse, no cuando termina.
 *
 * Es el primer consumidor real de `doorEvents` — el motor venía emitiendo estos
 * eventos completos desde la ronda A y nadie estaba suscrito.
 */
export const doorSound: EventDrivenSound<"door-transition"> = {
  kind: "door-transition",
  play(scene, event): void {
    const key = event.to === "opening" ? AUDIO_KEYS.doorOpen : AUDIO_KEYS.doorClose;
    scene.sound.play(pickSoundKey(key), { volume: 0.45 });
  },
};
