import type { DoorRuntime } from "../doors/door.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SignalGraph } from "../signals/signal-graph.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";

/**
 * Qué le ORDENA el cable a esta puerta (Subfase 13h, ronda 2 de playtest).
 *
 * Vive en `/engine` y no como un closure dentro de `MissionRuntime` porque no
 * es pegamento: es la regla que decide cuándo una puerta está gobernada por una
 * señal, y estaba mal de una forma que ningún test podía ver porque no había
 * nada que testear.
 *
 * Los tres valores significan cosas distintas y ninguno es intercambiable:
 *  - `undefined` — nadie la gobierna: sigue en `auto`. Es el caso de la puerta
 *    sin cable, y también el de la puerta SIN MOTOR: un motor muerto no oye el
 *    cable, que no es lo mismo que recibir la orden de cerrar. Antes este caso
 *    devolvía `false` porque `MissionSignalRuntime.outputOf` fuerza a `false` la
 *    salida de un nodo cuya instancia no está alimentada —semántica correcta
 *    para un LED, una lámpara sin energía está apagada— pero el dueño del nodo
 *    receptor de una puerta ES la puerta. `SignalDoorRule` lo leía como "cerrá",
 *    la dejaba cerrada en override y de paso bloqueaba el pathfinding: un
 *    problema de energía disfrazado de orden deliberada.
 *  - `true` — abrir, en override.
 *  - `false` — cerrar, en override. Solo con un cable REAL y con motor.
 */
export function doorSignalOutput(
  door: DoorRuntime,
  graph: SignalGraph<PlacedComponentInstanceId>,
  isInstancePowered: (instanceId: PlacedComponentInstanceId) => boolean,
  outputOf: (nodeId: SignalNodeId) => boolean,
): boolean | undefined {
  if (!isInstancePowered(door.instanceId)) {
    return undefined;
  }
  const node = graph.nodes.find(
    (candidate) => candidate.ownerRef === door.instanceId && candidate.role === "receptor",
  );
  if (!node) {
    return undefined;
  }
  const wired = graph.edges.some((edge) => edge.to === node.id);
  return wired ? outputOf(node.id) : undefined;
}
