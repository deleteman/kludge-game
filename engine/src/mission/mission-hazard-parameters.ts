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
} as const;
