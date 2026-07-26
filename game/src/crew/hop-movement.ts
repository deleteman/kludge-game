import type Phaser from "phaser";

/**
 * Movimiento por salto parabólico (GDD 11.2): trayectoria real bajo gravedad
 * constante, nunca deslizamiento continuo ni bamboleo sinusoidal. El offset
 * vertical usa `4·h·p·(1−p)` sobre el progreso normalizado `p ∈ [0,1]` — una
 * parábola real, no un loop de seno: ya da la velocidad correcta (lenta
 * cerca del ápice, acelerando en la caída) sin necesitar un split de easing
 * aparte. Es un patrón de animación (curva predefinida aplicada al sprite),
 * no una simulación física — no requiere motor de físicas dedicado.
 *
 * Puramente presentación: no depende de `crew/crew-actor.types.ts` de
 * `/engine` (el actor mínimo de datos), ni de ningún sprite real todavía
 * (GDD §17 — sprites de referencia pendientes del pack de arte).
 */

export type HopCadence = "normal" | "urgente" | "herido";

interface HopCadenceParams {
  readonly durationMs: number;
  readonly heightPx: number;
  /** [0,1]: variación aleatoria de duración/altura por salto — "irregular, entrecortado" del estado herido. */
  readonly irregularity: number;
}

/**
 * Valores de referencia (GDD §17: ajuste fino pendiente de sprites reales) —
 * no son constantes finales, son el punto de partida paramétrico.
 */
const HOP_CADENCE_PARAMS: Readonly<Record<HopCadence, HopCadenceParams>> = {
  // `normal` afinada para saltos de UNA celda (32px, ajuste post-playtest #5):
  // corto y rápido, para que una secuencia de saltos por celda lea como pasos
  // y no como brincos largos que cruzan medio pasillo.
  normal: { durationMs: 170, heightPx: 6, irregularity: 0 },
  urgente: { durationMs: 240, heightPx: 16, irregularity: 0.1 },
  herido: { durationMs: 460, heightPx: 6, irregularity: 0.45 },
};

/**
 * "Firma de salto" reutilizada por enemigos (GDD 11.2): mismo sistema de
 * `hopMove`, distintos parámetros — no un sistema de animación nuevo por
 * tipo de enemigo.
 */
export interface JumpSignature {
  readonly durationScale: number;
  readonly heightScale: number;
  readonly extraIrregularity: number;
}

export const CREW_SIGNATURE: JumpSignature = {
  durationScale: 1,
  heightScale: 1,
  extraIrregularity: 0,
};
export const ARMORED_ENEMY_SIGNATURE: JumpSignature = {
  durationScale: 1.7,
  heightScale: 0.55,
  extraIrregularity: 0,
};
export const AGILE_ENEMY_SIGNATURE: JumpSignature = {
  durationScale: 0.55,
  heightScale: 1.15,
  extraIrregularity: 0.35,
};

/** Cualquier objeto con posición y escala — sprite o container, agnóstico del asset real. */
export interface HopTarget {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

function bump(p: number): number {
  return 4 * p * (1 - p);
}

function jittered(value: number, irregularity: number): number {
  if (irregularity <= 0) return value;
  const spread = value * irregularity;
  return value + (Math.random() * 2 - 1) * spread;
}

/** Squash breve al aterrizar (GDD 11.2), como tween aparte tras completar el salto. */
function landingSquash(scene: Phaser.Scene, target: HopTarget, baseScaleX: number, baseScaleY: number): void {
  scene.tweens.add({
    targets: target,
    scaleY: baseScaleY * 0.8,
    scaleX: baseScaleX * 1.15,
    duration: 60,
    yoyo: true,
    ease: "Quad.easeOut",
  });
}

/**
 * Anima un salto de `from` a `to` sobre `target`. Devuelve el `Tween` de
 * Phaser para que el llamador encadene el siguiente salto en `onComplete`
 * (cadencia = secuencia de saltos, no un único salto largo).
 */
export function hopMove(
  scene: Phaser.Scene,
  target: HopTarget,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  cadence: HopCadence,
  signature: JumpSignature = CREW_SIGNATURE,
  /** Duración fija de ESTE salto (ms), si el llamador quiere repartir un viaje en una duración total (ej. la del `go-to`). Sobreescribe la duración de la cadencia; la altura sigue de la cadencia. */
  durationMsOverride?: number,
): Phaser.Tweens.Tween {
  const base = HOP_CADENCE_PARAMS[cadence];
  const irregularity = Math.min(1, base.irregularity + signature.extraIrregularity);
  const durationMs =
    durationMsOverride ?? jittered(base.durationMs * signature.durationScale, irregularity);
  const heightPx = jittered(base.heightPx * signature.heightScale, irregularity);
  const baseScaleX = target.scaleX;
  const baseScaleY = target.scaleY;

  target.x = from.x;
  target.y = from.y;

  const progress = { t: 0 };
  return scene.tweens.add({
    targets: progress,
    t: 1,
    duration: Math.max(durationMs, 1),
    ease: "Linear",
    onUpdate: () => {
      const p = progress.t;
      const hopOffset = heightPx * bump(p);
      target.x = from.x + (to.x - from.x) * p;
      target.y = from.y + (to.y - from.y) * p - hopOffset;
      // Estiramiento leve cerca del ápice — misma forma de parábola, sin seno.
      const stretch = 1 + 0.15 * bump(p);
      target.scaleY = baseScaleY * stretch;
      target.scaleX = baseScaleX * (2 - stretch);
    },
    onComplete: () => {
      target.x = to.x;
      target.y = to.y;
      target.scaleX = baseScaleX;
      target.scaleY = baseScaleY;
      landingSquash(scene, target, baseScaleX, baseScaleY);
    },
  });
}
