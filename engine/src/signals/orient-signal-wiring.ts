import type { SignalGraph } from "./signal-graph.types.js";
import type { SignalNodeId } from "./signal-node.types.js";

export class SignalWiringDirectionError extends Error {}

/**
 * Orienta un cable a partir de los dos nodos que el jugador eligió, sin
 * depender del ORDEN en que los clickeó (Subfase 13h, ronda 2 de playtest).
 *
 * Hasta acá el orden de clicks ERA la dirección: el primer nodo quedaba como
 * `from` y el segundo como `to`. Y `validateSignalGraphIntegrity` no valida
 * roles —solo ids duplicados y extremos colgantes—, así que cablear
 * puerta→sensor se aceptaba en silencio, la tarea se completaba, el tripulante
 * caminaba hasta allá, y la arista quedaba escrita apuntando al revés. Nada
 * volvía a leerla nunca. Un no-op perfecto: cuesta tiempo de juego y no falla.
 *
 * Una señal fluye de quien la produce a quien la consume, y eso no es una
 * preferencia de UI sino una regla del dominio — por eso vive acá y no en
 * `/game`. Un conductor puede ser cualquiera de los dos extremos, así que con
 * un conductor de por medio se respeta el orden de clicks.
 */
export function orientSignalWiring<TOwnerRef>(
  graph: SignalGraph<TOwnerRef>,
  firstNodeId: SignalNodeId,
  secondNodeId: SignalNodeId,
): { readonly from: SignalNodeId; readonly to: SignalNodeId } {
  const first = graph.nodes.find((node) => node.id === firstNodeId);
  const second = graph.nodes.find((node) => node.id === secondNodeId);
  if (!first || !second) {
    throw new SignalWiringDirectionError(
      `Cannot orient wiring between unknown nodes: ${firstNodeId} -> ${secondNodeId}`,
    );
  }

  // Dos consumidores no tienen nada que decirse, y dos emisores tampoco: la
  // salida de un emisor la fija el mundo (un sensor, una presión), así que
  // ninguna arista puede gobernarla. En los dos casos el cable sería un adorno.
  if (first.role === "receptor" && second.role === "receptor") {
    throw new SignalWiringDirectionError("Two receptors cannot be wired to each other");
  }
  if (first.role === "emitter" && second.role === "emitter") {
    throw new SignalWiringDirectionError("Two emitters cannot be wired to each other");
  }

  // El único caso que hay que dar vuelta: se clickeó primero el consumidor.
  if (first.role === "receptor") {
    return { from: secondNodeId, to: firstNodeId };
  }
  return { from: firstNodeId, to: secondNodeId };
}
