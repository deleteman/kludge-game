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
   * Instancia que ES esta puerta, si nació de un componente instalado. Ausente
   * en las puertas autoradas en la capa Tiled `puertas`, que no son piezas del
   * catálogo. Cuando está presente, `ACT.cadence`/`ACT.power` se leen de su
   * definición — no se duplican acá (una sola fuente de verdad).
   */
  readonly instanceId?: PlacedComponentInstanceId;
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

/** `true` si la puerta ya no compartimenta nada y no puede volver a hacerlo sin reparación. */
export function isDoorDestroyed(door: DoorRuntime): boolean {
  return door.state === "destroyed";
}
