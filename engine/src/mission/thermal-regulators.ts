import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type { FunctionalProperties } from "../properties/functional.types.js";
import type { MaterialProperties } from "../properties/material.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";

/**
 * Reguladores térmicos instalados y su estado (Subfase 14a-2).
 *
 * Vive en `/engine` y no como un closure dentro de `MissionRuntime` por la
 * misma razón que `doorSignalOutput`: decide una regla de dominio (cuándo una
 * máquina está enfriando de verdad), y un closure con una regla adentro es
 * código sin test por construcción.
 */

/**
 * ¿Esta definición es un regulador térmico? Identidad **por propiedades**, no
 * por id de catálogo (principio 1 de CLAUDE.md, mismo criterio con el que
 * `isElectromagnetDefinition` reconoce un electroimán). Tres condiciones:
 *
 *  - `ACT` — hace trabajo sobre el mundo. Una `placa-disipadora` (`CT: "A"` a
 *    secas) es la PIEZA con la que se construye un regulador, no un regulador:
 *    disipa pasivamente, no bombea calor.
 *  - `CT: "A"` — ese trabajo es térmico. Sin conductividad alta, el actuador
 *    mueve otra cosa.
 *  - **no `directional`** — actúa sobre su entorno, no en una dirección. Este
 *    tercero se añadió al verificar el predicado contra el catálogo REAL: con
 *    solo los dos primeros, `motor-crucero-eficiente` y
 *    `motor-propulsion-combate` entraban como enfriadores, que es exactamente
 *    el tipo de falso positivo que un predicado por propiedades tiene que
 *    resolver con otra propiedad y no con una lista de excepciones. Un motor
 *    conduce bien el calor y empuja en una dirección; un enfriador lo absorbe
 *    de la sala entera.
 */
export function isThermalRegulatorDefinition(data: {
  readonly material?: MaterialProperties;
  readonly functional?: FunctionalProperties;
}): boolean {
  const actuator = data.functional?.find((property) => property.tag === "ACT");
  if (!actuator || actuator.tag !== "ACT" || actuator.directional) {
    return false;
  }
  return data.material?.CT === "A";
}

/**
 * ¿Está esta máquina enfriando ahora mismo?
 *
 * Dos condiciones, y las dos importan:
 *  - **Energía**: sin alimentación no hace nada, igual que la puerta de 13h.
 *  - **Señal**: si el jugador la cableó, manda el cable; si no la cableó,
 *    funciona sola. Mismo criterio de tres valores que `doorSignalOutput` — sin
 *    cable no es "apagada", es "nadie la gobierna".
 *
 * Es lo que hace que el enfriador sea una pieza cableable de la capa de señales
 * (se puede colgar de un sensor térmico y montar un termostato) sin obligar a
 * cablearla para que sirva.
 */
export function isThermalRegulatorActive(
  instanceId: PlacedComponentInstanceId,
  graph: Blueprint["signalGraph"],
  isInstancePowered: (instanceId: PlacedComponentInstanceId) => boolean,
  outputOf: (nodeId: SignalNodeId) => boolean,
): boolean {
  if (!isInstancePowered(instanceId)) {
    return false;
  }
  const node = graph.nodes.find(
    (candidate) => candidate.ownerRef === instanceId && candidate.role === "receptor",
  );
  if (!node) {
    return true;
  }
  const wired = graph.edges.some((edge) => edge.to === node.id);
  return wired ? outputOf(node.id) : true;
}

export interface ThermalRegulatorDeps {
  readonly registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>;
  readonly floorplan: ShipFloorplan;
  readonly isInstancePowered: (instanceId: PlacedComponentInstanceId) => boolean;
  readonly outputOf: (nodeId: SignalNodeId) => boolean;
}

/**
 * Cuántos reguladores están enfriando activamente en cada sección. Se cuentan y
 * no se colapsan a un booleano porque dos enfriadores en la misma sala enfrían
 * el doble — la misma decisión que tomaron los pulsos de calor solapados en
 * 14a-1, y lo que permite al jugador escalar el efecto montando más piezas.
 */
export function activeThermalRegulatorsBySection(
  blueprint: Blueprint,
  deps: ThermalRegulatorDeps,
): ReadonlyMap<SectionId, number> {
  const counts = new Map<SectionId, number>();
  for (const { instanceId, sectionId } of installedThermalRegulators(blueprint, deps)) {
    if (!isThermalRegulatorActive(instanceId, blueprint.signalGraph, deps.isInstancePowered, deps.outputOf)) {
      continue;
    }
    counts.set(sectionId, (counts.get(sectionId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Secciones que TIENEN un regulador instalado, esté activo o no. Es lo que
 * necesita `thermalRegulatorOverloaded`: un regulador que se rindió ante el
 * calor es exactamente uno que está instalado y no da abasto — si además
 * estuviera apagado, con más razón.
 */
export function sectionsWithThermalRegulator(
  blueprint: Blueprint,
  deps: Pick<ThermalRegulatorDeps, "registry" | "floorplan">,
): ReadonlySet<SectionId> {
  const sections = new Set<SectionId>();
  for (const { sectionId } of installedThermalRegulators(blueprint, deps)) {
    sections.add(sectionId);
  }
  return sections;
}

function* installedThermalRegulators(
  blueprint: Blueprint,
  deps: Pick<ThermalRegulatorDeps, "registry" | "floorplan">,
): Generator<{ instanceId: PlacedComponentInstanceId; sectionId: SectionId }> {
  for (const placed of blueprint.placedComponents) {
    if (placed.condition !== "ok") {
      continue;
    }
    const definition = deps.registry.get(placed.componentDefinitionId);
    if (!definition || !isThermalRegulatorDefinition(definition.data)) {
      continue;
    }
    const sectionId = sectionContainingCell(deps.floorplan, placed.placement.position)?.id;
    if (sectionId) {
      yield { instanceId: placed.instanceId, sectionId };
    }
  }
}
