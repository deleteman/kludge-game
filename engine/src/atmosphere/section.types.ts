import type { Brand } from "../shared/brand.types.js";
import type { GasKey } from "./atmosphere-composition.types.js";

/**
 * Sección de la nave a efectos de atmósfera (GDD 5.5).
 *
 * Resuelto en Fase 5 (antes PROVISIONAL): la geometría real (forma, celdas,
 * anclajes) vive en `floorplan/` autorada en Tiled, y esta `Section` es su
 * PROYECCIÓN — `floorplan/atmosphere-projection.ts` la deriva del plano con
 * `volume` = área en celdas (1 celda = 1 unidad, decisión del operador). El
 * tipo se mantiene mínimo a propósito: el motor de difusión solo necesita
 * identidad y volumen.
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
