import type { ChemicalTagLevel } from "../properties/chemical-tag.types.js";
import type { CombustionRadius } from "../chemistry/reaction/reaction-events.types.js";
import type { KineticDamageSeverity } from "../kinetics/kinetic-events.types.js";
import type { StructuralResistanceLevel } from "../properties/material.types.js";

/**
 * Parámetros numéricos de la vida por sección (Subfase 13f). Data-driven
 * (CLAUDE.md): todo el balance de la subfase vive acá y ninguna regla tiene
 * literales propios. Mismo criterio de honestidad que `REACTION_PARAMETERS` y
 * `PROJECTILE_PARAMETERS` — ningún documento fija estas cifras, son valores de
 * referencia para playtesting.
 *
 * La escala se eligió leyendo el mapa real (`nave-exploracion`): una sección
 * típica ronda las 30-60 celdas, o sea 300-600 HP. Con eso:
 *  - un impacto cinético `high` (120) obliga a repetir la maniobra ~4 veces,
 *  - una explosión `full-section` (250) se lleva la mitad de una sección chica,
 *  - la corrosión a nivel alto tarda ~1 minuto en romper una sección chica.
 */
export const SECTION_INTEGRITY_PARAMETERS = {
  /** Vida por celda de la sección; escala con `sectionArea()`. */
  hpPerCell: 10,

  /** Daño de un impacto cinético contra la pared de la sección, por severidad. */
  kineticDamageBySeverity: {
    low: 30,
    medium: 70,
    high: 120,
  } as Record<KineticDamageSeverity, number>,

  /**
   * Daño de una combustión, por radio. Le da consecuencia REAL al `radius` de
   * `CombustionEvent`, que hasta 13f solo alimentaba el tamaño del emisor de
   * partículas (`EMIT_RADIUS_PX` en `combustion-effect.ts`).
   */
  combustionDamageByRadius: {
    none: 0,
    "half-section": 120,
    "full-section": 250,
  } as Record<CombustionRadius, number>,

  /** Daño por segundo de atmósfera corrosiva, según el nivel del tag `CORR`. */
  corrosionDamagePerSecondByLevel: {
    A: 10,
    M: 5,
    B: 2,
  } as Record<ChemicalTagLevel, number>,

  decompression: {
    /**
     * Presión (kPa) por debajo de la cual la sección empieza a sufrir por
     * descompresión.
     *
     * Deliberadamente POR ENCIMA del piso global de fuga
     * (`PRESSURE_SINK_FLOOR_KPA` = 40). Se eligió 40 al escribir esta subfase y
     * se corrigió al auto-revisarla: con los dos números iguales, una fuga que
     * baja hasta el piso se queda exactamente en el umbral y **nunca causa
     * daño** — o sea que el único escenario de fuga que existe hoy (la junta
     * rota del Cap.1) habría dejado este escritor sin ningún camino real, un
     * indicador que no se mueve nunca.
     *
     * Con 60, una sección que se está desangrando acumula daño estructural
     * mientras cae, y la amortiguación (`floorFraction`) impide que eso sola
     * la reviente.
     */
    onsetKpa: 60,
    /** Daño por segundo con la sección a presión 0; escala linealmente desde `onsetKpa`. */
    maxDamagePerSecond: 4,
    /**
     * Piso de la descompresión, como fracción de `maxHp`: por sí sola NO puede
     * bajar de acá.
     *
     * Es la "amortiguación" que pide el diseño de 13f, y es estructural, no un
     * número afinado a ojo: sin ella el bucle se realimenta (menos vida → más
     * fuga → menos presión → más daño → …) y toda sección con una fuga termina
     * colapsando sola. Con el piso, la descompresión deteriora pero necesita
     * otro fenómeno —un impacto, una explosión— para abrir la brecha. Mismo
     * criterio que el `minHp: 1` de los hazards de desmontaje (13d).
     */
    floorFraction: 0.15,
  },

  breach: {
    /**
     * Drenaje de presión de una sección brechada, en kPa/s. Un orden de
     * magnitud por encima del de la junta rota del Cap.1 (1.5 kPa/s) a
     * propósito: eso es una gotera, esto es un agujero al vacío.
     */
    drainRateKpaPerSecond: 12,
    /**
     * Recuperación de presión una vez SELLADA la brecha, en kPa/s (ronda 2 de
     * playtest de 13f).
     *
     * 13f decidió a propósito que sellar solo detuviera la fuga, y que la
     * sección "se volviera a presurizar por los medios que ya existan". El
     * playtest destapó que no existe ninguno: `diffuse()` reparte fracciones de
     * gas pero nunca toca `pressureKpa`, y el sumidero es el único mecanismo
     * que lo mueve. O sea que la sala quedaba a 0 kPa —y letal— para siempre
     * aunque el jugador hiciera todo bien. Eso no es una consecuencia
     * permanente, es un callejón sin salida.
     *
     * Más lenta que el drenaje (12 kPa/s) a propósito: reventar es instantáneo,
     * recuperarse cuesta. Desde el vacío hasta la atmósfera estándar son ~50 s.
     * La cicatriz permanente sigue estando donde ocurrió el daño: la vida de la
     * sección no se recupera nunca y un impacto más vuelve a abrir el agujero.
     */
    recoveryRateKpaPerSecond: 2,
    /**
     * Piso de presión de una sección brechada: **vacío real**. El piso global
     * de 40 kPa (`PRESSURE_SINK_FLOOR_KPA`) sigue valiendo para el resto de la
     * nave — lo que distingue a una sección colapsada es justamente que se
     * queda sin atmósfera.
     */
    pressureFloorKpa: 0,
    /**
     * RE efectiva mínima de una pieza para servir de parche. Por propiedades y
     * no por lista de ids (principio 1): cualquier estructura lo bastante dura
     * tapa el agujero. Ver `isBreachPatch`.
     */
    minPatchResistance: "M" as StructuralResistanceLevel,
    /**
     * Cuánto pesa una sección BRECHADA en el indicador de casco de la nave, en
     * múltiplos de su tamaño (ronda 1 de playtest de 13f).
     *
     * Existe porque la media ponderada por tamaño, sola, se pasaba de frenada:
     * con el mapa real (335 celdas repartidas en 11 secciones) perder una
     * sección típica movía la fila del HUD un 7%, o sea casi nada. Corregir un
     * indicador que gritaba de más para dejar uno que no dice nada no es
     * corregirlo (patrón 7).
     *
     * Que pese MÁS que su volumen no es un truco de balance: un agujero al
     * vacío compromete a toda la nave, no solo a la sala que se abrió. Con 3,
     * una sección perdida deja el casco ~80%, tres lo llevan a la mitad y media
     * nave rota lo pone en crítico. Valor de playtesting, como el resto de este
     * archivo — ningún documento lo fija.
     */
    breachedSectionWeightMultiplier: 3,
  },

  collapse: {
    /** Rango de explosiones al colapsar una sección (inclusive). */
    minExplosions: 1,
    maxExplosions: 3,
  },
} as const;
