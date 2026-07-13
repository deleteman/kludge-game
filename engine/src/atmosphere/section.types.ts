import type { Brand } from "../shared/brand.types.js";
import type { GasKey } from "./atmosphere-composition.types.js";

/**
 * Sección de la nave a efectos de atmósfera (GDD 5.5).
 *
 * PROVISIONAL — mismo criterio que el schema de blueprint en Fase 1: la
 * geometría real de secciones y su adyacencia se autoran en Tiled y se exportan
 * en la Fase 5 (plano físico). Aquí solo modelamos lo que el motor de atmósfera
 * necesita ahora: identidad y volumen. Debe revisarse contra el plano real de
 * Fase 5 (una sección de Tiled tendrá además forma, celdas y puntos de anclaje
 * de ventilación); no asumir que esta forma es definitiva.
 */
export type SectionId = Brand<string, "SectionId">;

export interface Section {
  readonly id: SectionId;
  /** Volumen en unidades abstractas (mismo criterio agnóstico que el grid, GDD 10.1). */
  readonly volume: number;
}

/**
 * Estado atmosférico mutable de una sección en simulación. Separado de la
 * `Section` (definición inmutable) igual que `SignalNodeState` se separa del
 * grafo: la topología no cambia por tick, la composición sí.
 */
export interface SectionAtmosphere {
  /** Fracción [0,1] de cada gas presente. */
  readonly gases: Map<GasKey, number>;
  temperatureCelsius: number;
  pressureKpa: number;
}

export interface SectionRuntime {
  readonly section: Section;
  readonly atmosphere: SectionAtmosphere;
}

export function getGasFraction(atmosphere: SectionAtmosphere, gas: GasKey): number {
  return atmosphere.gases.get(gas) ?? 0;
}
