import type { LeveledChemicalTagName } from "../properties/chemical-tag.types.js";

/**
 * Parámetros del sensor químico (`triggerType: "spectral"`, Subfase 14b-1).
 *
 * Archivo propio y no una constante suelta dentro del input-source, por el
 * mismo criterio que `thermal-parameters.ts`: el umbral es dato de balanceo y
 * lo van a mirar tanto el motor como el tooltip que explica la lectura. El
 * sensor de presión eligió el otro camino (`PRESSURE_SENSOR_TRIGGER_KPA` vive
 * dentro de su propio source) y los dos patrones conviven; este lado es el que
 * escala cuando 14b-3 vuelva el umbral configurable por instancia.
 */

/**
 * Qué tags hacen que una sustancia cuente como "detectable" para este sensor
 * (decisión del operador al planificar 14b, 2026-09-10).
 *
 * TOX y CORR, o sea **lo que lastima**: el sensor es un detector de
 * contaminación peligrosa, no un analizador de composición. Con el criterio
 * alternativo ("cualquier gas que no sea O2/N2/CO2") se encendería también con
 * vapor de agua o con un neutralizante ya gastado, y un indicador que está
 * encendido casi siempre no informa nada (eje 7 de los patrones de playtest).
 *
 * Es un array y no dos constantes porque 14b-3 lo vuelve elegible por
 * instancia: la lista de fábrica pasa a ser el default de esa configuración.
 */
export const CHEMICAL_SENSOR_TAGS: ReadonlyArray<LeveledChemicalTagName> = ["TOX", "CORR"];

/**
 * Fracción de volumen a partir de la cual el sensor dispara. Dispara POR
 * ENCIMA, igual que el térmico.
 *
 * El 0.05 no es libre: tiene que caer dentro de una ventana estrecha que ya
 * está fijada por otros tres números del motor.
 *  - Por debajo, `REACTANT_PRESENCE_FLOOR` (0.02, `mission/section-reactants.ts`)
 *    es el piso en el que una traza residual deja de considerarse presente.
 *    Un umbral por debajo de ese piso haría sonar la alarma por restos que el
 *    resto del motor ya considera inexistentes.
 *  - Por encima, `REACTION_PARAMETERS.toxicity.incapacitationConcentration`
 *    (0.3) es donde la tripulación empieza a caer. **El sensor tiene que avisar
 *    antes de eso, no confirmarlo después**: a 0.05 quedan 6× de margen para
 *    que el jugador reaccione, que es la diferencia entre una alarma y un
 *    certificado de defunción.
 *  - Comparte valor con `CORROSIVE_ONSET_CONCENTRATION` (`corrosive-atmosphere.ts`),
 *    a propósito: ahí es el punto en que un corrosivo empieza a comerse el
 *    casco. Que el sensor dispare exactamente cuando empieza el daño real es lo
 *    que hace que su lectura signifique algo — dos números distintos para el
 *    mismo fenómeno serían la UI discrepando del motor (patrón 1).
 */
export const CHEMICAL_SENSOR_TRIGGER_CONCENTRATION = 0.05;
