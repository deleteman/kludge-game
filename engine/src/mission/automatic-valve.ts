import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type { FunctionalProperties } from "../properties/functional.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";

/**
 * Válvulas automáticas instaladas y su estado (Subfase 14b-2).
 *
 * Es el sentido Señales → Química: la versión automática de la tarea
 * `apply-substance`, sin tripulante y continua. Lo que cierra el lazo
 * **sensor químico → chip → válvula**, y lo que da al Cap.1 su primera
 * herramienta de corte automático de una fuga.
 *
 * Vive en `/engine` y no como closure dentro de `MissionRuntime` por la misma
 * razón que `doorSignalOutput` y `thermal-regulators.ts`: decide una regla de
 * dominio, y un closure con una regla adentro es código sin test por
 * construcción.
 */

/**
 * ¿Esta definición es una válvula automática? Identidad **por propiedades**,
 * nunca por id (principio 1), mismo criterio que `isThermalRegulatorDefinition`.
 * Dos condiciones:
 *
 *  - `ACT` **no direccional** — hace trabajo sobre su entorno, no en una
 *    dirección. El descarte de los direccionales es el mismo que necesitó el
 *    regulador térmico para no tragarse los motores.
 *  - `RES` de gas o líquido — tiene algo que verter. Un `RES(E)` es una batería:
 *    almacena energía, no una sustancia, y ya está excluido en el resto del
 *    motor por el mismo motivo (ver `indexFactoryReservoirContents`).
 *
 * Verificado contra el catálogo REAL (no de memoria): lo cumplen exactamente
 * cuatro piezas — `generador-oxigeno-precision`, `banco-sangre-fluidos`,
 * `farmacia-automatizada` e `invernadero-hidroponico`.
 *
 * **El solape con el regulador térmico es deliberado** (decisión del operador,
 * 2026-09-14): `banco-sangre-fluidos` tiene `CT: "A"`, así que es enfriador Y
 * válvula — un tanque de fluidos refrigerado que además puede volcar su
 * contenido. No se excluye con una condición extra porque no hay nada
 * contradictorio en que una pieza haga dos cosas; eso es composición por
 * propiedades, y excluirlo sería una lista de excepciones disfrazada.
 */
export function isAutomaticValveDefinition(data: {
  readonly functional?: FunctionalProperties;
}): boolean {
  const actuator = data.functional?.find((property) => property.tag === "ACT");
  if (!actuator || actuator.tag !== "ACT" || actuator.directional) {
    return false;
  }
  return (
    data.functional?.some(
      (property) =>
        property.tag === "RES" &&
        (property.resourceType === "G" || property.resourceType === "L"),
    ) ?? false
  );
}

/**
 * ¿Está esta válvula vertiendo ahora mismo?
 *
 * Dos condiciones, y la segunda es al REVÉS que la del regulador térmico:
 *  - **Energía**: sin alimentación no hace nada, igual que la puerta de 13h y
 *    que el enfriador.
 *  - **Señal**: **sin cable NO vierte**. El enfriador sin cablear funciona solo
 *    porque su trabajo es mantener el statu quo (una sala a temperatura
 *    nominal); una válvula sin cablear que vaciara su reservorio sobre la nave
 *    apenas se instala sería una trampa, no una pieza. Vaciar un tanque es
 *    irreversible (principio 5), así que el default tiene que ser no hacerlo.
 *
 * Sigue siendo el mismo criterio de tres valores de `doorSignalOutput` — "sin
 * cable" no es lo mismo que "el cable dice que no" —, solo que acá el caso "no
 * la gobierna nadie" se resuelve a `false` en vez de a `true`.
 */
export function isAutomaticValveActive(
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
    return false;
  }
  const wired = graph.edges.some((edge) => edge.to === node.id);
  return wired ? outputOf(node.id) : false;
}

export interface AutomaticValveDeps {
  readonly registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>;
  readonly floorplan: ShipFloorplan;
  readonly isInstancePowered: (instanceId: PlacedComponentInstanceId) => boolean;
  readonly outputOf: (nodeId: SignalNodeId) => boolean;
}

export interface ActiveValve {
  readonly instanceId: PlacedComponentInstanceId;
  readonly sectionId: SectionId;
}

/**
 * Qué válvulas están vertiendo y sobre qué sección.
 *
 * Vierten sobre SU PROPIA sección y no sobre una elegida: la válvula es una
 * pieza física puesta en un lugar del plano, y lo que suelta cae donde está.
 * Es la diferencia con la tarea `apply-substance`, que lleva un `sectionId`
 * explícito porque ahí hay un tripulante que CAMINA con el bidón hasta donde
 * se le dijo.
 */
export function activeAutomaticValves(
  blueprint: Blueprint,
  deps: AutomaticValveDeps,
): ReadonlyArray<ActiveValve> {
  const active: ActiveValve[] = [];
  for (const placed of blueprint.placedComponents) {
    if (placed.condition !== "ok") {
      continue;
    }
    const definition = deps.registry.get(placed.componentDefinitionId);
    if (!definition || !isAutomaticValveDefinition(definition.data)) {
      continue;
    }
    if (
      !isAutomaticValveActive(
        placed.instanceId,
        blueprint.signalGraph,
        deps.isInstancePowered,
        deps.outputOf,
      )
    ) {
      continue;
    }
    const sectionId = sectionContainingCell(deps.floorplan, placed.placement.position)?.id;
    if (sectionId) {
      active.push({ instanceId: placed.instanceId, sectionId });
    }
  }
  return active;
}
