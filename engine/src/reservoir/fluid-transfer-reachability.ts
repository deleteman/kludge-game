/**
 * Restricción de alcance para el trasvase de sustancias entre reservorios
 * (Subfase 13e). Espejo exacto de `assertSignalWiringReachable`
 * (`workbench/port-wiring.ts`, Fase 11f) con `kind: "fluido"` en vez de
 * `"senal"`: dos reservorios de la MISMA sección se trasvasan sin más (el
 * tripulante lo hace a mano); cruzar de sección exige un camino de conductos
 * `fluido`, porque un líquido no atraviesa el casco por voluntad propia.
 *
 * Se reusa `sectionsConnectedByConduit` tal cual — no se duplica la búsqueda
 * de rutas. Misma política fail-open: si algún extremo no cae en ninguna
 * sección, no se puede afirmar que cruza un límite, así que no bloquea.
 *
 * Nota de contenido: hoy NINGÚN mapa autorado tiene conductos `fluido`
 * (deuda #13), así que hasta autorarlos el trasvase cross-section queda
 * bloqueado en todas las naves. Es contenido faltante, no un bug de motor —
 * el intra-sección y el "aplicar sobre la sección" funcionan igual.
 */

import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import { sectionsConnectedByConduit } from "../floorplan/conduit-connectivity.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";

export class FluidTransferError extends Error {}

/** No hay camino de conductos `fluido` entre las secciones de los dos reservorios. */
export class FluidTransferUnreachableError extends FluidTransferError {
  constructor(
    readonly fromSectionId: SectionId,
    readonly toSectionId: SectionId,
  ) {
    super(
      `No hay conducto de fluido entre las secciones "${fromSectionId}" y "${toSectionId}": la sustancia no puede cruzar el casco.`,
    );
  }
}

/** Sección que contiene el origen (min corner) de una instancia colocada. */
export function sectionOfInstance(
  blueprint: Blueprint,
  floorplan: ShipFloorplan,
  instanceId: PlacedComponentInstanceId,
): SectionId | undefined {
  const instance = blueprint.placedComponents.find((placed) => placed.instanceId === instanceId);
  if (!instance) {
    return undefined;
  }
  return sectionContainingCell(floorplan, instance.placement.position)?.id;
}

/** Lanza `FluidTransferUnreachableError` si el trasvase cruza el casco sin conducto `fluido`. */
export function assertFluidTransferReachable(
  blueprint: Blueprint,
  floorplan: ShipFloorplan,
  fromInstanceId: PlacedComponentInstanceId,
  toInstanceId: PlacedComponentInstanceId,
): void {
  const fromSectionId = sectionOfInstance(blueprint, floorplan, fromInstanceId);
  const toSectionId = sectionOfInstance(blueprint, floorplan, toInstanceId);
  // Sección indeterminable (instancia ausente o sobre una pared): fail-open,
  // mismo criterio que el cableado de señal.
  if (!fromSectionId || !toSectionId) {
    return;
  }
  if (fromSectionId === toSectionId) {
    return;
  }
  if (!sectionsConnectedByConduit(floorplan, "fluido", fromSectionId, toSectionId)) {
    throw new FluidTransferUnreachableError(fromSectionId, toSectionId);
  }
}

/** Versión no-lanzadora, para que la UI deshabilite el botón sin capturar excepciones. */
export function isFluidTransferReachable(
  blueprint: Blueprint,
  floorplan: ShipFloorplan,
  fromInstanceId: PlacedComponentInstanceId,
  toInstanceId: PlacedComponentInstanceId,
): boolean {
  try {
    assertFluidTransferReachable(blueprint, floorplan, fromInstanceId, toInstanceId);
    return true;
  } catch (error) {
    if (error instanceof FluidTransferUnreachableError) {
      return false;
    }
    throw error;
  }
}
