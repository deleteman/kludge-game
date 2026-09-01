import type { EntityRegistry } from "../composition/entity-registry.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { InstancePowerPriority } from "../power/power.types.js";
import { componentPowerDraw } from "../power/component-power-draw.js";
import { orderByPowerPriority } from "../power/power-allocation.js";
import { activeSignalEdges } from "./active-signal-graph.js";
import type { SignalNode, SignalNodeId } from "./signal-node.types.js";
import {
  ACTUATOR_OUTPUT_CAPACITY,
  DEFAULT_SIGNAL_OUTPUT_CAPACITY,
} from "./signal-output-parameters.js";
import { isActuatorOutputNode } from "../workbench/derive-signal-nodes.js";

/**
 * Triaje de la salida de una pieza (14a-4, ronda 2 de playtest).
 *
 * Toda salida sostiene una demanda limitada (`data.signalOutputCapacity`, ver
 * `signal-output-parameters.ts` para el porqué). Cuando el jugador le cuelga
 * más de lo que aguanta, lo que no entra **deja de recibir señal** — mismo
 * modelo que el triaje eléctrico de 13b, y a pedido explícito del operador:
 * "como con la energía, algunos receptores comienzan a dejar de recibir señal".
 * No es un fallo permanente: desconectar algo lo devuelve.
 *
 * **Quién sobrevive**: `orderByPowerPriority`, literalmente el mismo comparador
 * que `allocateComponentPower`. Decisión del operador — un solo dial de "qué me
 * importa más" gobierna energía y señal.
 *
 * **La demanda NO es transitiva, y esa es la decisión central de este módulo.**
 * Una salida paga solo por lo que cuelga DIRECTAMENTE de ella; lo que esas
 * piezas gobiernen a su vez lo pagan ellas, con su propia capacidad. Es lo que
 * hace de un `chip-circuito-generico` un relé de verdad: el sensor alimenta al
 * chip (1) y el chip alimenta al montaje entero (8), en vez de que el sensor
 * siga viendo los 9 a través suyo. Sin esta regla el relé no resuelve nada y el
 * jugador no tiene ninguna salida al problema — que fue exactamente lo que
 * mostró el primer test de este archivo cuando la demanda sí era transitiva.
 *
 * Es además la lectura física correcta: cada cable presenta en el terminal la
 * carga de su extremo, no la del circuito entero que haya del otro lado.
 *
 * **Por qué esto NO toca la carga del cable.** `edgeElectricalLoad` SÍ es
 * transitiva —un cable lleva la corriente de todo lo que cuelga de él, y por eso
 * el tronco de un relé se quema— y sigue contando lo CABLEADO, no lo que recibe
 * señal ahora. Si la carga bajara al sacrificar un consumidor, el cable se
 * descargaría, el consumidor volvería a entrar, la carga subiría otra vez: una
 * oscilación de un tick, visible como un parpadeo permanente. Son tres
 * preguntas distintas sobre el mismo montaje: qué cuelga de esta salida, qué
 * corriente atraviesa este cable, y quién recibe señal.
 */

export interface EmitterFanoutStatus {
  /** Cuántas piezas cuelgan directamente de esta salida. */
  readonly driven: number;
  /** Suma del `powerDraw` de esas piezas. */
  readonly demand: number;
  /** Cuánto puede sostener esta salida. */
  readonly capacity: number;
}

export interface EmitterFanoutResult {
  /** Piezas que NO reciben señal: ninguna salida que las alimenta las sostiene. */
  readonly starvedInstanceIds: ReadonlySet<PlacedComponentInstanceId>;
  /** Estado por NODO de salida — una pieza con `EM` + `ACT` tiene dos salidas y dos presupuestos. */
  readonly bySourceNode: ReadonlyMap<SignalNodeId, EmitterFanoutStatus>;
}

/**
 * Capacidad de UNA salida. La salida de un `ACT` (el nodo emisor que la ronda 1
 * le agregó a todo actuador) tiene la suya, más baja: emitir su estado es un
 * efecto secundario de actuar, no la función de la pieza. Por eso la capacidad
 * se resuelve por nodo y no por componente — una torreta (`EM` + `ACT`) tiene
 * dos salidas que no valen lo mismo.
 */
function capacityOfSourceNode(
  node: SignalNode<PlacedComponentInstanceId>,
  definition: PhysicalComponentDefinition | undefined,
): number {
  if (isActuatorOutputNode(node.id)) {
    return ACTUATOR_OUTPUT_CAPACITY;
  }
  return definition?.data.signalOutputCapacity ?? DEFAULT_SIGNAL_OUTPUT_CAPACITY;
}

export function allocateEmitterFanout(
  blueprint: Blueprint,
  registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
  priorities: ReadonlyArray<InstancePowerPriority> = [],
): EmitterFanoutResult {
  const edges = activeSignalEdges(blueprint);
  const instanceById = new Map(
    blueprint.placedComponents.map((instance) => [instance.instanceId, instance]),
  );
  const nodeById = new Map(blueprint.signalGraph.nodes.map((node) => [node.id, node]));

  const bySourceNode = new Map<SignalNodeId, EmitterFanoutStatus>();
  // Sostenida por AL MENOS UNA salida. Un respaldo redundante tiene que servir
  // de respaldo: si dos sensores gobiernan la misma puerta y solo uno la
  // sacrifica, la puerta sigue recibiendo señal del otro.
  const sustained = new Set<PlacedComponentInstanceId>();
  const governed = new Set<PlacedComponentInstanceId>();

  for (const node of blueprint.signalGraph.nodes) {
    // Lo que cuelga DIRECTAMENTE de esta salida, sin contar al propio dueño (un
    // cable de vuelta a la misma pieza no la alimenta) ni repetir una pieza a la
    // que lleguen dos cables desde el mismo nodo.
    const driven = new Set<PlacedComponentInstanceId>();
    for (const edge of edges) {
      if (edge.from !== node.id) continue;
      const owner = nodeById.get(edge.to)?.ownerRef;
      if (owner && owner !== node.ownerRef) driven.add(owner);
    }
    if (driven.size === 0) continue;

    const owner = instanceById.get(node.ownerRef);
    const capacity = capacityOfSourceNode(node, owner && registry.get(owner.componentDefinitionId));
    const drivenInstances = [...driven]
      .map((id) => instanceById.get(id))
      .filter((instance): instance is NonNullable<typeof instance> => instance !== undefined);

    let demand = 0;
    let remaining = capacity;
    for (const instance of orderByPowerPriority(drivenInstances, priorities)) {
      governed.add(instance.instanceId);
      const draw = componentPowerDraw(registry.get(instance.componentDefinitionId));
      demand += draw;
      // Una pieza sin consumo declarado no pesa sobre la salida y nunca se
      // sacrifica — mismo criterio que `allocateComponentPower` con `draw <= 0`,
      // y la retrocompatibilidad que evita que medio catálogo quede sin señal.
      if (draw <= 0 || remaining >= draw) {
        remaining -= Math.max(0, draw);
        sustained.add(instance.instanceId);
      }
    }

    bySourceNode.set(node.id, { driven: driven.size, demand, capacity });
  }

  const starvedInstanceIds = new Set<PlacedComponentInstanceId>();
  for (const instanceId of governed) {
    if (!sustained.has(instanceId)) starvedInstanceIds.add(instanceId);
  }
  return { starvedInstanceIds, bySourceNode };
}
