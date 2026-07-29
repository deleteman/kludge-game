import type { EventDrivenSound } from "../audio-effect.types.js";
import { AUDIO_KEYS } from "../audio-asset-registry.js";
import { pickSoundKey } from "../audio-utils.js";

/**
 * Sonido burbujeante de corrosión (nuevo-orden.md, Subfase 12b) — gemelo del
 * burst visual `corrosiveExposureEffect` (`particles/effects/hazard-effect.ts`),
 * disparado cuando un tripulante cruza el umbral de exposición corrosiva
 * (`HazardEvent kind:"corrosive-exposure"`). No cubre la nube ambiental
 * continua (esa reutiliza el mismo tinte que la fuga tóxica sin sonido propio,
 * fuera del pedido explícito de 12b — ver gasLeakAmbient para el único loop
 * continuo de esta subfase).
 *
 * Como con `combustion-sound.ts`: `HazardEvent` tampoco tiene hoy ningún
 * llamador real en `floorplan-scene.ts` — solo se dispara en
 * `particle-gallery-scene.ts` (demo). Mismo gap que #16 de
 * `PENDIENTES_OBSERVACIONES.md` (combustión), no documentado ahí todavía
 * para este evento.
 */
export const corrosionSound: EventDrivenSound<"corrosive-exposure"> = {
  kind: "corrosive-exposure",
  play(scene): void {
    scene.sound.play(pickSoundKey(AUDIO_KEYS.corrosion), { volume: 0.5 });
  },
};
