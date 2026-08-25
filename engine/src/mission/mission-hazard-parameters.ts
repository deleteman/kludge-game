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
     */
    biteIntervalSeconds: 2,
    /**
     * Fracción de HP máximo que se lleva cada mordisco. Con un mordisco cada
     * 2 s, cinco mordiscos (~10 s desde HP lleno) matan: el margen que el
     * diseño de 13f pide para que el jugador vea el aviso y saque a su gente.
     */
    hpFractionPerBite: 0.2,
  },
} as const;
