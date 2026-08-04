import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SectionId } from "../atmosphere/section.types.js";

/**
 * Presupuesto de energía (Fase 13b, `nuevo-orden.md` Subfase 13b). Excepción
 * deliberada a la escala cualitativa bajo/medio/alto del resto del motor
 * (GDD §5.2): el conteo de unidades discretas (1/2/3...) es intencional, no
 * un olvido de simplificación.
 */

/** Bloque entero de unidades asignado por el jugador a una sección (nivel 1: global→sección). */
export interface SectionPowerAllocation {
  readonly sectionId: SectionId;
  readonly units: number;
}

/**
 * Prioridad manual de una instancia dentro del pool de su sección (nivel 2:
 * sección→componentes). Menor valor = más prioritario. Vive como tabla
 * aparte (no en `PlacedComponentInstance`) porque se reordena en bloque desde
 * el inspector de la capa de energía (Fase 13b, UI) — un array reordenable es
 * más natural que un override disperso por instancia.
 */
export interface InstancePowerPriority {
  readonly instanceId: PlacedComponentInstanceId;
  readonly priority: number;
}

/**
 * Estado dinámico del sistema de energía, serializado en `Blueprint.powerState`
 * (Fase 13b, `schemaVersion` 5→6). Arrays sparse por diseño: una sección o
 * instancia ausente equivale a "sin asignación"/"sin prioridad explícita".
 */
export interface PowerState {
  readonly sectionAllocations: ReadonlyArray<SectionPowerAllocation>;
  readonly instancePriorities: ReadonlyArray<InstancePowerPriority>;
  /**
   * Cicatriz REAL y permanente (ej. sacrificio del Cap.5, Fase 18): secciones
   * fuera de la grilla de reparto sin importar la asignación del jugador.
   * Nunca escrita por el reparto vivo — `MissionPowerRuntime` solo LEE este
   * campo para unirlo con el déficit táctico de la sesión al recalcular
   * `Blueprint.unpoweredSectionIds` cada tick. Mantenerla separada evita que
   * un apagón táctico de una misión "se vuelva permanente" en el guardado.
   */
  readonly permanentlyDisconnectedSectionIds: ReadonlyArray<SectionId>;
}

/** `PowerState` vacío — usado como default de deserialización (saves pre-v6) y para nuevas partidas sin cicatrices. */
export function emptyPowerState(): PowerState {
  return { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [] };
}
