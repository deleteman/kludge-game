import type Phaser from "phaser";

import type { GridPosition, StateDrivenEffect } from "../particle-effect.types.js";
import { type EffectScene, CELL, toPixel } from "../particle-utils.js";
import {
  ARC_BOLT_ALPHA,
  ARC_BOLT_JAGGEDNESS_PX,
  ARC_BOLT_SEGMENTS,
  ARC_BOLT_WIDTH_PX,
  ARC_FLASH_MS,
  ARC_MAX_INTERVAL_SECONDS,
  ARC_MIN_INTERVAL_SECONDS,
  OVERLOADED_SPARK_CORE_COLOR,
} from "../../render/palette.js";

/**
 * Arco eléctrico de un cable quemado (14a-4, ronda 3 de playtest).
 *
 * **Por qué existe.** La cicatriz de un cable traía una luz aditiva de 64 px
 * anclada en un punto de su recorrido — que resultaba ser la celda de una de las
 * piezas que unía. El operador vio "el chip brillando como si estuviera roto" y
 * pidió sacarla: *"eso oculta todo lo demás"*. Pero sin luz la cicatriz se
 * quedaba solo con chispas chicas, así que el operador propuso el reemplazo:
 * **descargas cortas que salgan de alguna celda del cable hacia algo cercano**.
 *
 * Dice lo mismo que la luz (esto está eléctricamente roto) y resuelve lo que la
 * luz hacía mal: es **direccional y transitorio**, se ve NACER en el cable, así
 * que atribuye el fallo al cable en vez de teñir lo que tenga debajo. Los
 * blancos incluyen las piezas de los extremos por decisión del operador — se
 * planteó excluirlas y decidió que no; lo que mantiene limpia la lectura es que
 * la pieza no gana ningún tinte ni glifo permanente por recibir un arco.
 *
 * **Es puramente visual.** No emite eventos de dominio, no toca el motor, no
 * daña a nadie y no aparece en `/engine`. Decisión explícita del operador ("por
 * ahora no tiene sentido que sea dañino"): si algún día lo fuera, la fuente de
 * verdad tendría que ser una regla del motor, no este archivo.
 *
 * Quién elige los blancos es `arcTargetsNear` (`render/conduit-path.ts`), pura y
 * testeada. Acá solo vive el azar y el dibujo: sin blanco disponible —un cable
 * en medio de una sala abierta— ese latido simplemente no dibuja nada y se
 * reintenta en el siguiente. Nunca se dispara al vacío.
 */

export interface ElectricArcState {
  /**
   * Celdas desde las que puede salir un arco (el CUERPO del cable, sin sus
   * extremos) y a dónde puede llegar. Se pasa por estado y no al arrancar
   * porque el ruteo del cable puede cambiar entre ticks; si queda vacío, el
   * efecto se queda quieto sin romperse.
   */
  readonly origins: ReadonlyArray<GridPosition>;
  readonly targetsFor: (origin: GridPosition) => ReadonlyArray<GridPosition>;
}

const centerPx = (cell: GridPosition): { x: number; y: number } => {
  const { px, py } = toPixel(cell);
  return { x: px, y: py };
};

/**
 * Rayo quebrado entre dos puntos: la recta con unos pocos vértices intermedios
 * desplazados en perpendicular. Un segmento recto se leería como un cable
 * nuevo, que es exactamente lo contrario de lo que este efecto comunica.
 */
function boltPoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
  random: () => number,
): Array<{ x: number; y: number }> {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  // Normal unitaria al segmento: es la dirección en la que se quiebra.
  const nx = -dy / length;
  const ny = dx / length;

  const points = [from];
  for (let i = 1; i < ARC_BOLT_SEGMENTS; i += 1) {
    const t = i / ARC_BOLT_SEGMENTS;
    const offset = (random() * 2 - 1) * ARC_BOLT_JAGGEDNESS_PX;
    points.push({ x: from.x + dx * t + nx * offset, y: from.y + dy * t + ny * offset });
  }
  points.push(to);
  return points;
}

export function createElectricArcEffect(
  onGraphicsCreated?: (graphics: Phaser.GameObjects.Graphics) => void,
): StateDrivenEffect<ElectricArcState> {
  let scene: EffectScene | undefined;
  let graphics: Phaser.GameObjects.Graphics | undefined;
  /** Segundos hasta el próximo arco. Arranca ya contando, no en 0, para que varios cables quemados no descarguen al unísono. */
  let untilNextArc = ARC_MIN_INTERVAL_SECONDS;
  /** Segundos que le quedan al arco visible; 0 = no hay ninguno. */
  let flashRemaining = 0;

  const scheduleNext = (): void => {
    untilNextArc =
      ARC_MIN_INTERVAL_SECONDS + Math.random() * (ARC_MAX_INTERVAL_SECONDS - ARC_MIN_INTERVAL_SECONDS);
  };

  return {
    start(s: EffectScene): void {
      scene = s;
      scheduleNext();
    },
    update(state: ElectricArcState, deltaSeconds: number): void {
      if (!scene) return;

      if (flashRemaining > 0) {
        flashRemaining -= deltaSeconds;
        if (flashRemaining <= 0) graphics?.clear();
        return;
      }

      untilNextArc -= deltaSeconds;
      if (untilNextArc > 0) return;
      scheduleNext();

      if (state.origins.length === 0) return;
      const origin = state.origins[Math.floor(Math.random() * state.origins.length)]!;
      const targets = state.targetsFor(origin);
      // Sin nada cerca contra qué descargar no se dibuja nada: un arco al aire
      // sería peor que ninguno, porque el jugador buscaría qué golpeó.
      if (targets.length === 0) return;
      const target = targets[Math.floor(Math.random() * targets.length)]!;

      if (!graphics) {
        graphics = scene.add.graphics();
        onGraphicsCreated?.(graphics);
      }
      graphics.clear();
      graphics.lineStyle(ARC_BOLT_WIDTH_PX, OVERLOADED_SPARK_CORE_COLOR, ARC_BOLT_ALPHA);
      // El destino se muestrea DENTRO de su celda y no en su centro exacto: dos
      // arcos seguidos a la misma pared aterrizando en el mismo píxel se leerían
      // como un objeto fijo, no como una descarga.
      const to = centerPx(target);
      const jitter = (): number => (Math.random() - 0.5) * CELL * 0.5;
      const points = boltPoints(centerPx(origin), { x: to.x + jitter(), y: to.y + jitter() }, Math.random);
      graphics.beginPath();
      graphics.moveTo(points[0]!.x, points[0]!.y);
      for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
      graphics.strokePath();

      flashRemaining = ARC_FLASH_MS / 1000;
    },
    stop(): void {
      graphics?.destroy();
      graphics = undefined;
      flashRemaining = 0;
    },
  };
}
