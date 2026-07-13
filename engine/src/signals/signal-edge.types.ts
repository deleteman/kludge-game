import type { Brand } from "../shared/brand.types.js";
import type { SignalNodeId } from "./signal-node.types.js";

export type SignalEdgeId = Brand<string, "SignalEdgeId">;

/**
 * Conexión dirigida cruda entre dos nodos. La semántica de combinación
 * (serie/paralelo/inversor = AND/OR/NOT, GDD 5.6) es Fase 2 — aquí solo se
 * registra conectividad, sin evaluarla.
 */
export interface SignalEdge {
  readonly id: SignalEdgeId;
  readonly from: SignalNodeId;
  readonly to: SignalNodeId;
  /**
   * Puerto de entrada del nodo destino (Fase 2). Permite que un nodo trate sus
   * entradas de forma asimétrica: un latch distingue "set" de "reset" por este
   * campo. Opcional y retrocompatible: sin puerto, la entrada es genérica (los
   * gates AND/OR/NOT tratan todas sus entradas por igual e ignoran el puerto).
   */
  readonly toPort?: string;
}
