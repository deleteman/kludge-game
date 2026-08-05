import type {
  Blueprint,
  PlacedComponentInstance,
  PlacedComponentInstanceId,
} from "../blueprint/blueprint.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { CrewActor, CrewActorId } from "../crew/crew-actor.types.js";
import type { CrewSpecialty } from "../crew/crew-specialty.types.js";
import type { CrewTier } from "../crew/crew-tier.types.js";
import type { StructuralResistanceLevel } from "../properties/material.types.js";
import type { RandomSource } from "../simulation/random-source.js";
import { DEFAULT_WEAR } from "../wear/wear.types.js";
import { effectiveResistance } from "../wear/effective-resistance.js";
import { wearAfterDismantle } from "../wear/dismantle-wear.js";
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
/**
 * Dependencias opcionales de 13c. Van juntas porque las tres sirven al mismo
 * cálculo (¿con qué desgaste vuelve la pieza al stock?) y porque sin ellas el
 * efecto se comporta EXACTAMENTE como antes de 13c — sin degradar nada. Eso
 * mantiene compilando los tests unitarios que ejercitan desmontaje sin actor.
 */
export interface DismantleWearDeps {
  /** Azar inyectado; sin él el desmontaje nunca degrada (ver `wear/dismantle-wear.ts`). */
  readonly random?: RandomSource;
  /**
   * Resuelve el actor de la tarea. Hasta 13c el `TaskEffect` recibía la
   * `CrewTask` (con su `actorId`) pero no tenía forma de llegar al tripulante,
   * así que no podía leer su tier/especialidad — es lo único que faltaba para
   * aplicar la tabla de GDD §6.5.
   */
  readonly actorOf?: (actorId: CrewActorId) => CrewActor | undefined;
}

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
  wearDeps: DismantleWearDeps = {},
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
        const instance = shipState
          .get()
          .placedComponents.find((entry) => entry.instanceId === payload.instanceId);
        const definition = componentRegistry.get(instance?.componentDefinitionId as ComponentId);
        // Desgaste con el que la pieza vuelve al stock (13c): tirada por tier
        // del especialista contra la RE efectiva que la pieza tiene AHORA. La
        // consecuencia de canibalizar deja de ser gratis — desmontar y volver
        // a instalar ya no devuelve una pieza de fábrica (Pilar 2).
        const recoveredWear = instance
          ? wearAfterDismantle(
              {
                current: instance.wear,
                ...resolveActorTraits(task.actorId, wearDeps.actorOf),
                ...degradableResistance(instance, definition),
              },
              wearDeps.random,
            )
          : DEFAULT_WEAR;
        // ¿Este desmontaje concreto empeoró la pieza? (fix de playtest ronda 1)
        const degraded = instance ? recoveredWear !== instance.wear : false;

        if (definition && isCompositeEntity(definition)) {
          let nextStock = atomicStock.get();
          for (const ingredient of definition.recipe.ingredients) {
            // El desgaste del compuesto se propaga a TODAS sus piezas: si el
            // ensamblaje se maltrató al abrirlo, lo que sale de él también.
            nextStock = creditStock(nextStock, ingredient.ref, ingredient.quantity, recoveredWear);
          }
          atomicStock.set(nextStock);
          shipState.set(dismantleInstance(shipState.get(), payload.instanceId));
          return {
            obtained: definition.recipe.ingredients.map((ingredient) => ({
              componentId: ingredient.ref,
              quantity: ingredient.quantity,
              wear: recoveredWear,
              degraded,
            })),
          };
        }
        shipState.set(dismantleInstance(shipState.get(), payload.instanceId));
        // Pieza ATÓMICA (12c.7, obs #4): se recupera al stock como su propia
        // pieza — igual que un compuesto recupera sus ingredientes. Antes se
        // destruía sin acreditar, así que el desmontaje no daba coleccionable ni
        // notificación.
        if (definition && instance) {
          atomicStock.set(
            creditStock(atomicStock.get(), instance.componentDefinitionId, 1, recoveredWear),
          );
          return {
            obtained: [
              { componentId: instance.componentDefinitionId, quantity: 1, wear: recoveredWear, degraded },
            ],
          };
        }
        return;
      }
      case "install": {
        const definition = componentRegistry.get(payload.componentDefinitionId);
        const wear = payload.wear ?? DEFAULT_WEAR;
        if (definition && !isCompositeEntity(definition)) {
          const consumed = consumeStock(atomicStock.get(), payload.componentDefinitionId, 1, wear);
          if (!consumed) {
            throw new InsufficientStockError(
              `No hay stock de "${payload.componentDefinitionId}" (${wear}) para instalar (task ${task.id})`,
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
 * Tier/especialidad del actor que ejecuta la tarea. Sin `actorOf` (llamadores
 * previos a 13c y tests sintéticos) cae al peor caso conocido: novato sin
 * afinidad. Da igual en la práctica, porque sin `random` no se llega a tirar.
 */
function resolveActorTraits(
  actorId: CrewActorId,
  actorOf?: (actorId: CrewActorId) => CrewActor | undefined,
): { readonly tier: CrewTier; readonly specialty: CrewSpecialty } {
  const actor = actorOf?.(actorId);
  // Sin actor conocido no hay afinidad de Ingeniero: se asume una especialidad
  // cualquiera distinta de `ingeniero` para no regalar el bonus de GDD §6.6.
  return { tier: actor?.tier ?? "novato", specialty: actor?.specialty ?? "seguridad" };
}

/**
 * RE efectiva de la pieza como argumento de la tirada, solo si es un nivel
 * degradable (A/M/B). Una pieza ya en `"fallo"` no aporta penalización extra:
 * `atomicRecoveryFraction` solo distingue "B o no B" (GDD §6.5).
 */
function degradableResistance(
  instance: PlacedComponentInstance,
  definition: PhysicalComponentDefinition | undefined,
): { readonly effectiveResistance?: StructuralResistanceLevel } {
  const resistance = effectiveResistance(
    definition?.data.material?.RE,
    instance.wear,
    instance.structuralResistanceOverride,
  );
  return resistance && resistance !== "fallo" ? { effectiveResistance: resistance } : {};
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
        // La pieza entra con el desgaste del bucket que se consumió (13c):
        // antes se hardcodeaba `"ok"`/sin historia, que era exactamente el
        // punto donde el ciclo canibalizar→reinstalar se volvía gratuito.
        wear: payload.wear ?? DEFAULT_WEAR,
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
