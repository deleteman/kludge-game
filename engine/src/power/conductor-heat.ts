import type { EntityRegistry } from "../composition/entity-registry.js";
import type { Blueprint } from "../blueprint/blueprint.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { ThermalConductivityLevel } from "../properties/material.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import { activeSignalEdges } from "../signals/active-signal-graph.js";
import { edgeConductorId, electricalConductorProperty } from "../signals/edge-conductor.js";
import { edgeElectricalLoad } from "./conductor-load.js";

/**
 * Calor que DISIPA un cable por llevar corriente (ronda 1 de playtest de 14a-3).
 *
 * **Por qué existe.** El operador preguntó, al ver la autoignición implementada:
 * *"¿qué puedo poner en una sala para que encienda sola?"*. La respuesta honesta
 * era **nada**: para tener vapor inflamable hay que estar a 75 °C y para que la
 * sala encienda sola, a 90, y el único camino a esas temperaturas era una tecla
 * de dev. La mecánica estaba completa y sin sujeto — el patrón 60 un nivel más
 * arriba. Este módulo es su contraparte real, y es la simétrica del enfriador de
 * 14a-2: si una máquina puede bajar la temperatura de una sala, algo tiene que
 * poder subirla sin recurrir a un incendio.
 *
 * **Por propiedades, no por identidad** (decisión del operador, principio 1):
 * no hay tabla que nombre piezas. El calor sale de la carga real del cable
 * (`edgeElectricalLoad`, ya existía desde 14a-4), de la capacidad que declara su
 * `COND(E)` y de la conductividad térmica `CT` de su material. La resistencia
 * eléctrica termina siendo la que más calienta A IGUAL CARGA, pero por sus
 * datos: si mañana entra otro conductor al catálogo, calienta solo.
 *
 * Ojo con la lectura fácil: en su PROPIO límite el cobre calienta más que la
 * resistencia, porque lleva el doble de corriente (`C²/C = C`). El papel de la
 * resistencia no es "el calefactor del catálogo", es que llega a estar caliente
 * con la mitad de consumidores colgados — y que es el peor cable posible en una
 * sala que ya está caliente, porque su `CT: "A"` también la degrada antes.
 */

export const CONDUCTOR_HEAT_PARAMETERS = {
  /**
   * Constante de la disipación, en °C/s por unidad de `carga² / capacidad`.
   *
   * **Sale de resolver el equilibrio, no de estimarlo** (patrón 23/81, que en
   * esta misma subfase ya costó una recalibración). La climatización empuja
   * hacia el nominal a `(21 - T) × 0.05`, así que una fuente sostenida de `R`
   * °C/s estabiliza la sala en `21 + R / 0.05`. Los dos objetivos:
   *
   *  - **75 °C** (ebullición del disolvente y del combustible): `R = 2.7 °C/s`.
   *  - **90 °C** (`AUTOIGNITION_CELSIUS`): `R = 3.45 °C/s`.
   *
   * Con 0.45, el montaje de referencia del Capítulo 1 —cinco LEDs detrás de un
   * relé, con el tronco de `cable-cobre` llevando **exactamente** su capacidad de
   * 6— aporta **3.07 °C/s** contando tronco y ramas, y sostiene la sala en
   * **82 °C**: por encima de la ebullición del combustible de motor (75) y del
   * disolvente (56), así que hay vapor inflamable, y por debajo de la
   * autoignición (90), así que el jugador sigue eligiendo cuándo prender. DOS
   * montajes así en la misma sala la llevan a ~144 °C y enciende sola — la
   * propagación pide un montaje deliberado, que es la presión que el patrón 69
   * exige para que una mecánica de coste no quede muerta.
   *
   * **"Exactamente su capacidad" es la mitad del número.** `OverloadRule` corta
   * con `load > capacity`, así que un tronco de 7 se quema, deja de conducir y
   * deja de calentar. La primera calibración de esta ronda salió de un montaje de
   * tres compuertas (carga 7 con el chip) que en partida habría durado un tick:
   * un número correcto sobre un escenario imposible.
   *
   * El cableado corriente queda muy por debajo del umbral del sensor térmico
   * (60 °C): un solo LED cableado deja la sala en ~28 °C. Sube algo, que es
   * correcto —hay corriente pasando—, pero no dispara alarmas ni evapora nada.
   * Sin ese piso, cablear cualquier cosa sería un impuesto térmico invisible
   * sobre toda la nave.
   */
  celsiusPerSecondPerLoadUnit: 0.45,
  /**
   * Cuánto del calor disipado llega al AIRE de la sala, según la conductividad
   * térmica del material del conductor.
   *
   * Misma lectura de `CT` que `thermalConductivityRule` (14a-2): `A` mueve
   * calor bien, `B` aísla. Acá eso significa que un conductor aislado calienta
   * menos la sala — y, por el mismo dato, en la otra regla tarda más en perder
   * capacidad. Las dos consecuencias apuntan al mismo lado, así que elegir un
   * conductor aislado es una decisión coherente y no un intercambio arbitrario.
   */
  transferByThermalConductivity: { A: 1, M: 0.6, B: 0.3 } as Readonly<
    Record<ThermalConductivityLevel, number>
  >,
} as const;

/**
 * °C/s que disipa un cable concreto. `0` si la arista no existe, ya se quemó, no
 * lleva carga o su conductor no declara capacidad.
 *
 * La forma es `carga² / capacidad`, o sea I²R con `R ∝ 1/capacidad`: un
 * conductor de poca capacidad es el "fino" del catálogo y por lo tanto el
 * resistivo. La consecuencia jugable es la que se espera sin saber la fórmula:
 * **a igual carga, la resistencia eléctrica (capacidad 3) calienta cuatro veces
 * más que la fibra (12)**, y llevar cualquier cable cerca de su límite lo
 * calienta mucho más que cargarlo a medias.
 *
 * No se clampea el ratio por arriba: un cable por encima de su capacidad está a
 * punto de cortarse (`MissionOverloadRuntime` lo resuelve ese mismo tick) y
 * mientras conduzca tiene que ser lo más caliente que puede estar. Sí se apoya
 * en `activeSignalEdges`: un cable ya quemado no conduce, así que no calienta.
 */
export function edgeHeatCelsiusPerSecond(
  blueprint: Blueprint,
  edgeId: SignalEdgeId,
  registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): number {
  const edge = activeSignalEdges(blueprint).find((candidate) => candidate.id === edgeId);
  if (!edge) {
    return 0;
  }
  const definition = registry.get(edgeConductorId(edge));
  const capacity = electricalConductorProperty(definition)?.maxCapacity ?? 0;
  if (capacity <= 0) {
    return 0;
  }
  const load = edgeElectricalLoad(blueprint, edgeId, registry);
  if (load <= 0) {
    return 0;
  }
  const { celsiusPerSecondPerLoadUnit, transferByThermalConductivity } = CONDUCTOR_HEAT_PARAMETERS;
  // Sin `CT` declarado se asume `A`, igual que `thermalCapacityFactor`: un
  // material que no dice aislar, no aísla.
  const transfer = transferByThermalConductivity[definition?.data.material?.CT ?? "A"];
  return ((load * load) / capacity) * celsiusPerSecondPerLoadUnit * transfer;
}

/**
 * Calor de TODO el cableado, agregado por sección — la fuente que consume
 * `MissionThermalRuntime` (octavo escritor del eje térmico).
 *
 * `sectionsOfEdge` se INYECTA y no se importa: el recorrido de un cable lo
 * calcula la capa de render (`conduit-path.ts` en `/game`), y `/engine` no
 * conoce el ruteo ni debe. Mismo criterio DI que `sectionVolumeOf` en la
 * inyección de gases o `atmosphereOf` en los runtimes de misión: la REGLA vive
 * acá, con sus tests; la geometría la pone el llamador.
 *
 * Un cable que cruza varias secciones REPARTE su calor entre ellas: disipa una
 * cantidad fija y no puede calentar cada sala como si fuera entera. Sin el
 * reparto, tender un tronco largo sería la forma más eficiente de calentar la
 * nave, que es justo lo contrario de lo que el modelo dice.
 */
export function conductorHeatBySection<TSectionId extends string>(
  blueprint: Blueprint,
  registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
  sectionsOfEdge: (edgeId: SignalEdgeId) => ReadonlyArray<TSectionId>,
): ReadonlyMap<TSectionId, number> {
  const bySection = new Map<TSectionId, number>();
  for (const edge of activeSignalEdges(blueprint)) {
    const heat = edgeHeatCelsiusPerSecond(blueprint, edge.id, registry);
    if (heat <= 0) {
      continue;
    }
    const sections = sectionsOfEdge(edge.id);
    if (sections.length === 0) {
      continue;
    }
    const share = heat / sections.length;
    for (const sectionId of sections) {
      bySection.set(sectionId, (bySection.get(sectionId) ?? 0) + share);
    }
  }
  return bySection;
}
