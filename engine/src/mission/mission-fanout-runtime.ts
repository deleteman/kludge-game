import type { EntityRegistry } from "../composition/entity-registry.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import { allocateEmitterFanout } from "../signals/emitter-fanout.js";
import type { EmitterFanoutResult, EmitterFanoutStatus } from "../signals/emitter-fanout.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { MutableShipState } from "./mutable-ship-state.js";

/**
 * El triaje de fan-out de señal, vivo durante la misión (14a-4, ronda 2 de
 * playtest).
 *
 * `allocateEmitterFanout` es puro y no tiene por qué correr más de una vez por
 * montaje, pero lo consultan tres consumidores por tick y desde capas que no se
 * conocen entre sí: la evaluación de señal (la compuerta por arista de
 * `MissionSignalRuntime`), la derivación de estado por instancia (el glifo
 * `unsignaled`) y los tooltips. Sin un punto único cada uno recalcularía —o
 * peor, uno miraría un reparto y otro uno distinto, y el plano diría que una
 * pieza recibe señal mientras el motor la tiene sacrificada.
 *
 * **No es un `Tickable`.** El reparto depende solo del blueprint, no del reloj:
 * se recalcula cuando el montaje cambia y no cada 16 ms. La invalidación es por
 * IDENTIDAD del blueprint —cada `queueConnect`/`queueDisconnect` produce uno
 * nuevo— igual que `MissionSignalRuntime.syncGraph` detecta el re-cableado.
 * Las prioridades entran en la comparación por separado porque el jugador puede
 * mover el dial sin tocar un solo cable.
 */
export class MissionFanoutRuntime {
  private cached?: EmitterFanoutResult;
  private cachedBlueprint?: Blueprint;
  private cachedPriorities?: Blueprint["powerState"]["instancePriorities"];

  constructor(
    private readonly shipState: MutableShipState,
    private readonly registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
  ) {}

  private current(): EmitterFanoutResult {
    const blueprint = this.shipState.get();
    const priorities = blueprint.powerState.instancePriorities;
    if (this.cached && this.cachedBlueprint === blueprint && this.cachedPriorities === priorities) {
      return this.cached;
    }
    this.cached = allocateEmitterFanout(blueprint, this.registry, priorities);
    this.cachedBlueprint = blueprint;
    this.cachedPriorities = priorities;
    return this.cached;
  }

  /** ¿Esta pieza quedó sin señal porque quien la alimenta no da abasto? */
  isInstanceSignalStarved(instanceId: PlacedComponentInstanceId): boolean {
    return this.current().starvedInstanceIds.has(instanceId);
  }

  /**
   * Los NÚMEROS del hambre de una pieza, o `undefined` si recibe señal. Lo
   * accionable no es "no recibe señal" sino cuánta demanda cuelga de su
   * alimentador contra cuánto sostiene — mismo criterio que el detalle de
   * `unpowered`, que sin sus dos números describía el síntoma y no la salida.
   *
   * Con varios alimentadores se reporta el MÁS AJUSTADO (mayor exceso): es el
   * que hay que aliviar para que la pieza vuelva.
   */
  starvationOf(
    instanceId: PlacedComponentInstanceId,
  ): { readonly demand: number; readonly capacity: number } | undefined {
    const result = this.current();
    if (!result.starvedInstanceIds.has(instanceId)) return undefined;

    const blueprint = this.shipState.get();
    const ownerOfNode = new Map<SignalNodeId, PlacedComponentInstanceId>(
      blueprint.signalGraph.nodes.map((node) => [node.id, node.ownerRef]),
    );
    let worst: EmitterFanoutStatus | undefined;
    for (const edge of blueprint.signalGraph.edges) {
      if (ownerOfNode.get(edge.to) !== instanceId) continue;
      const status = result.bySourceNode.get(edge.from);
      if (!status) continue;
      if (!worst || status.demand - status.capacity > worst.demand - worst.capacity) {
        worst = status;
      }
    }
    return worst ? { demand: worst.demand, capacity: worst.capacity } : undefined;
  }

  /** Estado de UNA salida, para el tooltip de la pieza que la tiene. */
  statusOfSourceNode(nodeId: SignalNodeId): EmitterFanoutStatus | undefined {
    return this.current().bySourceNode.get(nodeId);
  }
}
