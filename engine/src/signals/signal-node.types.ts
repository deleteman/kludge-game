import type { Brand } from "../shared/brand.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import type { SignalBehavior } from "./signal-behavior.types.js";

export type SignalNodeId = Brand<string, "SignalNodeId">;

/**
 * Alcance exacto de Fase 1 (ORDEN_DE_TRABAJO.md): emisor/receptor/conductor.
 * Actuadores, reservorios y estructura son propiedades del componente físico
 * (properties/functional.types.ts), no roles del grafo de señales.
 */
export type SignalNodeRole = "emitter" | "receptor" | "conductor";

/**
 * `TOwnerRef` es genérico para no acoplar `signals/` a `components/`: en
 * tests unitarios puede ser un string sintético; en un blueprint real es
 * `PlacedComponentInstanceId` (qué instancia de componente expone este nodo).
 *
 * Incluye posición de grid desde ya (decisión del operador), anticipando que
 * el plano físico (Fase 5) y la mesa de creación (Fase 7) comparten esa
 * lógica (GDD 10.1).
 */
export interface SignalNode<TOwnerRef = string> {
  readonly id: SignalNodeId;
  readonly role: SignalNodeRole;
  readonly position: GridPosition;
  readonly ownerRef: TOwnerRef;
  /**
   * Comportamiento lógico del nodo (GDD 5.6), añadido en Fase 2. Opcional y
   * retrocompatible: un nodo sin `behavior` se evalúa como passthrough (OR de
   * sus entradas). Los nodos `emitter` ignoran el behavior — su salida la
   * fija el mundo (un sensor que dispara), no la topología del grafo.
   */
  readonly behavior?: SignalBehavior;
}
