import { DEFAULT_SETTINGS } from "../meta/game-settings.types.js";

/**
 * Store vivo (en memoria, NUNCA localStorage — CLAUDE.md) de los dos controles
 * de accesibilidad del CRT. Desacopla a quien LEE cada frame (el driver del
 * shader en `floorplan-scene.ts`) de quien ESCRIBE en vivo (los sliders de
 * `options-scene.ts`), sin tener que plumbear eventos entre escenas: opciones
 * es un overlay sobre el plano, y el slider debe reflejarse al instante.
 *
 * Se hidrata desde disco (`loadSettings`) al abrir opciones o al crear el
 * plano; hasta entonces sirve los defaults. La persistencia real sigue pasando
 * por `save-adapter.ts` (`window.kludgeSettings`) al pulsar "Back".
 */
let crtIntensity = DEFAULT_SETTINGS.crtIntensity;
let flickerIntensity = DEFAULT_SETTINGS.flickerIntensity;

export function getCrtIntensity(): number {
  return crtIntensity;
}

export function getFlickerIntensity(): number {
  return flickerIntensity;
}

export function setCrtIntensity(value: number): void {
  crtIntensity = Math.min(1, Math.max(0, value));
}

export function setFlickerIntensity(value: number): void {
  flickerIntensity = Math.min(1, Math.max(0, value));
}

/** Siembra el store desde unas preferencias cargadas (idempotente). */
export function hydrateCrtSettings(settings: { crtIntensity: number; flickerIntensity: number }): void {
  setCrtIntensity(settings.crtIntensity);
  setFlickerIntensity(settings.flickerIntensity);
}
