/**
 * Inyección de sustancias en la atmósfera de una sección (Subfase 13e).
 *
 * Cierra un hueco de motor anotado desde 13a y desde
 * `mission-structural-runtime.ts`: TODO el camino LECTOR de contaminantes
 * atmosféricos ya existía —`MissionRuntime.contaminantAt`,
 * `sectionCorrosiveLevel`, `HazardousAtmosphereHazardRule`— pero NINGUNA
 * fuente real insertaba jamás un `ChemicalSubstanceId` en `atmosphere.gases`.
 * Solo lo hacían los tests. Este módulo es ese escritor.
 *
 * La convención de dato ya estaba lista y no se cambia (`GasKey = string`, con
 * `O2`/`N2`/`CO2` fijos y cualquier otra clave = id de sustancia,
 * `atmosphere/atmosphere-composition.types.ts`): aplicar un neutralizante o
 * derramar un tóxico usan exactamente la misma vía.
 *
 * Patrón de inyección idéntico a `SectionPressureSinkSource`: el runtime de
 * atmósfera no sabe POR QUÉ entra un gas (un tripulante volcando un bidón, un
 * derrame al desmontar), solo aplica lo que el mundo le da este tick.
 */

import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SectionId } from "../atmosphere/section.types.js";

/** Fracción de gas a AÑADIR por sección y sustancia en este tick. */
export type SectionGasInjectionSource = () => ReadonlyMap<
  SectionId,
  ReadonlyMap<ChemicalSubstanceId, number>
>;

/**
 * Fracción de volumen que aporta UNA unidad de sustancia vertida. Con una
 * sección típica, verter el contenido de un reservorio pequeño satura el aire
 * de forma perceptible sin llenarlo de golpe. Ajustable con el balanceo de la
 * Fase 23; vive acá y no incrustado en el efecto de tarea para que sea un
 * parámetro y no un número mágico.
 */
export const GAS_FRACTION_PER_SUBSTANCE_UNIT = 0.02;

/**
 * Buffer de inyecciones puntuales, consumido y vaciado por tick — mismo molde
 * que `TransientLeakPressureSink` (`salvage/transient-pressure-sink.ts`).
 *
 * "Puntual" y no sostenido a propósito: verter un bidón es un evento discreto.
 * Lo que persiste después es el gas ya presente en la atmósfera, que difunde y
 * se lee solo; no hace falta que la fuente siga emitiendo.
 */
export class TransientGasInjection {
  private pending = new Map<SectionId, Map<ChemicalSubstanceId, number>>();

  /** Encola `amount` unidades de sustancia sobre una sección. */
  inject(sectionId: SectionId, substanceId: ChemicalSubstanceId, amount: number): void {
    if (amount <= 0) {
      return;
    }
    const bySubstance = this.pending.get(sectionId) ?? new Map<ChemicalSubstanceId, number>();
    const fraction = amount * GAS_FRACTION_PER_SUBSTANCE_UNIT;
    bySubstance.set(substanceId, (bySubstance.get(substanceId) ?? 0) + fraction);
    this.pending.set(sectionId, bySubstance);
  }

  /**
   * Fuente para `MissionAtmosphereRuntime`. Devuelve lo pendiente y lo limpia:
   * cada inyección se aplica exactamente una vez.
   */
  asInjectionSource(): SectionGasInjectionSource {
    return () => {
      const drained = this.pending;
      this.pending = new Map();
      return drained;
    };
  }

  /** ¿Hay algo encolado? Solo para tests/diagnóstico. */
  get isEmpty(): boolean {
    return this.pending.size === 0;
  }
}

/** Compone varias fuentes en una, igual que `composePressureSinks` para los sumideros. */
export function composeGasInjections(
  ...sources: ReadonlyArray<SectionGasInjectionSource | undefined>
): SectionGasInjectionSource | undefined {
  const present = sources.filter((source): source is SectionGasInjectionSource => Boolean(source));
  if (present.length === 0) {
    return undefined;
  }
  if (present.length === 1) {
    return present[0];
  }
  return () => {
    const merged = new Map<SectionId, Map<ChemicalSubstanceId, number>>();
    for (const source of present) {
      for (const [sectionId, bySubstance] of source()) {
        const target = merged.get(sectionId) ?? new Map<ChemicalSubstanceId, number>();
        for (const [substanceId, fraction] of bySubstance) {
          target.set(substanceId, (target.get(substanceId) ?? 0) + fraction);
        }
        merged.set(sectionId, target);
      }
    }
    return merged;
  };
}
