import type { DoorRuntime, GridPosition, SectionId } from "engine";

/**
 * Estado visual de una puerta (Subfase 13h, ronda 2 de playtest).
 *
 * Existe para dos cosas. La primera es dejar de duplicar: `doorOpenness` estaba
 * copiado textualmente en `floorplan-renderer.ts` (capa HUD) y en
 * `floorplan-scene.ts` (sprites), y los dos consumidores tienen que ver
 * exactamente la misma apertura o el contorno y la hoja se contradicen.
 *
 * La segunda es la curva y la dirección del movimiento, que son puramente de
 * presentación: el motor decide CUÁNTO abierta está la puerta, y este módulo
 * decide cómo se ve eso. `/engine` no sabe hacia qué lado corre una hoja, y no
 * tiene por qué saberlo.
 *
 * Nada de esto usa tweens de Phaser a propósito — ver el docblock de
 * `updateDoorSprites` en `floorplan-scene.ts`.
 */

/** 0 = hoja completamente cerrada, 1 = del todo abierta. Interpola en la transición. */
export function doorOpenness(door: DoorRuntime, transitionSeconds: number): number {
  const progress =
    transitionSeconds > 0
      ? Math.max(0, Math.min(1, door.transitionElapsedSeconds / transitionSeconds))
      : 1;
  switch (door.state) {
    case "open":
    case "destroyed":
      return 1;
    case "closed":
    case "jammed":
      return 0;
    case "opening":
      return progress;
    case "closing":
      return 1 - progress;
  }
}

/**
 * Igual que `doorOpenness` pero con aceleración y desaceleración (Sine.InOut),
 * que es lo que hace que la hoja se lea como una puerta real y no como una
 * interpolación lineal.
 *
 * Se aplica SOLO a la presentación: el paso se libera cuando el motor dice
 * `open`, no cuando la curva llega a 1. Las dos cosas terminan en el mismo
 * instante porque la curva respeta los extremos (0→0, 1→1) — es la única
 * propiedad que esta función tiene que garantizar para no mentirle al jugador.
 *
 * Escrita a mano en vez de usar `Phaser.Math.Easing` para que el módulo siga
 * siendo TS puro y testeable sin levantar Phaser.
 */
export function easedDoorOpenness(door: DoorRuntime, transitionSeconds: number): number {
  return easeInOutSine(doorOpenness(door, transitionSeconds));
}

function easeInOutSine(t: number): number {
  // Escrita como `(1 - cos)/2` y no como `-(cos - 1)/2`: la segunda forma
  // devuelve `-0` para la puerta cerrada, y un `-0` propagándose a la posición
  // de un sprite es exactamente la clase de detalle que después nadie encuentra.
  return (1 - Math.cos(Math.PI * t)) / 2;
}

/**
 * Eje a lo largo del cual corre la hoja al abrirse (decisión del operador:
 * automático, sin propiedades nuevas en Tiled).
 *
 * Una hoja corre SIEMPRE paralela al umbral, o sea perpendicular al sentido en
 * que se pasa por él. De ahí salen los dos casos:
 *  - Vano de más de una celda: el umbral ya declara su eje con su propia forma.
 *  - Vano de una celda: no hay forma que mirar, así que se deduce del sentido
 *    del paso — la dirección dominante entre los centros de las dos secciones
 *    que la puerta separa.
 */
export function doorSlideAxis(
  door: DoorRuntime,
  sectionCentroid: (sectionId: SectionId) => GridPosition | undefined,
): "x" | "y" {
  const xs = door.cells.map((cell) => cell.x);
  const ys = door.cells.map((cell) => cell.y);
  if (Math.max(...xs) > Math.min(...xs)) {
    return "x";
  }
  if (Math.max(...ys) > Math.min(...ys)) {
    return "y";
  }

  const centroidA = sectionCentroid(door.a);
  const centroidB = sectionCentroid(door.b);
  if (!centroidA || !centroidB) {
    return "x";
  }
  // Se pasa en x → la hoja corre en y, y al revés.
  return Math.abs(centroidB.x - centroidA.x) >= Math.abs(centroidB.y - centroidA.y) ? "y" : "x";
}
