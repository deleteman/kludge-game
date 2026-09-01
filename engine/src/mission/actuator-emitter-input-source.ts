import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import { isActuatorOutputNode } from "../workbench/derive-signal-nodes.js";
import type { EmitterInputSource } from "./mission-signal-runtime.js";
import type { MutableShipState } from "./mutable-ship-state.js";

/**
 * ¿Este actuador está actuando AHORA MISMO? (Subfase 14a-4, ronda 1 de playtest).
 *
 * Callback angosto y por instancia, mismo molde que el `atmosphereOf` del resto
 * de los runtimes: quien lo implementa conoce el mundo (para una puerta, el
 * `MissionDoorRuntime`), y este archivo no conoce ningún runtime concreto.
 *
 * `undefined` significa **"esta clase de actuador todavía no sabe reportar su
 * estado"**, y es distinto de `false`. Ver el docblock de `actuatorEmitterInputs`.
 */
export type ActuatorActivityReader = (
  instanceId: PlacedComponentInstanceId,
) => boolean | undefined;

/**
 * `EmitterInputSource` que resuelve los nodos de SALIDA de un actuador contra su
 * estado real (Subfase 14a-4, ronda 1 de playtest).
 *
 * Pedido del operador: "cada vez que un ACT se activa, debería emitir señal, es
 * una buena forma de conectar triggers y encolar efectos". La decisión de diseño
 * que lo acompaña —y que este archivo existe para sostener— es que lo que emite
 * es el **estado REAL del actuador, no la orden que lo gobierna**: una puerta a
 * la que la señal le ordena abrirse pero está trabada, o sin motor, **no emite**.
 * Encadenar "cuando ESTA puerta se abrió → hacé aquello" solo sirve si la señal
 * describe el mundo; si repitiera la orden, sería un cable que miente en
 * exactamente los casos en que el jugador necesita la verdad.
 *
 * Mismo molde que `temperatureAwareEmitterInputs`/`pressureAwareEmitterInputs`:
 * envoltorio parcial que solo pisa los nodos que sabe resolver y deja el resto
 * de `base()` intacto.
 *
 * **Actuadores sin lector**: un motor o una válvula no tienen todavía un runtime
 * del que leer "estoy actuando". Sus salidas se resuelven a `false` en vez de
 * dejarlas caer en el fail-open de `allEmittersActive`, que las dejaría
 * permanentemente disparadas — que es exactamente la deuda #40 (15 de 17
 * `triggerType` de emisor siempre activos) y el bug que 14a-1 tuvo que arreglar
 * en el sensor térmico. Un cable que sale de una válvula no hace nada todavía,
 * y eso es honesto; uno que emite `true` para siempre es una mentira.
 */
export function actuatorEmitterInputs(
  shipState: MutableShipState,
  isActuatorActive: ActuatorActivityReader,
  base: EmitterInputSource,
): EmitterInputSource {
  return () => {
    const inputs = new Map<SignalNodeId, boolean>(base());
    for (const node of shipState.get().signalGraph.nodes) {
      if (node.role !== "emitter" || !isActuatorOutputNode(node.id)) {
        continue;
      }
      inputs.set(node.id, isActuatorActive(node.ownerRef as PlacedComponentInstanceId) ?? false);
    }
    return inputs;
  };
}
