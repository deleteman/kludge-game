import type { Brand } from "../shared/brand.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";

/**
 * Puertas y compartimentación (Subfase 13h).
 *
 * El GDD §5.5 define el "aislamiento deliberado" —sellar una puerta o cerrar
 * una válvula para contener una fuga o privar de oxígeno a una sección— y hasta
 * esta subfase era letra muerta: `VentilationConnection.valveAperture` se fijaba
 * al construir la misión y NADA lo mutaba en runtime.
 *
 * Una puerta NO es un objeto especial con una regla de señal colgada. Es una
 * instalación con `ACT` (mueve una hoja) + `EST` (aguanta) sobre un umbral, y es
 * exactamente eso lo que la vuelve puerta — identidad por propiedades, nunca por
 * id de catálogo (principio 1 de CLAUDE.md). Su `ACT` no es decorativo:
 *  - `cadence` es el tiempo que tarda la hoja en abrirse o cerrarse,
 *  - `power` es la fuerza del motor (resiste el forzado manual, aplasta al que
 *    quede en el umbral al cerrarse).
 */
export type DoorId = Brand<string, "DoorId">;

/**
 * Quién manda sobre la puerta.
 *
 * `auto` es el DEFAULT y es lo que hace que la nave esté compartimentada por
 * defecto: la puerta se abre para dejar pasar a un actor y se cierra sola el
 * resto del tiempo. La consecuencia buscada es emergente, no scripteada — una
 * brecha de 13f deja de desangrar al resto de la nave sola, y en cuanto el
 * jugador manda a alguien a la sección rota la puerta se abre y la presión se
 * escapa.
 */
export type DoorMode = "auto" | "override";

/**
 * Estado de la hoja. `opening`/`closing` existen porque la transición dura
 * `ACT.cadence` segundos: durante ese tramo la apertura atmosférica INTERPOLA
 * (no es un escalón) y el paso sigue bloqueado hasta llegar a `open`. Eso vuelve
 * táctico el tiempo — mandar a alguien a una sección con brecha cuesta unos
 * segundos de fuga.
 *
 * `destroyed` es terminal dentro de la misión salvo reparación explícita
 * (`repair-door`): un hueco permanente que ya no compartimenta (principio 5).
 */
export type DoorState = "open" | "opening" | "closing" | "closed" | "jammed" | "destroyed";

/**
 * MOTIVO por el que la puerta no responde. Existe para que la UI pueda decir
 * *por qué* en vez de solo no responder — mismo criterio que los motivos
 * tipados de `fabricatorBlocked` (13e) y `extractionBlocked`.
 */
export type DoorOverrideSource =
  | "signal"
  | "task"
  | "jammed-damage"
  | "magnetic-lock"
  | "unpowered";

/** Estado vivo de una puerta. Campos escalares MUTABLES, convención de `SectionIntegrity`. */
export interface DoorRuntime {
  readonly id: DoorId;
  readonly a: SectionId;
  readonly b: SectionId;
  /** Celdas del umbral que la puerta bloquea cuando no está atravesable. */
  readonly cells: readonly GridPosition[];
  /**
   * Instancia que ES esta puerta. Obligatoria desde la ronda 1 de playtest de
   * 13h: las puertas del casco también son instancias reales de catálogo
   * (`instantiate-door-seeds.ts`), y esa unificación es lo que les da sprite y
   * nodo de señal. `ACT.cadence`/`ACT.power` se leen de su definición — no se
   * duplican acá (una sola fuente de verdad).
   */
  readonly instanceId: PlacedComponentInstanceId;
  mode: DoorMode;
  state: DoorState;
  overrideSource?: DoorOverrideSource;
  /** Avance dentro de `opening`/`closing`, en segundos. 0 fuera de la transición. */
  transitionElapsedSeconds: number;
  hp: number;
  readonly maxHp: number;
}

/** Forma serializable — molde exacto de `SectionIntegritySnapshot`. */
export interface DoorSnapshot {
  readonly doorId: DoorId;
  readonly state: DoorState;
  readonly mode: DoorMode;
  readonly hp: number;
  readonly maxHp: number;
}

export function toDoorSnapshot(door: DoorRuntime): DoorSnapshot {
  return {
    doorId: door.id,
    state: door.state,
    mode: door.mode,
    hp: door.hp,
    maxHp: door.maxHp,
  };
}

/** `true` si la puerta no deja pasar actores ni proyectiles en este instante. */
export function blocksPassage(door: DoorRuntime): boolean {
  return door.state !== "open" && door.state !== "destroyed";
}

/**
 * `true` si la puerta NO PUEDE abrirse — la pregunta del pathfinding, distinta
 * de `blocksPassage` (ronda 1 de playtest de 13h).
 *
 * Colapsar las dos fue el bug que dejó la nave entera inalcanzable: como las
 * puertas arrancan cerradas, tratar "cerrada" como "pared" hacía que `findPath`
 * no encontrara ruta a ninguna parte y todo `go-to` muriera en "Sin ruta al
 * destino".
 *
 * Una puerta cerrada en `auto` con energía no es un obstáculo: es una DEMORA —
 * se abre sola cuando el tripulante llega. Solo bloquea de verdad la que está
 * trabada, sin energía, o cerrada por un override de señal o de tarea, y para
 * esas el aviso de "sin ruta" vuelve a ser información honesta.
 *
 * Los proyectiles y la línea de visión siguen usando `blocksPassage`: para una
 * bala, una puerta cerrada aunque sea funcional sí es una pared.
 *
 * **Ronda 1 de playtest de 14a-4**: faltaba mirar el ESTADO. El texto de arriba
 * dice "cerrada por un override" y el código decía "cualquier override", así que
 * una puerta que la señal mantiene ABIERTA (`state: "open"` + `mode:
 * "override"`) se trataba como pared: el jugador cableaba la puerta de la
 * bodega, la abría con el sensor, y el tripulante de adentro seguía sin poder
 * salir. Era el único de los tres predicados de puerta que ignoraba `state`
 * (`blocksPassage` acá al lado y `isDoorwayHeldClosed` en la escena sí lo
 * miran), y por eso render y planificación discrepaban justo en ese cruce.
 */
export function blocksPathing(door: DoorRuntime): boolean {
  if (door.state === "destroyed") {
    return false;
  }
  if (door.state === "jammed") {
    return true;
  }
  // Una hoja abierta —o abriéndose, que estará abierta para cuando el
  // tripulante llegue— no es obstáculo, la gobierne quien la gobierne. Solo
  // después de descartarla tiene sentido preguntar quién manda sobre la puerta.
  if (door.state === "open" || door.state === "opening") {
    return false;
  }
  return door.mode === "override";
}

/** `true` si la puerta ya no compartimenta nada y no puede volver a hacerlo sin reparación. */
export function isDoorDestroyed(door: DoorRuntime): boolean {
  return door.state === "destroyed";
}
