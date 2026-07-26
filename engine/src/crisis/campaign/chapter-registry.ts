import type { CrisisDefinition, CrisisDefinitionId } from "../crisis-definition.types.js";
import { CHAPTER_01_BY_ARCHETYPE } from "./chapter-01-primer-aviso.js";
import { CHAPTER_02_BY_ARCHETYPE } from "./chapter-02-ecos-en-el-pasillo.js";

/**
 * Resuelve `ChapterProgressState.currentChapterId` (`save/campaign-save.types.ts`)
 * a su `CrisisDefinition`. Una entrada por capítulo y arquetipo (GDD: una
 * campaña usa un único arquetipo elegido al inicio, pero el capítulo debe
 * existir para los 4). Capítulos futuros se añaden aquí, no en un switch
 * disperso por el código. El ORDEN entre capítulos vive en `chapter-sequence.ts`.
 */
export const CHAPTER_REGISTRY: ReadonlyMap<CrisisDefinitionId, CrisisDefinition> = new Map(
  [...Object.values(CHAPTER_01_BY_ARCHETYPE), ...Object.values(CHAPTER_02_BY_ARCHETYPE)].map(
    (definition) => [definition.id, definition],
  ),
);
