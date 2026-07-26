import type { ShipArchetype } from "../../floorplan/floorplan.types.js";
import { SHIP_ARCHETYPES } from "../../floorplan/floorplan.types.js";
import type { CrisisDefinition, CrisisDefinitionId } from "../crisis-definition.types.js";
import { CHAPTER_01_BY_ARCHETYPE } from "./chapter-01-primer-aviso.js";
import { CHAPTER_02_BY_ARCHETYPE } from "./chapter-02-ecos-en-el-pasillo.js";

/**
 * Secuencia ORDENADA de capítulos por arquetipo (10f). El `CHAPTER_REGISTRY`
 * (`chapter-registry.ts`) solo mapea id→definición SIN orden; este es el ÚNICO
 * lugar que define qué capítulo sigue a cuál. Data-driven: la lista maestra
 * `ORDERED_CHAPTERS` fija el orden global (una fila por capítulo, cada fila con
 * su variante por arquetipo), y de ahí se deriva la secuencia de ids concretos
 * por arquetipo. Añadir un capítulo = añadir su `Record<ShipArchetype, ...>` a
 * `ORDERED_CHAPTERS`, no editar un switch disperso.
 *
 * Hoy la secuencia es capítulo 1 → capítulo 2 (fin de la demo pública). Los
 * capítulos 3-8 se suman a `ORDERED_CHAPTERS` en la Fase 11.
 */
const ORDERED_CHAPTERS: ReadonlyArray<Record<ShipArchetype, CrisisDefinition>> = [
  CHAPTER_01_BY_ARCHETYPE,
  CHAPTER_02_BY_ARCHETYPE,
];

/** Secuencia de ids por arquetipo, derivada de `ORDERED_CHAPTERS`. */
export const CHAPTER_SEQUENCE_BY_ARCHETYPE: Record<
  ShipArchetype,
  ReadonlyArray<CrisisDefinitionId>
> = Object.fromEntries(
  SHIP_ARCHETYPES.map(
    (archetype): [ShipArchetype, ReadonlyArray<CrisisDefinitionId>] => [
      archetype,
      ORDERED_CHAPTERS.map((chapter) => chapter[archetype].id),
    ],
  ),
) as Record<ShipArchetype, ReadonlyArray<CrisisDefinitionId>>;

/**
 * Id del capítulo que sigue a `currentChapterId` en el arquetipo dado, o
 * `undefined` si es el último de la secuencia (o si `currentChapterId` no
 * pertenece a ella). Función pura — la usa `save/chapter-progression.ts` al
 * avanzar y `meta/crisis-outcome.ts` (en `/game`) para decidir si habilitar
 * "Siguiente capítulo".
 */
export function nextChapterAfter(
  currentChapterId: CrisisDefinitionId,
  archetype: ShipArchetype,
): CrisisDefinitionId | undefined {
  const sequence = CHAPTER_SEQUENCE_BY_ARCHETYPE[archetype];
  const index = sequence.indexOf(currentChapterId);
  if (index < 0 || index + 1 >= sequence.length) {
    return undefined;
  }
  return sequence[index + 1];
}
