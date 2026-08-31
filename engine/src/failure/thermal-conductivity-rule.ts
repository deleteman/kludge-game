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
  /** Por debajo de esta temperatura (°C) el enfriamiento extremo (ej. nitrógeno
   *  líquido) reduce la resistencia del conductor lo bastante como para
   *  arriesgar sobrecarga. */
  triggerTemperatureCelsius: -50,
  /**
   * Por encima de esta temperatura (°C) el conductor caliente pierde capacidad
   * de corriente segura.
   *
   * El número sale de cruzar los que ya están en el repo, no de estimarlo:
   * queda por ENCIMA de `THERMAL_SENSOR_TRIGGER_CELSIUS` (60), para que el
   * sensor térmico sea un aviso previo y no llegue tarde; lo cruza el pico de
   * una combustión `violent` (~161 °C) y el de una `explosion` de sobrecarga
   * (~111 °C); y NO lo cruza una combustión `standard` (~81 °C). Si coincidiera
   * con el umbral del sensor o quedara por encima del pico máximo, la franja
   * sería vacía y el acoplamiento decorativo.
   */
  hotTriggerTemperatureCelsius: 100,
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
   */
  hotTriggerOffsetByThermalConductivity: { A: 0, M: 20, B: 40 } as Readonly<
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
