import type { PersonalityTrait } from "./personality-trait.types.js";

/**
 * Tipo de evento que dispara una frase de personalidad (GDD 6.7.1). El motor
 * solo decide QUÉ tipo de evento corresponde; el CONTENIDO de las frases vive
 * en i18n de `/game` (`crew.bark.<trait>.<eventType>.<n>`, CLAUDE.md: no
 * strings de UI hardcodeados en el motor). Ningún disparador real se cablea
 * en Fase 9 — llega con la primera crisis jugable (Fase 10).
 */
export type BarkEventType =
  | "crisis-start"
  | "dangerous-task"
  | "success"
  | "failure"
  | "crew-death"
  | "unstable-substance"
  | "severe-injury";

/** Cantidad de frases por rasgo×evento en el banco actual (GDD 6.7.1: 2 líneas por celda). */
export const BARK_LINES_PER_EVENT = 2;

/**
 * Clave i18n para la frase `index` (0-based) de `trait`×`eventType`. Punto
 * único de construcción de la clave para que el namespace `crew.bark.*` de
 * `/game` y el motor no diverjan.
 */
export function barkKey(trait: PersonalityTrait, eventType: BarkEventType, index: number): string {
  return `crew.bark.${trait}.${eventType}.${index}`;
}

/**
 * Elige el índice de frase a usar para `trait`×`eventType` (rotación simple,
 * determinista para tests). `/game` resuelve el texto real vía `t(barkKey(...))`.
 */
export function pickBarkIndex(occurrenceCount: number): number {
  return occurrenceCount % BARK_LINES_PER_EVENT;
}
