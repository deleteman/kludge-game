import type { StructuralResistanceLevel } from "../properties/material.types.js";
import type { MagneticFieldIntensity } from "../kinetics/magnetic-field.js";

/**
 * Parámetros numéricos de puertas y compartimentación (Subfase 13h).
 * Data-driven (CLAUDE.md): todo el balance vive acá y ninguna regla tiene
 * literales propios. Mismo criterio de honestidad que
 * `SECTION_INTEGRITY_PARAMETERS` — ningún documento fija estas cifras, son
 * valores de referencia para playtesting.
 */
export const DOOR_PARAMETERS = {
  /**
   * Vida de la puerta según su `RE` efectiva. La escala se eligió contra el
   * daño de arma que ya existe (`weaponDamageSeverity` → `HP_LOSS_FRACTION`
   * sobre 100 de vida de tripulante: low 25, medium 50, high 100): una
   * `compuerta-blindada` RE-A aguanta ~6 golpes medios antes de ceder, tiempo
   * suficiente para que el jugador reaccione pero no para ignorar al intruso.
   *
   * La `RE` sale de la definición de la pieza; `A` es el fallback para una
   * definición que no declare material.
   */
  maxHpByResistance: {
    A: 300,
    M: 150,
    B: 60,
  } as Record<StructuralResistanceLevel, number>,

  /**
   * Radio (Manhattan, en celdas) dentro del cual un actor dispara la apertura
   * automática. 1 = "está justo al lado del umbral".
   *
   * Deliberadamente corto: con un radio mayor la nave dejaría de estar
   * compartimentada en la práctica —un tripulante caminando por el pasillo
   * abriría media nave a su paso— y se perdería justo la consecuencia que esta
   * subfase existe para producir.
   */
  autoOpenRadiusCells: 1,

  /**
   * Intensidad de campo mínima en la celda de la puerta para trabarla
   * (caso de validación 9, "El Electroimán de Emergencia"). Se compara contra
   * `intensityAtDistance(activeCoilFieldIntensity(...), distancia)`.
   *
   * `M` y no `A` a propósito: con `A` haría falta el electroimán pegado a la
   * puerta y el caso 9 dejaría de tener margen de maniobra; con `B` cualquier
   * bobina suelta trabaría puertas por accidente.
   */
  magneticLockMinIntensity: "M" as MagneticFieldIntensity,

  /**
   * RE efectiva mínima para que una puerta sea trabable por electroimán. Por
   * propiedades y no por lista de ids (principio 1): lo que traba el campo es
   * una hoja de metal, no una pieza concreta del catálogo. Mismo criterio que
   * `minPatchResistance` de 13f.
   */
  magneticLockMinResistance: "M" as StructuralResistanceLevel,

  /**
   * Umbral de vida, como fracción de `maxHp`, bajo el cual la puerta se traba
   * por deformación (`jammed-damage`): golpeada pero no rota, ya no corre por
   * su riel. Es lo que hace que castigar una puerta tenga un efecto intermedio
   * entre "intacta" y "hueco permanente" en vez de un interruptor.
   */
  damageJamFraction: 0.25,

  /**
   * Duración base (segundos) de `force-door`, y cuánto suma por punto de
   * `ACT.power`. Una `compuerta-blindada` (power 70) sale ~24 s: lento a
   * propósito, es abrir a mano una puerta blindada sin motor.
   */
  forceBaseSeconds: 10,
  forceSecondsPerPowerPoint: 0.2,

  /** Duración base (segundos) de `repair-door` y de `set-valve`. */
  repairSeconds: 20,
  setValveSeconds: 6,

  /**
   * Tiempo de transición (segundos) de una puerta cuya definición no declara
   * `ACT.cadence`. Desde la ronda 1 de playtest TODA puerta es una instancia de
   * catálogo, así que esto es un fallback defensivo, no el caso normal: la
   * fuente de verdad es `ACT.cadence` (`transitionSecondsOf`).
   *
   * Alineado con la cadencia real de `compuerta-blindada` (ronda 2): si el
   * fallback y la pieza discreparan, una puerta improvisada se movería a otra
   * velocidad que la del casco sin ninguna razón de diseño.
   */
  defaultTransitionSeconds: 1.5,

  /**
   * Umbral de `ACT.power` a partir del cual el aplastamiento sube de severidad.
   * Le da consecuencia real al `power` de la puerta: una compuerta blindada
   * (70) hace daño `medium`, un panel liviano `low`. Nunca `high` — una puerta
   * que se cierra no es una explosión, y el actor tiene tiempo de retroceder.
   */
  crushMediumPowerThreshold: 50,
} as const;
