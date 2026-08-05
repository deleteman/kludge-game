import type {
  ConductivityLevel,
  StructuralResistanceLevel,
  ThermalConductivityLevel,
} from "./material.types.js";

/**
 * Orden canónico de los niveles de material, de MAYOR a MENOR (GDD 7.0). Hasta
 * la Fase 13c cada consumidor que necesitaba comparar dos niveles se declaraba
 * su propio array local (`RE_ORDER` en `failure/structural-failure.ts`, el mapa
 * `RE_LEVEL_FRACTION` en `ship-status/ship-status-aggregation.ts`) — con la
 * agregación de material de creaciones (deuda #6) y el desgaste (`wear/`)
 * apareció un tercer y cuarto consumidor, así que el orden pasa a vivir una
 * sola vez, en el mismo dominio que define los tipos.
 *
 * Los niveles NO son uniformes entre propiedades: `CE` tiene 4 (incluye "N" =
 * ninguno) y el resto 3. Por eso hay un array por propiedad y no uno genérico.
 */
export const RE_ORDER: ReadonlyArray<StructuralResistanceLevel> = ["A", "M", "B"];
export const CE_ORDER: ReadonlyArray<ConductivityLevel> = ["A", "M", "B", "N"];
export const CT_ORDER: ReadonlyArray<ThermalConductivityLevel> = ["A", "M", "B"];

function bestOf<T extends string>(order: ReadonlyArray<T>, levels: ReadonlyArray<T>): T | undefined {
  let best: T | undefined;
  for (const level of levels) {
    if (best === undefined || order.indexOf(level) < order.indexOf(best)) {
      best = level;
    }
  }
  return best;
}

function worstOf<T extends string>(order: ReadonlyArray<T>, levels: ReadonlyArray<T>): T | undefined {
  let worst: T | undefined;
  for (const level of levels) {
    if (worst === undefined || order.indexOf(level) > order.indexOf(worst)) {
      worst = level;
    }
  }
  return worst;
}

/** El nivel de resistencia estructural más débil del conjunto (`undefined` si está vacío). */
export function worstResistance(
  levels: ReadonlyArray<StructuralResistanceLevel>,
): StructuralResistanceLevel | undefined {
  return worstOf(RE_ORDER, levels);
}

/** La conductividad eléctrica más alta del conjunto. */
export function bestConductivity(
  levels: ReadonlyArray<ConductivityLevel>,
): ConductivityLevel | undefined {
  return bestOf(CE_ORDER, levels);
}

/** La conductividad térmica más alta del conjunto. */
export function bestThermalConductivity(
  levels: ReadonlyArray<ThermalConductivityLevel>,
): ThermalConductivityLevel | undefined {
  return bestOf(CT_ORDER, levels);
}
