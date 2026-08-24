import type { EntityRegistry } from "../composition/entity-registry.js";
import type {
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
} from "../chemistry/chemical-substance.types.js";
import type { SectionAtmosphere } from "../atmosphere/section.types.js";
import { sectionCorrosiveLevel } from "../atmosphere/corrosive-atmosphere.js";
import type { CombustionEvent } from "../chemistry/reaction/reaction-events.types.js";
import type { KineticImpactEvent } from "../kinetics/kinetic-events.types.js";
import type { SectionDamageCause } from "./integrity-events.types.js";
import { SECTION_INTEGRITY_PARAMETERS } from "./section-integrity-parameters.js";
import type { SectionIntegrity } from "./section-integrity.types.js";

/**
 * Reglas de daño a la vida de una sección (Subfase 13f) como **Strategy**,
 * mismo patrón que las reglas de reacción (GDD 5.6) y que
 * `dismantle-hazard-rules.ts` (13d): añadir una quinta causa de daño es
 * implementar la interfaz, no editar un `if` central.
 *
 * Dos familias, porque los fenómenos son de dos naturalezas distintas y
 * colapsarlas daría una interfaz que miente sobre la mitad de sus casos:
 *  - **Ambientales** (`SectionEnvironmentalDamageRule`): se evalúan por tick
 *    contra la atmósfera de la sección — corrosión y descompresión.
 *  - **Puntuales**: traducen un evento discreto ya emitido por otro dominio a
 *    HP — impacto cinético y combustión. Son funciones puras, no reglas con
 *    estado: no hay nada que acumular entre ticks.
 *
 * Ninguna conoce el mundo ni muta nada: devuelven cuánto daño toca. Quien lo
 * aplica es `applySectionDamage`, y quien las orquesta es
 * `MissionSectionIntegrityRuntime`.
 */

export interface SectionEnvironmentalDamageContext {
  readonly atmosphere: SectionAtmosphere;
  readonly integrity: SectionIntegrity;
  readonly chemicalRegistry: EntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>;
  readonly dtSeconds: number;
}

export interface SectionEnvironmentalDamage {
  readonly amount: number;
  /**
   * Piso de HP que este daño no puede cruzar por sí solo. `undefined` = sin
   * piso (puede llegar a colapsar la sección).
   */
  readonly floorHp?: number;
}

export interface SectionEnvironmentalDamageRule {
  readonly cause: SectionDamageCause;
  damageFor(ctx: SectionEnvironmentalDamageContext): SectionEnvironmentalDamage;
}

/**
 * Escritor 3 — corrosión de la atmósfera de la sección. Reusa
 * `sectionCorrosiveLevel`, el mismo lector con el que `MissionStructuralRuntime`
 * corroe las piezas: la sección y su contenido se dañan por la misma lectura,
 * no por dos criterios paralelos que puedan desincronizarse.
 *
 * NOTA HONESTA (mismo criterio que el docblock de `MissionStructuralRuntime`):
 * ningún capítulo autorado tiene todavía una sustancia `CORR` viva, así que
 * este escritor no tiene camino real en partida — el Cap.1 es fuga de presión,
 * no ácido. Está cableado y testeado, pero hasta que exista contenido con
 * corrosivos no va a mover el indicador jugando.
 */
export const corrosionDamageRule: SectionEnvironmentalDamageRule = {
  cause: "corrosion",
  damageFor({ atmosphere, chemicalRegistry, dtSeconds }) {
    const level = sectionCorrosiveLevel(atmosphere, chemicalRegistry);
    if (!level) {
      return { amount: 0 };
    }
    return {
      amount: SECTION_INTEGRITY_PARAMETERS.corrosionDamagePerSecondByLevel[level] * dtSeconds,
    };
  },
};

/**
 * Escritor 4 — descompresión. **Amortiguado a propósito**: devuelve un
 * `floorHp` y por lo tanto no puede colapsar una sección por sí solo.
 *
 * Sin esa amortiguación el sistema se realimenta —menos vida abre más fuga,
 * que baja más la presión, que hace más daño— y toda sección con una fuga
 * termina reventando sola sin que pase nada más. Con el piso, la descompresión
 * deteriora y presiona al jugador, pero hace falta un impacto o una explosión
 * para abrir la brecha.
 *
 * El daño escala linealmente entre `onsetKpa` y el vacío: una sección a punto
 * de perder la presión sufre poco, una en vacío sufre todo.
 */
export const decompressionDamageRule: SectionEnvironmentalDamageRule = {
  cause: "decompression",
  damageFor({ atmosphere, integrity, dtSeconds }) {
    const { onsetKpa, maxDamagePerSecond, floorFraction } = SECTION_INTEGRITY_PARAMETERS.decompression;
    const floorHp = integrity.maxHp * floorFraction;
    if (atmosphere.pressureKpa >= onsetKpa) {
      return { amount: 0, floorHp };
    }
    const severity = Math.min(1, (onsetKpa - atmosphere.pressureKpa) / onsetKpa);
    return { amount: maxDamagePerSecond * severity * dtSeconds, floorHp };
  },
};

/** Reglas ambientales en el orden en que se evalúan cada tick. */
export const SECTION_ENVIRONMENTAL_DAMAGE_RULES: ReadonlyArray<SectionEnvironmentalDamageRule> = [
  corrosionDamageRule,
  decompressionDamageRule,
];

/**
 * Escritor 1 — impacto cinético contra la pared de la sección. Solo aplica
 * cuando el proyectil golpeó estructura: un impacto contra un componente o
 * contra un tripulante daña a ESE objetivo, no al casco.
 */
export function kineticImpactSectionDamage(event: KineticImpactEvent): number {
  if (event.targetKind !== "wall") {
    return 0;
  }
  return SECTION_INTEGRITY_PARAMETERS.kineticDamageBySeverity[event.severity];
}

/**
 * Escritor 2 — explosión/combustión. Le da consecuencia REAL al `radius` de
 * `CombustionEvent`, que hasta 13f solo decidía el tamaño del emisor de
 * partículas: una llamarada contenida (`half-section`) daña la mitad que una
 * que se come la sección entera.
 */
export function combustionSectionDamage(event: CombustionEvent): number {
  return SECTION_INTEGRITY_PARAMETERS.combustionDamageByRadius[event.radius];
}
