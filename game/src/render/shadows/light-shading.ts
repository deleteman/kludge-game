/**
 * Traducción de "nivel de luz" (`light-grid.ts`) a color (Fase 12d, cierre —
 * Obs 16). Puro y sin Phaser.
 *
 * El brillo de un sprite se resuelve por TINTE y no bajando una `PointLight`
 * encima: las luces viven a `RENDER_DEPTH.dynamicLight` (por debajo de los
 * sprites) justo para dejar de lavarlos con aditivo. El tinte de Phaser
 * multiplica la textura, así que escalar sus canales por el nivel de luz es
 * literalmente "cuánta luz refleja esta superficie".
 */

/** Tinte neutro: la textura sale tal cual. Base por defecto de cualquier sprite sin tinte propio. */
export const NEUTRAL_TINT = 0xffffff;

/**
 * Piso de brillo para tokens de tripulación y enemigos (decisión del operador
 * en el ciclo de preguntas de este cierre). Un actor en una sala sin luz se
 * oscurece, pero nunca hasta desaparecer: sigue siendo visible y clickeable
 * (patrón 3 del checklist de playtest — legibilidad real sobre el plano).
 * Los componentes NO llevan piso: son parte del decorado y pueden fundirse con
 * la penumbra.
 *
 * HONESTIDAD SOBRE SU ESTADO (patrón 7): con los valores de HOY este piso
 * **nunca se activa**. El nivel más bajo posible es el ambiente,
 * `1 - DYNAMIC_SHADOW_DARKNESS_ALPHA` = 0.5, que ya está por encima de 0.45. Se
 * conserva como red de seguridad para el día en que se suba esa constante (la
 * única palanca de contraste del sistema), no porque esté haciendo algo ahora.
 */
export const MIN_ACTOR_LIGHT_LEVEL = 0.45;

/**
 * Aplica un nivel de luz (0..1) a un color base, canal por canal. `level` 1
 * devuelve el color intacto; 0 devuelve negro.
 */
export function shade(baseColor: number, level: number): number {
  const factor = Math.min(1, Math.max(0, level));
  const r = Math.round(((baseColor >> 16) & 0xff) * factor);
  const g = Math.round(((baseColor >> 8) & 0xff) * factor);
  const b = Math.round((baseColor & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

/** Nivel efectivo de un ACTOR: el de la celda, pero nunca por debajo del piso legible. */
export function actorLightLevel(level: number): number {
  return Math.max(MIN_ACTOR_LIGHT_LEVEL, level);
}
