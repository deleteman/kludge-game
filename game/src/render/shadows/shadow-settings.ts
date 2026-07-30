import { DEFAULT_SETTINGS } from "../../meta/game-settings.types.js";

/**
 * Store vivo (en memoria, NUNCA localStorage — CLAUDE.md) de la intensidad de
 * las sombras dinámicas (Fase 12d.4). Mismo criterio que `crt-settings.ts`:
 * desacopla a quien LEE cada frame (el `DynamicShadowLayer` vía `floorplan-scene`)
 * de quien ESCRIBE en vivo (el slider de `options-scene.ts`), sin plumbear
 * eventos entre escenas — opciones es un overlay sobre el plano y el slider debe
 * reflejarse al instante. La persistencia real pasa por `save-adapter.ts`.
 */
let shadowIntensity = DEFAULT_SETTINGS.shadowIntensity;

export function getShadowIntensity(): number {
  return shadowIntensity;
}

export function setShadowIntensity(value: number): void {
  shadowIntensity = Math.min(1, Math.max(0, value));
}

/** Siembra el store desde unas preferencias cargadas (idempotente). */
export function hydrateShadowSettings(settings: { shadowIntensity: number }): void {
  setShadowIntensity(settings.shadowIntensity);
}
