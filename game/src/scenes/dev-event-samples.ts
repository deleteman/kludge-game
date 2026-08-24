import type { CrewActorId, DomainEvent, SectionId } from "engine";

/**
 * Catálogo de `DomainEvent` de MUESTRA, uno por fenómeno del
 * `effect-registry.ts`. Extraído de `particle-gallery-scene.ts` (Fase 8) en
 * 12d.6 para que lo compartan dos consumidores con propósitos distintos:
 *
 *  - la **galería de partículas** (tecla G), que da una tecla por fenómeno
 *    sobre un plano de referencia — catálogo visual;
 *  - la **tecla de dev del plano de misión** (tecla F), que los dispara en la
 *    celda seleccionada de una partida REAL. Esa es la única forma de verificar
 *    el bug de doble-cámara: la galería tiene una sola cámara, así que ahí el
 *    problema no se reproduce ni aunque esté presente.
 *
 * Cada fenómeno nuevo que se registre en `effect-registry.ts` se agrega acá y
 * queda disponible en los dos caminos a la vez.
 */

const GALLERY_SECTION_ID = "gallery-section" as SectionId;
/**
 * Celda de referencia de las muestras que ahora la piden (Subfase 13f). El
 * efecto se pinta en la celda que le pasa el llamador, no en esta — existe
 * solo para que el evento de muestra esté completo.
 */
const GALLERY_CELL = { x: 0, y: 0 };

export interface DevEventSample {
  readonly key: string;
  readonly label: string;
  readonly buildEvent: () => DomainEvent;
}

export const DEV_EVENT_SAMPLES: readonly DevEventSample[] = [
  {
    key: "ONE",
    label: "1: combustión",
    buildEvent: () => ({
      kind: "combustion",
      elapsedSeconds: 0,
      intensity: "standard",
      radius: "half-section",
      crewDamage: "medium",
    }),
  },
  {
    key: "TWO",
    label: "2: ignición espontánea",
    buildEvent: () => ({ kind: "spontaneous-ignition", elapsedSeconds: 0 }),
  },
  {
    key: "THREE",
    label: "3: neutralización",
    buildEvent: () => ({
      kind: "neutralization",
      elapsedSeconds: 0,
      heatReleasedCelsius: 15,
      heatDurationSeconds: 1.2,
    }),
  },
  {
    key: "FOUR",
    label: "4: sobrecarga·corte",
    buildEvent: () => ({
      kind: "overload",
      elapsedSeconds: 0,
      ref: "gallery-conductor",
      resourceType: "E",
      failureMode: "cut",
      capacity: 10,
      load: 14,
    }),
  },
  {
    key: "FIVE",
    label: "5: sobrecarga·incendio",
    buildEvent: () => ({
      kind: "overload",
      elapsedSeconds: 0,
      ref: "gallery-conductor",
      resourceType: "T",
      failureMode: "fire",
      capacity: 10,
      load: 13,
    }),
  },
  {
    key: "SIX",
    label: "6: sobrecarga·explosión",
    buildEvent: () => ({
      kind: "overload",
      elapsedSeconds: 0,
      ref: "gallery-reservoir",
      resourceType: "G",
      failureMode: "explosion",
      capacity: 10,
      load: 22,
    }),
  },
  {
    key: "SEVEN",
    label: "7: corrosión activa",
    buildEvent: () => ({
      kind: "structural-degraded",
      elapsedSeconds: 0,
      ref: "gallery-structure",
      newLevel: "M",
    }),
  },
  {
    key: "EIGHT",
    label: "8: fallo estructural",
    buildEvent: () => ({ kind: "structural-failure", elapsedSeconds: 0, ref: "gallery-structure" }),
  },
  {
    key: "NINE",
    label: "9: umbral tóxico",
    buildEvent: () => ({
      kind: "toxic-threshold",
      elapsedSeconds: 0,
      sectionId: GALLERY_SECTION_ID,
      severity: "lethal",
      concentration: 0.8,
    }),
  },
  {
    key: "ZERO",
    label: "0: exposición corrosiva",
    buildEvent: () => ({
      kind: "corrosive-exposure",
      elapsedSeconds: 0,
      sectionId: GALLERY_SECTION_ID,
      severity: "incapacitation",
      concentration: 0.5,
    }),
  },
  {
    key: "Q",
    label: "Q: estela magnética",
    buildEvent: () => ({
      kind: "magnetic-acceleration",
      elapsedSeconds: 0,
      ref: "gallery-projectile",
      velocity: "A",
    }),
  },
  {
    key: "W",
    label: "W: impacto cinético",
    buildEvent: () => ({
      kind: "kinetic-impact",
      elapsedSeconds: 0,
      targetRef: "gallery-target",
      // Subfase 13f: el impacto ahora dice contra QUÉ chocó y en qué celda.
      targetKind: "component",
      position: GALLERY_CELL,
      velocity: "A",
      severity: "high",
    }),
  },
  {
    key: "A",
    label: "A: muerte·fuego/explosión (gore)",
    buildEvent: () => ({
      kind: "crew-death",
      elapsedSeconds: 0,
      actorId: "gallery-crew" as CrewActorId,
      cause: "explosion",
    }),
  },
  {
    key: "S",
    label: "S: muerte·frío (fragmentación)",
    buildEvent: () => ({
      kind: "crew-death",
      elapsedSeconds: 0,
      actorId: "gallery-crew" as CrewActorId,
      cause: "cold",
    }),
  },
  {
    key: "D",
    label: "D: muerte·corrosión (disolución)",
    buildEvent: () => ({
      kind: "crew-death",
      elapsedSeconds: 0,
      actorId: "gallery-crew" as CrewActorId,
      cause: "corrosion",
    }),
  },
  {
    key: "F",
    label: "F: muerte·electrocución (colapso)",
    buildEvent: () => ({
      kind: "crew-death",
      elapsedSeconds: 0,
      actorId: "gallery-crew" as CrewActorId,
      cause: "electrocution",
    }),
  },
  {
    key: "Z",
    label: "Z: herida no letal (sin variante de cuerpo)",
    buildEvent: () => ({
      kind: "crew-damaged",
      elapsedSeconds: 0,
      actorId: "gallery-crew" as CrewActorId,
      cause: "kinetic-impact",
      hpLost: 20,
      remainingHp: 60,
    }),
  },
];
