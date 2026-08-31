import type { EntityRegistry } from "../composition/entity-registry.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import { downstreamNodes } from "../signals/graph-traversal.js";
import { componentPowerDraw } from "./component-power-draw.js";

/**
 * Carga eléctrica REAL que atraviesa un conductor (Subfase 14a-2).
 *
 * Hasta acá la única fuente de `load` era `CrisisDefinition.scriptedOverloads`:
 * un número de guion, o sea que la sobrecarga solo podía ocurrir donde el
 * contenido la hubiera puesto a mano. Decisión del operador en la planificación
 * de 14a-2: **la sobrecarga tiene que emerger de lo que el jugador cablea**, no
 * de un guion. Esto es lo que la deriva.
 *
 * Definición: la carga de un conductor es la suma del `powerDraw` de las piezas
 * que cuelgan de él **aguas abajo** en el grafo de señal. Cablear una cuarta
 * pieza a un cable ya cargado es lo que lo revienta — y con el conductor frío o
 * caliente su capacidad efectiva baja, así que un montaje que era seguro deja de
 * serlo sin que la carga haya cambiado (`failure/thermal-conductivity-rule.ts`).
 *
 * **Unidades**: las mismas de `powerDraw` (1 = pieza de señal, 2 = actuador,
 * 3 = equipamiento pesado). `COND.maxCapacity` se re-escaló a esta magnitud en
 * el catálogo atómico por esto mismo: antes valía 100 contra consumos de 1-3,
 * dos números que compilaban igual y medían cosas distintas.
 *
 * No conoce temperatura, desgaste ni reparto de energía: devuelve la demanda
 * cableada. Quién la compara contra una capacidad —y con qué factores— es
 * `MissionOverloadRuntime`.
 */
export function conductorElectricalLoad(
  blueprint: Blueprint,
  instanceId: PlacedComponentInstanceId,
  registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): number {
  const reached = new Set<PlacedComponentInstanceId>();
  for (const node of blueprint.signalGraph.nodes) {
    if (node.ownerRef !== instanceId) {
      continue;
    }
    for (const downstreamId of downstreamNodes(blueprint, node.id)) {
      const owner = blueprint.signalGraph.nodes.find((candidate) => candidate.id === downstreamId)?.ownerRef;
      // El propio conductor no se cuenta como carga de sí mismo: `COND(E)`
      // conduce, no consume (mismo criterio que su ausencia de
      // `POWER_DRAW_BY_COMPONENT`, y por eso su `powerDraw` es 0 de todas
      // formas — el guard es para que el invariante quede escrito).
      if (owner && owner !== instanceId) {
        reached.add(owner);
      }
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
