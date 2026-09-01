import { THERMAL_SENSOR_TRIGGER_CELSIUS } from "../atmosphere/thermal-parameters.js";

/**
 * Parámetros del peligro atmosférico sobre la tripulación (Subfase 13f).
 * Data-driven, mismo criterio que `SECTION_INTEGRITY_PARAMETERS`: los umbrales
 * de tóxico y corrosivo ya vienen de `REACTION_PARAMETERS` (Espec. §1) y no se
 * repiten acá; lo único nuevo es el vacío, que la Especificación no cubre
 * porque hasta 13f ninguna sección podía quedarse sin atmósfera.
 */
export const HAZARD_PARAMETERS = {
  vacuum: {
    /**
     * Presión (kPa) a la que un tripulante sin protección empieza a sufrir.
     * Por debajo del piso normal de fuga (40 kPa) a propósito: una fuga que se
     * estabiliza no debe matar a nadie, solo una sección realmente abierta al
     * vacío.
     */
    onsetKpa: 20,
    /**
     * Segundos entre mordiscos de daño por vacío.
     *
     * Ronda 1 de playtest de 13f: antes esto era una fracción CONTINUA por
     * segundo (`0.1`), escalada por `dtSeconds` en cada tick. Con el core loop
     * corriendo por frame (~0.016 s), la pérdida real era
     * `Math.round(100 × 0.0016)` = **0**: el tripulante no perdía vida y aun
     * así se emitía un `crew-damaged` por frame, ~60 por segundo. Sangre
     * saltando sobre alguien inmortal.
     *
     * El daño por vacío pasa a ser DISCRETO: un mordisco visible cada
     * `biteIntervalSeconds`, que es además lo que el principio 6 pide — un
     * fenómeno del motor con una representación que se puede contar.
     *
     * Subido de 2 a 8 en la ronda 3 de playtest. Con 2 s la muerte llegaba a
     * los ~8 s, y las cifras del propio juego decían que eso era imposible de
     * jugar: instalar tarda 8 s (9,6 fuera de especialidad) y desmontar 12
     * (14,4), y el daño empieza en cuanto el token ENTRA en la sección, antes
     * de llegar a la celda. Ni siquiera poner el parche bien a la primera
     * entraba en la ventana.
     *
     * El 8 no es un redondeo: sale de medir la cadena de recuperación completa
     * —viaje (~4 s) + desmontar la pieza equivocada (14,4) + instalar la
     * plancha (9,6) ≈ 28 s— contra los ~32 s que dan cinco mordiscos a este
     * ritmo. Equivocarse cuesta casi toda la vida del tripulante, pero se
     * arregla en un solo viaje.
     */
    biteIntervalSeconds: 8,
    /**
     * Fracción de HP máximo que se lleva cada mordisco. Cinco mordiscos matan
     * desde HP lleno: la muerte sigue llegando en golpes contables (lo que
     * arregló la ronda 1), lo que cambió en la ronda 3 es el ritmo.
     */
    hpFractionPerBite: 0.2,
  },

  /**
   * Peligro TÉRMICO sobre la tripulación (ronda 1 de playtest de 14a-2).
   *
   * Existía desde 14a-1 un eje de temperatura completo con escritores reales
   * (enfriador, derrame criogénico, combustión) y un consumidor de daño: la
   * ESTRUCTURA de la sección. La gente no tenía ninguno — el GDD pide "frío
   * extremo/congelación" en la tabla de causas de muerte (6.1) y "daño a
   * tripulante (térmico/…)" en 11.1, y no había ningún camino por el que la
   * temperatura tocara a un tripulante. Este es ese camino.
   *
   * **Los umbrales son PROPIOS, distintos de los de la sección**, y esa es la
   * decisión de diseño del bloque: `SECTION_INTEGRITY_PARAMETERS.thermal` usa
   * 100/-40 porque describe cuándo se deforma el casco, y un humano no aguanta
   * 99 °C. El orden completo del eje, de dentro hacia fuera:
   *
   * |                              | frío | calor |
   * |------------------------------|------|-------|
   * | Tripulante empieza a sufrir  | -10  |  60   |
   * | Estructura de la sección     | -40  | 100   |
   * | Conductor pierde capacidad   | -50  | 100   |
   * | Clamp del eje                | -80  | 900   |
   *
   * La gente muere ANTES que el casco, que es lo legible: una sala que mata no
   * se anuncia recién cuando además se está partiendo. `coldOnsetCelsius`
   * pasa a ser también el umbral de la escarcha en `/game` (antes atado al -40
   * de estructura), de modo que **ver escarcha = esta sala mata**, sin que el
   * jugador tenga que aprender un segundo número. Del lado del calor no hace
   * falta mover nada: el vapor ya coincide con el disparo del sensor térmico
   * por la decisión de 14a-1, y por eso `hotOnsetCelsius` importa ESA constante
   * en vez de repetir el 60 — si el balance mueve el sensor, el vapor, el daño
   * y el umbral se mueven juntos (principio 6 en su forma más barata).
   */
  thermal: {
    /** Por DEBAJO de esto un tripulante sin protección empieza a congelarse. */
    coldOnsetCelsius: -10,
    /** Por ENCIMA de esto empieza a quemarse. Mismo umbral que dispara el sensor térmico y el vapor. */
    hotOnsetCelsius: THERMAL_SENSOR_TRIGGER_CELSIUS,
    /**
     * Segundos entre mordiscos, DISCRETOS igual que el vacío y por el mismo
     * motivo documentado arriba: una fracción continua × `dtSeconds` a cadencia
     * de frame redondea a 0 y emite sangre sobre alguien inmortal.
     *
     * Más lento que el vacío (8 s) por decisión del operador: el vacío es el
     * peligro agudo —la sala está abierta y no hay nada que diagnosticar—
     * mientras que el eje térmico es nuevo para el jugador y necesita ventana
     * para leerse. Con 10 s y 15% por mordisco, morir desde HP lleno lleva ~70 s
     * contra los ~40 s del vacío.
     */
    biteIntervalSeconds: 10,
    /** Fracción de HP máximo por mordisco. Siete mordiscos matan desde HP lleno. */
    hpFractionPerBite: 0.15,
  },
} as const;
