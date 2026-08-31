import type { Brand } from "../shared/brand.types.js";
import { GAS, STANDARD_OXYGEN_FRACTION } from "./atmosphere-composition.types.js";
import type { GasKey } from "./atmosphere-composition.types.js";
import { NOMINAL_TEMPERATURE_CELSIUS } from "./thermal-parameters.js";

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
  /**
   * Temperatura de la sección en °C. Declarado desde 11b, pero SIN ningún
   * escritor hasta la Subfase 14a-1: hasta entonces era un 21 fijo que solo
   * leía `/game`. Ahora lo mueven la conducción entre secciones (`diffuse`),
   * la deriva pasiva hacia el nominal y los pulsos de calor por evento
   * (`MissionThermalRuntime`).
   */
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

/**
 * Aire estándar respirable (Fase 11b): siembra de una sección sin snapshot
 * guardado todavía — partida nueva, o `Blueprint` de un save previo a esta
 * fase (sin `sectionAtmospheres`).
 */
export function standardSectionAtmosphere(): SectionAtmosphere {
  return {
    gases: new Map([[GAS.OXYGEN, STANDARD_OXYGEN_FRACTION]]),
    temperatureCelsius: NOMINAL_TEMPERATURE_CELSIUS,
    pressureKpa: 101,
  };
}
