import type { MaterialProperties, MatterState } from "../properties/material.types.js";
import {
  bestConductivity,
  bestThermalConductivity,
  worstResistance,
} from "../properties/material-order.js";

/**
 * Agregación de propiedades de MATERIAL de las partes de una creación de la
 * mesa (deuda técnica #6, `PENDIENTES_OBSERVACIONES.md`; prerrequisito de la
 * Fase 13c). `nameAndRegisterCreation` ya agregaba la unión de las propiedades
 * FUNCIONALES desde 11c.1, pero no las de material — consecuencia: una creación
 * instalada no tenía `data.material`, así que `MissionStructuralRuntime` la
 * saltaba (no se corroía) y `MissionProjectileWorld` no la detectaba
 * ferromagnética aunque contuviera hierro.
 *
 * La agregación de material es más sutil que la funcional (que es una unión
 * simple) porque cada propiedad tiene su propia semántica física. Regla elegida
 * con el operador (2026-08-05), una por propiedad:
 *
 *  - `RE`: el PEOR de las partes. Un ensamblaje se rompe por su eslabón más
 *    débil — mismo criterio worst-case que ya usan `aggregateHullIntegrity` y
 *    `aggregateSectionHullIntegrity` (`ship-status/ship-status-aggregation.ts`)
 *    para agregar a nivel sección y nave. Es además lo que hace coherente al
 *    Pilar 2: pegar una lente frágil a una plancha de acero no da una lente
 *    blindada.
 *  - `MAG`: `true` si CUALQUIER parte lo es. El ferromagnetismo del conjunto
 *    basta para que una bobina lo acelere (GDD 5.5 / caso 17).
 *  - `CE`/`CT`: la MAYOR de las partes. Conducir es una propiedad de camino:
 *    si alguna parte conduce bien, el conjunto conduce.
 *  - `ES`: el estado de la mayoría de las partes (empate → el de la primera).
 *    Un compuesto físico de la mesa es sólido en la práctica; se agrega igual
 *    por completitud, sin inventar un estado que ninguna parte tiene.
 *
 * Devuelve `undefined` si NINGUNA parte declara propiedades de material, para
 * no poblar `data.material` con un objeto vacío (mismo criterio que
 * `aggregatedFunctional` sigue con `functional`).
 */
export function aggregateCreationMaterial(
  parts: ReadonlyArray<MaterialProperties | undefined>,
): MaterialProperties | undefined {
  const present = parts.filter((part): part is MaterialProperties => part !== undefined);
  if (present.length === 0) {
    return undefined;
  }

  const RE = worstResistance(present.flatMap((part) => (part.RE ? [part.RE] : [])));
  const CE = bestConductivity(present.flatMap((part) => (part.CE ? [part.CE] : [])));
  const CT = bestThermalConductivity(present.flatMap((part) => (part.CT ? [part.CT] : [])));
  const MAG = present.some((part) => part.MAG === true);
  const ES = majorityState(present.flatMap((part) => (part.ES ? [part.ES] : [])));

  const aggregated: MaterialProperties = {
    ...(CE ? { CE } : {}),
    ...(CT ? { CT } : {}),
    // MAG solo se anota cuando es `true`: `MAG: false` explícito en cada
    // creación sin hierro sería ruido, y el consumidor ya trata ausente como no
    // ferromagnético.
    ...(MAG ? { MAG } : {}),
    ...(RE ? { RE } : {}),
    ...(ES ? { ES } : {}),
  };

  return Object.keys(aggregated).length > 0 ? aggregated : undefined;
}

/** Estado mayoritario; ante empate, el de la primera parte que lo declaró (determinista). */
function majorityState(states: ReadonlyArray<MatterState>): MatterState | undefined {
  if (states.length === 0) {
    return undefined;
  }
  const counts = new Map<MatterState, number>();
  for (const state of states) {
    counts.set(state, (counts.get(state) ?? 0) + 1);
  }
  let winner = states[0]!;
  for (const state of states) {
    if ((counts.get(state) ?? 0) > (counts.get(winner) ?? 0)) {
      winner = state;
    }
  }
  return winner;
}
