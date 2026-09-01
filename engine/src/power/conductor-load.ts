import type { EntityRegistry } from "../composition/entity-registry.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import { activeSignalEdges } from "../signals/active-signal-graph.js";
import { downstreamNodes } from "../signals/graph-traversal.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import { componentPowerDraw } from "./component-power-draw.js";


/**
 * Carga eléctrica que atraviesa un CABLE tendido por el jugador (Subfase 14a-4).
 *
 * Hasta 14a-2 la única fuente de `load` era `CrisisDefinition.scriptedOverloads`:
 * un número de guion, o sea que la sobrecarga solo podía ocurrir donde el
 * contenido la hubiera puesto a mano. Decisión del operador en la planificación
 * de 14a-2: **la sobrecarga tiene que emerger de lo que el jugador cablea**.
 * 14a-2 lo derivó sobre una pieza `COND(E)` colocada en una celda, y la ronda 1
 * de playtest mostró que nadie tiene motivo para colocar una — el conductor real
 * de la nave es la arista que dibuja el jugador. 14a-4 mueve la cuenta a su
 * sujeto correcto y borra la versión por instancia, que se quedó sin llamadores.
 *
 * Definición: la carga de un cable es la suma del `powerDraw` de las piezas que
 * cuelgan de él **aguas abajo**. Cablear una cuarta pieza a un cable ya cargado
 * es lo que lo revienta — y con el cable frío o caliente su capacidad efectiva
 * baja, así que un montaje que era seguro deja de serlo sin que la carga haya
 * cambiado (`failure/thermal-conductivity-rule.ts`).
 *
 * **Unidades**: las mismas de `powerDraw` (1 = pieza de señal, 2 = actuador,
 * 3 = equipamiento pesado). `COND.maxCapacity` se re-escaló a esta magnitud en
 * el catálogo en 14a-2 por esto mismo: antes valía 100 contra consumos de 1-3,
 * dos números que compilaban igual y medían cosas distintas.
 *
 * No conoce temperatura, desgaste ni reparto de energía: devuelve la demanda
 * cableada. Quién la compara contra una capacidad —y con qué factores— es
 * `MissionOverloadRuntime`.
 *
 * Diferencia deliberada con la versión por instancia de 14a-2: acá **sí** cuenta el dueño
 * de `edge.to`. Ese consumidor es precisamente lo que este cable alimenta; si se
 * excluyera, un cable con una sola pieza colgada mediría carga 0 y nunca se
 * podría sobrecargar. Lo que se excluye es el dueño de `edge.from` (la fuente
 * está aguas arriba, no cuelga de acá).
 *
 * Recorre el grafo ACTIVO: un cable quemado aguas abajo ya no conduce, así que
 * lo que colgaba de él deja de pesar sobre este. Quemar un cable DESCARGA a sus
 * vecinos — la cadena de fallos se propaga y se detiene sola, en vez de ser una
 * lista de eventos independientes.
 */
export function edgeElectricalLoad(
  blueprint: Blueprint,
  edgeId: SignalEdgeId,
  registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): number {
  const edges = activeSignalEdges(blueprint);
  const edge = edges.find((candidate) => candidate.id === edgeId);
  if (!edge) {
    // Arista inexistente o ya quemada: no conduce nada.
    return 0;
  }

  const reached = new Set<PlacedComponentInstanceId>();
  for (const downstreamId of downstreamNodes(blueprint, edge.to, edges)) {
    const owner = blueprint.signalGraph.nodes.find((candidate) => candidate.id === downstreamId)?.ownerRef;
    if (owner) {
      reached.add(owner);
    }
  }

  let load = 0;
  for (const placed of blueprint.placedComponents) {
    if (!reached.has(placed.instanceId)) {
      continue;
    }
    load += componentPowerDraw(registry.get(placed.componentDefinitionId));
  }
  return load;
}
