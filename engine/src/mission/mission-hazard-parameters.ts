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
     * Fracción de HP máximo perdida por segundo en vacío. Calibrado para dar
     * ~10 segundos de margen desde HP lleno: tiempo suficiente para que el
     * jugador vea el aviso y saque al tripulante, no tanto como para que
     * entrar a una sección colapsada sea gratis.
     */
    hpFractionPerSecond: 0.1,
  },
} as const;
