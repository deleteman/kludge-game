import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import { isCompositeEntity } from "../composition/composable-entity.types.js";
import type { CrewTask, InstallTaskPayload, TaskEffect, TaskEffectResult } from "../tasks/task.types.js";
import { deriveSignalNodes } from "../workbench/derive-signal-nodes.js";
import { assertSignalWiringReachable, mergeInstalledSignalGraph, wireExternalPort } from "../workbench/port-wiring.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { MutableShipState } from "./mutable-ship-state.js";
import { consumeStock, creditStock } from "../inventory/inventory-ledger.js";
import type { MutableAtomicStock } from "../inventory/mutable-atomic-stock.js";

type ComponentRegistry = EntityRegistry<ComponentId, PhysicalComponentDefinition>;

export class InsufficientStockError extends Error {}

/**
 * `TaskEffect` real (Fase 10b): la mutación física que Fase 6 dejó como hook
 * vacío. Solo maneja `dismantle`/`install`/`connect` — los tipos que el
 * capítulo 1 ejercita (`tasks/task.types.ts::TaskPayload`); una tarea sin
 * payload (`go-to`, o un tipo aún sin payload definido) es un no-op aquí,
 * consistente con que el scheduler ya resuelve la ubicación lógica de
 * `go-to` internamente (`task-scheduler.ts::completeTask`).
 */
export function createShipTaskEffect(
  shipState: MutableShipState,
  componentRegistry: ComponentRegistry,
  atomicStock: MutableAtomicStock,
  // Opcional para no romper los tests unitarios que ejercitan `connect` con
  // nodos sintéticos sin geometría: cuando el llamador real (misión) lo pasa,
  // el `connect` valida la regla de conductos `senal` (Fase 11f); sin él, se
  // comporta como antes. El preview del controller de `/game` es el gate de UX
  // que evita encolar un cable inalcanzable, así que en juego real nunca llega
  // acá un `connect` que viole la regla — esto es defensa en profundidad.
  floorplan?: ShipFloorplan,
): TaskEffect {
  return (task: CrewTask): TaskEffectResult | void => {
    const payload = task.payload;
    if (!payload) {
      return;
    }
    if (payload.kind !== task.type) {
      throw new Error(
        `Task ${task.id}: type "${task.type}" does not match payload kind "${payload.kind}"`,
      );
    }

    switch (payload.kind) {
      case "dismantle": {
        const definition = componentRegistry.get(
          shipState.get().placedComponents.find((entry) => entry.instanceId === payload.instanceId)
            ?.componentDefinitionId as ComponentId,
        );
        if (definition && isCompositeEntity(definition)) {
          let nextStock = atomicStock.get();
          for (const ingredient of definition.recipe.ingredients) {
            nextStock = creditStock(nextStock, ingredient.ref, ingredient.quantity);
          }
          atomicStock.set(nextStock);
          shipState.set(dismantleInstance(shipState.get(), payload.instanceId));
          return {
            obtained: definition.recipe.ingredients.map((ingredient) => ({
              componentId: ingredient.ref,
              quantity: ingredient.quantity,
            })),
          };
        }
        shipState.set(dismantleInstance(shipState.get(), payload.instanceId));
        return;
      }
      case "install": {
        const definition = componentRegistry.get(payload.componentDefinitionId);
        if (definition && !isCompositeEntity(definition)) {
          const consumed = consumeStock(atomicStock.get(), payload.componentDefinitionId, 1);
          if (!consumed) {
            throw new InsufficientStockError(
              `No hay stock de "${payload.componentDefinitionId}" para instalar (task ${task.id})`,
            );
          }
          atomicStock.set(consumed);
        }
        shipState.set(installInstance(shipState.get(), payload, componentRegistry));
        return;
      }
      case "connect":
        if (floorplan) {
          assertSignalWiringReachable(floorplan, shipState.get().signalGraph, payload.fromNodeId, payload.toNodeId);
        }
        shipState.set(
          wireExternalPort(shipState.get(), payload.edgeId, payload.fromNodeId, payload.toNodeId, payload.toPort),
        );
        return;
      case "analyze-substance":
        // Tarea de "revelar", no de mutar: no toca `shipState`/`atomicStock`.
        return { analyzedSubstanceId: payload.substanceId };
    }
  };
}

/**
 * Desmonta una instancia y limpia todo lo que la referenciaba (nodos de
 * señal propios, edges que colgaban de esos nodos, contenido de reservorio)
 * — sin esto, el `Blueprint` resultante queda con referencias colgantes que
 * `assertBlueprintIntegrity` rechazaría en el primer guardado.
 */
function dismantleInstance(ship: Blueprint, instanceId: PlacedComponentInstanceId): Blueprint {
  const removedNodeIds = new Set(
    ship.signalGraph.nodes.filter((node) => node.ownerRef === instanceId).map((node) => node.id),
  );
  return {
    ...ship,
    placedComponents: ship.placedComponents.filter((entry) => entry.instanceId !== instanceId),
    reservoirContents: ship.reservoirContents.filter(
      (entry) => entry.componentInstanceId !== instanceId,
    ),
    signalGraph: {
      nodes: ship.signalGraph.nodes.filter((node) => node.ownerRef !== instanceId),
      edges: ship.signalGraph.edges.filter(
        (edge) => !removedNodeIds.has(edge.from) && !removedNodeIds.has(edge.to),
      ),
    },
  };
}

/**
 * Instala una instancia nueva con `condition: "ok"`. Materializa sus nodos de
 * señal derivándolos de las propiedades funcionales de la definición (11c.0,
 * `deriveSignalNodes`) — sin esto, una pieza instalada en runtime quedaba sin
 * nodos en `signalGraph` y era invisible para el modo cableado (que busca
 * nodos por posición). NO cablea puertos externos: crear los nodos ≠
 * conectarlos ("instalar no conecta automáticamente", GDD 10.1 párrafo 7); el
 * jugador los cablea después con una tarea `connect`.
 *
 * La validación de espacio/forma de sección es de la UI al planificar la tarea
 * (Fase 10d), no de este efecto: para cuando la tarea se completa, la
 * colocación ya fue aceptada por el jugador.
 */
function installInstance(
  ship: Blueprint,
  payload: InstallTaskPayload,
  registry: ComponentRegistry,
): Blueprint {
  const withComponent: Blueprint = {
    ...ship,
    placedComponents: [
      ...ship.placedComponents,
      {
        instanceId: payload.instanceId,
        componentDefinitionId: payload.componentDefinitionId,
        placement: payload.placement,
        condition: "ok",
      },
    ],
  };

  const definition = registry.get(payload.componentDefinitionId);
  const derivedNodes = deriveSignalNodes(
    definition?.data.functional,
    payload.instanceId,
    payload.placement,
  );
  if (derivedNodes.length === 0) {
    return withComponent;
  }

  return mergeInstalledSignalGraph(withComponent, { nodes: derivedNodes, edges: [] });
}
