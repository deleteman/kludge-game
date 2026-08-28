import type { DoorRuntime } from "./door.types.js";

/**
 * Apertura atmosférica [0,1] de una puerta en este instante (Subfase 13h).
 *
 * La puerta aporta su propia arista de difusión entre `a` y `b`, INDEPENDIENTE
 * del conducto de ventilación que une a esas mismas secciones (decisión del
 * operador). Cerrar la puerta no cierra el ducto: para contener una fuga del
 * todo hay que cerrar también la válvula, y esa es justamente la tensión que
 * hace interesante el aislamiento deliberado del GDD §5.5.
 *
 * `opening`/`closing` INTERPOLAN en vez de ser un escalón. Sin esto, la
 * transición de `ACT.cadence` sería puramente cosmética: la atmósfera se
 * equilibraría de golpe en el tick en que la hoja termina de moverse, y el
 * tiempo que tarda la puerta no le costaría nada al jugador.
 */
export function doorAperture(door: DoorRuntime, transitionSeconds: number): number {
  switch (door.state) {
    // Un hueco permanente difunde como una puerta abierta: eso ES la
    // consecuencia de haberla perdido.
    case "open":
    case "destroyed":
      return 1;
    case "closed":
    case "jammed":
      return 0;
    case "opening":
      return transitionProgress(door.transitionElapsedSeconds, transitionSeconds);
    case "closing":
      return 1 - transitionProgress(door.transitionElapsedSeconds, transitionSeconds);
  }
}

function transitionProgress(elapsedSeconds: number, transitionSeconds: number): number {
  if (transitionSeconds <= 0) {
    return 1;
  }
  return Math.max(0, Math.min(1, elapsedSeconds / transitionSeconds));
}
