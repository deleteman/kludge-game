import type { Brand } from "../shared/brand.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ComponentWear } from "../wear/wear.types.js";
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
  /**
   * Pieza conductora que se gastó al tender este cable (Subfase 14a-4). **El
   * cableado del jugador ES el conductor**: hasta 14a-2 la arista era gratis,
   * instantánea y de capacidad infinita, y el acoplamiento térmico colgaba de un
   * `COND(E)` colocado en una celda que nadie tenía motivo para colocar.
   *
   * De acá sale la `maxCapacity` de la arista, leída del catálogo en cada
   * consulta — la capacidad NO se persiste: sería una segunda copia de la misma
   * verdad, y las dos se desincronizarían al re-escalar el catálogo (ya pasó en
   * 14a-2, cuando `COND.maxCapacity` cambió de escala).
   *
   * Opcional solo por migración: `blueprint-serializer.ts` rellena las aristas de
   * saves `schemaVersion` ≤ 10 con `cable-cobre`. Todo código nuevo debe tratarlo
   * como presente vía `edgeConductor()`.
   */
  readonly conductorId?: ComponentId;
  /**
   * Bucket de desgaste de la pieza consumida (Subfase 14a-4). Ausente = `nuevo`,
   * mismo criterio que `PlacedComponent.wear`. Entra en la capacidad efectiva de
   * la arista vía `wornCapacity`, igual que en una pieza instalada: un cable de
   * segunda mano aguanta menos.
   */
  readonly conductorWear?: ComponentWear;
}
