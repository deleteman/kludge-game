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
 *
 * **Ronda 2 de playtest de 14a-4**: cae el rechazo receptor→receptor. Su
 * argumento ("dos consumidores no tienen nada que decirse") era falso en este
 * motor: `SignalEvaluator.tick` calcula la salida de TODO nodo que no sea
 * emisor a partir de sus entradas, así que un `chip-circuito-generico` —que
 * solo declara `REC`— ya es un relé por construcción. Lo único que impedía
 * cablear `sensor → chip → LEDs` era esta guarda, y sin ese montaje la carga de
 * un cable nunca puede acumularse: en estrella cada cable lleva una sola pieza.
 *
 * Es la MISMA guarda que en la ronda 1 impidió que una puerta emitiera, y que
 * entonces se rodeó dándole al `ACT` un nodo emisor de salida en vez de
 * corregirla. Ese nodo se queda —un `ACT` emite su estado REAL, no el
 * passthrough de sus entradas, son dos semánticas distintas— pero el agujero
 * estaba acá.
 *
 * El rechazo **emisor→emisor sí es correcto** y se conserva: la salida de un
 * emisor la fija el mundo, ninguna arista puede gobernarla. Por eso la regla de
 * orientación es ahora "si el segundo extremo es emisor y el primero no, se da
 * vuelta" — que además arregla `conductor → emisor`, hasta acá aceptado tal
 * cual y escrito entrando a un emisor: otro no-op silencioso de los que 13h
 * vino a cerrar.
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

  // La salida de un emisor la fija el mundo (un sensor, una presión), así que
  // ninguna arista puede gobernarla: entre dos emisores el cable sería un
  // adorno. Es el único par que sigue siendo imposible.
  if (first.role === "emitter" && second.role === "emitter") {
    throw new SignalWiringDirectionError("Two emitters cannot be wired to each other");
  }

  // El único caso que hay que dar vuelta: se clickeó primero el consumidor y
  // segundo la fuente. Formulado sobre el SEGUNDO extremo (y no sobre "el
  // primero es receptor") para que cubra también `conductor → emisor`.
  if (second.role === "emitter") {
    return { from: secondNodeId, to: firstNodeId };
  }
  return { from: firstNodeId, to: secondNodeId };
}
