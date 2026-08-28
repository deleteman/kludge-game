import type { ConduitId } from "../floorplan/floorplan.types.js";

/**
 * Apertura persistida de una válvula de ventilación (Subfase 13h).
 *
 * Separado de `ValveRuntime` para que `Blueprint` pueda declarar el campo sin
 * arrastrar la lógica del runtime — mismo criterio que
 * `SectionIntegritySnapshot` frente a `MissionSectionIntegrityRuntime`.
 */
export interface ValveSnapshot {
  readonly conduitId: ConduitId;
  readonly aperture: number;
}
