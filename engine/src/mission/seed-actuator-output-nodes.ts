import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { SignalNode } from "../signals/signal-node.types.js";
import { deriveSignalNodes, isActuatorOutputNode } from "../workbench/derive-signal-nodes.js";

/**
 * Siembra los nodos de SALIDA de actuador que falten (Subfase 14a-4, ronda 1).
 *
 * `deriveSignalNodes` corre al INSTALAR una pieza y al sembrar las puertas del
 * plano, no al cargar una partida — y los nodos se persisten en el `Blueprint`.
 * O sea que sin esto, toda puerta de una partida ya empezada se quedaría sin su
 * nodo de salida y la mecánica nueva sería invisible **justo para quien ya está
 * jugando**, que es el peor reparto posible.
 *
 * Va acá y no en `blueprint-serializer.ts` porque hace falta el registry para
 * saber qué piezas tienen `ACT`, y el serializador no conoce el catálogo (ni
 * debe: su migración es de forma, no de contenido).
 *
 * **Idempotente**: si el nodo ya existe no se duplica, así que puede correr en
 * cada arranque de misión sin acumular basura. Devuelve el mismo `Blueprint`
 * por identidad si no hay nada que sembrar, para que los consumidores que
 * comparan por referencia (el `syncGraph` de `MissionSignalRuntime`) no
 * reconstruyan el evaluador de gusto.
 */
export function seedActuatorOutputNodes(
  blueprint: Blueprint,
  registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): Blueprint {
  const existing = new Set(blueprint.signalGraph.nodes.map((node) => node.id));
  const added: SignalNode<PlacedComponentInstanceId>[] = [];

  for (const instance of blueprint.placedComponents) {
    const definition = registry.get(instance.componentDefinitionId);
    if (!definition?.data.functional?.some((property) => property.tag === "ACT")) {
      continue;
    }
    // Se re-deriva con la MISMA función que instala, en vez de deducir cuál de
    // los receptores de la pieza vino del `ACT`: por el id no se distingue (un
    // `REC` y un `ACT` producen los dos `role: "receptor"`), y re-implementar el
    // criterio acá sería una segunda copia que se desincroniza en cuanto cambie
    // el orden de derivación.
    for (const derived of deriveSignalNodes(definition.data.functional, instance.instanceId, instance.placement)) {
      if (!isActuatorOutputNode(derived.id) || existing.has(derived.id)) {
        continue;
      }
      existing.add(derived.id);
      added.push(derived);
    }
  }

  if (added.length === 0) {
    return blueprint;
  }
  return {
    ...blueprint,
    signalGraph: {
      ...blueprint.signalGraph,
      nodes: [...blueprint.signalGraph.nodes, ...added],
    },
  };
}
