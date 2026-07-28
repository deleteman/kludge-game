import { ATOMIC_COMPONENT_CATALOG } from "../components/catalog/atomic-component-catalog.js";
import type { ComponentId } from "../components/physical-component.types.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";

/**
 * Valor legible que una Pantalla LCD puede mostrar (Subfase 11h). Union
 * discriminada, no un `number` suelto: el LCD (§2 del documento fuente)
 * puede terminar mostrando presión, nivel de reservorio, o estado de un
 * latch — cada variante se agrega cuando exista una fuente real que resolver
 * (ver puntos 9/10 de PENDIENTES_OBSERVACIONES.md para RES). Hoy solo existe
 * la variante `pressure`.
 */
export type LcdDisplayValue = {
  readonly kind: "pressure";
  readonly sectionId: SectionId;
  readonly pressureKpa: number;
};

const PRESSURE_TRIGGER_TYPE = "pressure";

function isPressureSensor(componentDefinitionId: ComponentId): boolean {
  const spec = ATOMIC_COMPONENT_CATALOG.find((entry) => entry.id === componentDefinitionId);
  return (
    spec?.data.functional?.some(
      (property) => property.tag === "EM" && property.triggerType === PRESSURE_TRIGGER_TYPE,
    ) ?? false
  );
}

/**
 * Resuelve qué valor real debe mostrar una Pantalla LCD instalada, siguiendo
 * el cableado del grafo de señales hasta su fuente — NO lee el booleano
 * `SignalEvaluator` (ese solo sabe ON/OFF), lee directo el runtime de dominio
 * correspondiente (canal de lectura directa, decisión confirmada con el
 * operador en la planificación de 11h). Resolución por TAG del componente
 * fuente (`EM`/`triggerType`), no por identidad — principio 1 de CLAUDE.md.
 *
 * Devuelve `null` si el LCD no está cableado, o si está cableado a una fuente
 * sin variante de `LcdDisplayValue` conocida todavía (extensión futura).
 */
export function resolveLcdDisplayValue(
  blueprint: Blueprint,
  shipFloorplan: ShipFloorplan,
  lcdInstanceId: PlacedComponentInstanceId,
  atmosphereOf: (sectionId: SectionId) => SectionAtmosphere | undefined,
): LcdDisplayValue | null {
  const lcdNode = blueprint.signalGraph.nodes.find(
    (node) => node.role === "receptor" && node.ownerRef === lcdInstanceId,
  );
  if (!lcdNode) {
    return null;
  }
  const incomingEdge = blueprint.signalGraph.edges.find((edge) => edge.to === lcdNode.id);
  if (!incomingEdge) {
    return null;
  }
  const sourceNode = blueprint.signalGraph.nodes.find((node) => node.id === incomingEdge.from);
  if (!sourceNode) {
    return null;
  }
  const sourceInstance = blueprint.placedComponents.find(
    (instance) => instance.instanceId === sourceNode.ownerRef,
  );
  if (!sourceInstance || !isPressureSensor(sourceInstance.componentDefinitionId)) {
    return null;
  }
  const section = sectionContainingCell(shipFloorplan, sourceNode.position);
  const pressureKpa = section && atmosphereOf(section.id)?.pressureKpa;
  if (!section || pressureKpa === undefined) {
    return null;
  }
  return { kind: "pressure", sectionId: section.id, pressureKpa };
}
