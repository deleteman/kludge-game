import type { MatterState } from "../../properties/material.types.js";
import type { ChemicalSubstanceDefinition } from "../chemical-substance.types.js";
import type { PhaseChangePoints, PhaseTransition } from "./phase-change.types.js";
import { DEFAULT_NOMINAL_STATE, DEFAULT_PHASE_POINTS_BY_STATE } from "./phase-change-parameters.js";

/**
 * Estado de la materia DERIVADO de la temperatura (Subfase 14a-3, GDD §5.6).
 *
 * Funciones puras: reciben una sustancia y una temperatura y devuelven qué es
 * ahí. No conocen secciones, reservorios ni atmósfera — quién decide qué hacer
 * con el resultado son los consumidores (`section-gas-injection`,
 * `reservoir/frozen-content`, la expansión de presión).
 *
 * Roles de los dos datos, que es lo que evita la contradicción del nitrógeno
 * líquido (declarado `state: "L"` y gaseoso a temperatura de sala):
 *  - `ChemicalSubstanceData.state` = estado **dentro de un contenedor sellado**,
 *    que es donde el catálogo lo describe (un tanque criogénico aguanta presión).
 *  - `effectiveMatterState()` = estado de la sustancia **suelta en una sección**,
 *    y es la autoridad de runtime.
 */

/**
 * Punto ÚNICO de resolución de los puntos de transición: entrada de catálogo si
 * los declara, perfil por estado nominal si no (productos sintetizados en
 * runtime). Existe como función y no como `?? DEFAULT[...]` repetido en cada
 * consumidor por la misma razón que `condition` de 13c: una fórmula con tres
 * copias es una fórmula que se va a bifurcar.
 */
export function phasePointsOf(substance: ChemicalSubstanceDefinition): PhaseChangePoints {
  const { meltingPointCelsius, boilingPointCelsius } = substance.data;
  if (meltingPointCelsius !== undefined && boilingPointCelsius !== undefined) {
    return { meltingPointCelsius, boilingPointCelsius };
  }
  return DEFAULT_PHASE_POINTS_BY_STATE[nominalStateOf(substance)];
}

/** Estado declarado en catálogo, con el mismo default en todos los llamadores. */
export function nominalStateOf(substance: ChemicalSubstanceDefinition): MatterState {
  return substance.data.state ?? DEFAULT_NOMINAL_STATE;
}

/**
 * En qué estado está esta sustancia a esta temperatura.
 *
 * Bordes, elegidos para que las tres ramas sean excluyentes y no quede ningún
 * valor sin estado: **por debajo** del punto de fusión es sólida; **en o por
 * encima** del de ebullición es gaseosa; entre ambos, líquida. O sea que
 * exactamente en el punto de fusión ya está fundida, y exactamente en el de
 * ebullición ya hirvió. Es una convención arbitraria pero única, y está cubierta
 * por tests de igualdad exacta en los dos umbrales.
 */
export function effectiveMatterState(
  substance: ChemicalSubstanceDefinition,
  temperatureCelsius: number,
): MatterState {
  const { meltingPointCelsius, boilingPointCelsius } = phasePointsOf(substance);
  if (temperatureCelsius < meltingPointCelsius) {
    return "S";
  }
  if (temperatureCelsius >= boilingPointCelsius) {
    return "G";
  }
  return "L";
}

/**
 * Qué le pasó a la sustancia respecto de su estado nominal, o `undefined` si
 * está en el estado en que el catálogo la describe.
 *
 * S→G y G→S se reportan como `boil`/`freeze`: la sublimación existe en el
 * modelo (un sólido cuyo punto de ebullición se cruza sin pasar por líquido) y
 * no merece un nombre propio para lo que el juego hace con ella — lo que
 * importa aguas abajo es "ahora está en el aire" o "ahora está sólido".
 */
export function phaseTransitionOf(
  nominal: MatterState,
  effective: MatterState,
): PhaseTransition | undefined {
  if (nominal === effective) {
    return undefined;
  }
  if (effective === "G") {
    return "boil";
  }
  if (effective === "S") {
    return "freeze";
  }
  return nominal === "S" ? "melt" : "condense";
}

/** ¿Esta sustancia está SÓLIDA a esta temperatura? Atajo legible del predicado que más se consulta. */
export function isFrozenAt(
  substance: ChemicalSubstanceDefinition,
  temperatureCelsius: number,
): boolean {
  return effectiveMatterState(substance, temperatureCelsius) === "S";
}
