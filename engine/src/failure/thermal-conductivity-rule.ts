import type { ConductorProperty } from "../properties/functional.types.js";
import type { ThermalConductivityLevel } from "../properties/material.types.js";
import type { OverloadSubject } from "./overload-rule.js";

/**
 * Efecto de la temperatura sobre la capacidad de corriente segura de un
 * conductor (GDD 5.2, "conductividad eléctrica... variable con temperatura";
 * caso de validación 2). Sin tabla numérica en la Especificación de datos
 * técnicos — a diferencia de `REACTION_PARAMETERS`, estos valores no tienen
 * respaldo documental exacto, son de referencia para playtesting.
 *
 * **Subfase 14a-2: la regla pasa a tener dos ramas.** Hasta acá modelaba solo
 * el frío, y todos los escritores de temperatura de 14a-1 son de CALOR: la
 * regla estaba escrita, exportada y testeada, y era inalcanzable en partida.
 * La rama caliente es además la que cierra el ciclo que la subfase declara
 * como su objetivo (combustión → calor → cortocircuito → combustión).
 */
export const THERMAL_CONDUCTIVITY_PARAMETERS = {
  /**
   * Por debajo de esta temperatura (°C) el enfriamiento extremo (ej. nitrógeno
   * líquido) reduce la resistencia del conductor lo bastante como para
   * arriesgar sobrecarga.
   *
   * **-30 y no -50 desde la ronda 2 de playtest de 14a-3.** El -50 se eligió
   * contra un enfriador que se creía capaz de llegar a -69 °C; medido sobre la
   * nave real, un regulador térmico llega a **-35.7** (ver
   * `COOLER_RATE_CELSIUS_PER_SECOND` y `thermal-calibration.fixture.ts`), así que
   * el umbral era inalcanzable y esta rama de la regla estaba muerta en partida.
   * A -30 la cruza un enfriador solo en una sala normal, que es la condición del
   * caso de validación 2.
   */
  triggerTemperatureCelsius: -30,
  /**
   * Por encima de esta temperatura (°C) el conductor caliente pierde capacidad
   * de corriente segura.
   *
   * El número sale de cruzar los que ya están en el repo, no de estimarlo:
   * queda por ENCIMA de `THERMAL_SENSOR_TRIGGER_CELSIUS` (60), para que el
   * sensor térmico sea un aviso previo y no llegue tarde.
   *
   * **85 y no 100 desde la ronda 2 de playtest de 14a-3**, por la misma razón que
   * el umbral frío: los picos que justificaban el 100 (`violent` ~161,
   * `explosion` ~111) salían de la fórmula de equilibrio sin conducción. Los
   * reales son **109.2** y **86.3**, así que con el desplazamiento por `CT` de
   * antes (`M: +20`, `B: +40`) el umbral quedaba en 120 y 140: **inalcanzable
   * para todo conductor que no fuera `CT: "A"`**.
   *
   * Con 85 lo cruza una combustión `violent` en los tres materiales, una
   * `explosion` de sobrecarga solo en `A`, y una `standard` (61.5) en ninguno:
   * la franja existe para los tres y sigue distinguiendo intensidades.
   */
  hotTriggerTemperatureCelsius: 85,
  /** Fracción de la capacidad nominal que queda como "segura" fuera del rango
   *  de operación, por cualquiera de los dos lados. */
  effectiveCapacityFractionOutsideRange: 0.5,
  /**
   * Cuántos °C se desplaza el umbral CALIENTE según la conductividad térmica
   * del material del conductor (`CT`). Un conductor bien aislado (`CT: "B"`,
   * la placa aislante térmica) tarda más en degradarse; uno que conduce bien el
   * calor (`CT: "A"`) se degrada al umbral nominal.
   *
   * Es lo que hace que "conductividad CE/CT variable" signifique algo más que
   * la temperatura ambiental: el material del conductor entra en la decisión.
   * No se aplica al umbral frío — aislar no protege de la fragilización, solo
   * retrasa el calentamiento.
   *
   * **Los desplazamientos se achicaron a la mitad en la ronda 2 de playtest de
   * 14a-3**: con el pico real de una `violent` en 109.2 °C, `+40` dejaba el
   * umbral de un conductor aislado en 140 y ningún escritor del motor llegaba
   * ahí. Con 85/95/105, aislar sigue siendo una ventaja real (hace falta una
   * combustión más intensa para degradarlo) sin volverlo inmune.
   */
  hotTriggerOffsetByThermalConductivity: { A: 0, M: 10, B: 20 } as Readonly<
    Record<ThermalConductivityLevel, number>
  >,
} as const;

/**
 * Fracción de capacidad que le queda a un conductor a esta temperatura: 1
 * dentro del rango de operación, `effectiveCapacityFractionOutsideRange` fuera.
 * Umbrales duros, no gradiente — un fallo eléctrico es un evento, no un
 * deterioro continuo.
 */
export function thermalCapacityFactor(
  temperatureCelsius: number,
  thermalConductivity?: ThermalConductivityLevel,
): number {
  const {
    triggerTemperatureCelsius,
    hotTriggerTemperatureCelsius,
    effectiveCapacityFractionOutsideRange,
    hotTriggerOffsetByThermalConductivity,
  } = THERMAL_CONDUCTIVITY_PARAMETERS;
  // Sin `CT` declarado se asume el peor caso (`A`, umbral nominal): un material
  // que no dice aislar, no aísla. Fail-safe, no fail-open.
  const hotTrigger =
    hotTriggerTemperatureCelsius + hotTriggerOffsetByThermalConductivity[thermalConductivity ?? "A"];
  return temperatureCelsius <= triggerTemperatureCelsius || temperatureCelsius >= hotTrigger
    ? effectiveCapacityFractionOutsideRange
    : 1;
}

/**
 * `OverloadSubject` de un conductor ajustado por temperatura ambiental (caso
 * 2: refrigerante conductor + nitrógeno líquido + panel eléctrico). Fuera del
 * rango de operación la capacidad efectiva baja — un conductor normalmente
 * seguro puede superar su capacidad de corriente y disparar `OverloadRule` sin
 * que cambie la carga real. Reutiliza el mecanismo de fallo ya existente en vez
 * de duplicarlo.
 */
export function thermallyAdjustedConductorOverloadSubject(
  ref: string,
  conductor: ConductorProperty,
  load: number,
  temperatureCelsius: number,
  thermalConductivity?: ThermalConductivityLevel,
): OverloadSubject {
  return {
    ref,
    resourceType: conductor.resourceType,
    capacity: conductor.maxCapacity * thermalCapacityFactor(temperatureCelsius, thermalConductivity),
    load,
  };
}
