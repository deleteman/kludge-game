import type { Tickable } from "../tasks/core-loop-mode.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { VentilationConnection } from "../atmosphere/ventilation.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import type { CrewActorId } from "../crew/crew-actor.types.js";
import type { MagneticFieldIntensity } from "../kinetics/magnetic-field.js";
import type { StructuralResistanceLevel } from "../properties/material.types.js";
import type { PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { PlacedComponentInstance } from "../blueprint/blueprint.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import { effectiveResistance } from "../wear/effective-resistance.js";
import { occupiedCells } from "../workbench/workbench-state.types.js";
import { DOOR_PARAMETERS } from "../doors/door-parameters.js";
import { doorAperture } from "../doors/door-aperture.js";
import {
  cellSeparates,
  doorActuator,
  doorTransitionSeconds,
  isDoorCapable,
  thresholdSectionsAt,
} from "../doors/door-identity.js";
import { resolveDoorGovernance } from "../doors/door-governance.js";
import type { DoorGovernanceContext, DoorGovernanceRule } from "../doors/door-governance.js";
import { createDefaultDoorRuleRegistry } from "../doors/door-rules/door-rule-registry.js";
import type { DoorDomainEvent } from "../doors/door-events.types.js";
import { blocksPassage, blocksPathing, toDoorSnapshot } from "../doors/door.types.js";
import type { DoorId, DoorRuntime, DoorSnapshot, DoorState } from "../doors/door.types.js";
import type { SectionApertureSource } from "./mission-atmosphere-runtime.js";

/**
 * Lo que la puerta necesita saber del mundo, como interfaz ANGOSTA e inyectada
 * (Subfase 13h). Mismo criterio que `EmitterInputSource` y
 * `SectionPressureSinkSource`: el runtime de puertas no conoce el grafo de
 * señales, ni el reparto de energía, ni el tilemap — solo hace preguntas.
 *
 * Todo es opcional: sin queries, las puertas funcionan en `auto` puro, que es
 * el comportamiento mínimo útil y el que corren los tests unitarios.
 */
export interface DoorWorldQueries {
  /** Celdas ocupadas por actores (tripulación Y enemigos): dispara la apertura automática. */
  readonly occupiedCells?: () => readonly GridPosition[];
  /** Tripulante en una celda concreta, para resolver el aplastamiento. */
  readonly crewAt?: (cell: GridPosition) => CrewActorId | undefined;
  /** Salida del nodo receptor cableado a esta puerta. `undefined` = sin cable tendido. */
  readonly signalOutput?: (door: DoorRuntime) => boolean | undefined;
  /**
   * `false` si el motor de ESTA puerta no está alimentado este tick.
   *
   * Toma la puerta y no un `SectionId` desde la ronda 2 de playtest, por dos
   * razones que resultaron ser la misma: preguntaba solo por `door.a` e
   * ignoraba `door.b` (una puerta separa DOS secciones), y preguntaba a nivel
   * de sección cuando quien decide si el motor cobra sus unidades es el reparto
   * por instancia de 13b. Con dos fuentes distintas de "esta puerta tiene
   * motor", podían discrepar — y discrepaban.
   */
  readonly powered?: (door: DoorRuntime) => boolean;
  /** Intensidad de campo magnético en una celda (caso de validación 9). */
  readonly magneticFieldAt?: (cell: GridPosition) => MagneticFieldIntensity;
}

export interface MissionDoorRuntimeOptions {
  readonly floorplan: ShipFloorplan;
  readonly snapshots?: readonly DoorSnapshot[];
  readonly rules?: readonly DoorGovernanceRule[];
  readonly queries?: DoorWorldQueries;
  readonly emitter?: (event: DoorDomainEvent) => void;
  /** Resuelve la definición de catálogo de una instancia instalada (puertas construidas). */
  readonly resolveDefinition?: (
    id: PlacedComponentInstance["componentDefinitionId"],
  ) => PhysicalComponentDefinition | undefined;
}

/**
 * Puertas vivas de una misión (Subfase 13h): dueño del estado, del gobierno por
 * reglas y de la transición de la hoja.
 *
 * Es el productor de las dos cosas que el resto del motor consume:
 *  - `apertureSource()` — la mitad "puertas" de la difusión atmosférica,
 *  - `blocksCell()` — el bloqueo de paso, que `/game` compone con el
 *    `WalkableGrid` del tilemap y que 13f ya usa para proyectiles y línea de
 *    visión. Es DELIBERADO que sea la misma consulta para los tres: si no, un
 *    proyectil atravesaría una puerta cerrada que un tripulante no puede cruzar.
 */
export class MissionDoorRuntime implements Tickable {
  private readonly doorsById = new Map<DoorId, DoorRuntime>();
  /** Cadencia de transición por puerta, resuelta del `ACT` al darla de alta. */
  private readonly transitionSecondsById = new Map<DoorId, number>();
  /** `ACT.power` por puerta: fuerza del motor (forzado manual y aplastamiento). */
  private readonly motorPowerById = new Map<DoorId, number>();
  private readonly resistanceById = new Map<DoorId, StructuralResistanceLevel>();
  private readonly rules: readonly DoorGovernanceRule[];
  private readonly taskOverrides = new Map<DoorId, boolean>();
  private readonly blockedCellKeys = new Set<string>();
  /** Estado guardado todavía sin puerta a la que aplicárselo — ver el constructor. */
  private readonly pendingSnapshots = new Map<DoorId, DoorSnapshot>();

  constructor(private readonly options: MissionDoorRuntimeOptions) {
    this.rules = options.rules ?? createDefaultDoorRuleRegistry();
    // Los snapshots quedan PENDIENTES hasta que `syncInstalledDoors` dé de alta
    // la puerta correspondiente: desde la ronda 1 de playtest de 13h no hay
    // ninguna puerta al construir el runtime (todas nacen de instancias), así
    // que restaurar acá no encontraría a quién aplicarle nada.
    for (const snapshot of options.snapshots ?? []) {
      this.pendingSnapshots.set(snapshot.doorId, snapshot);
    }
    this.recomputeBlockedCells();
  }

  /**
   * Sincroniza las puertas con el blueprint vivo: toda instancia `ACT` + `EST`
   * sobre una celda de umbral es una puerta, y deja de serlo al desmontarse.
   *
   * Es el ÚNICO camino de alta desde la ronda 1 de playtest de 13h. Antes había
   * dos —las autoradas en Tiled vivían acá adentro sin instancia detrás— y esa
   * dualidad era la causa de que no se les dibujara sprite ni se pudieran
   * cablear. Ahora la capa `puertas` materializa instancias reales
   * (`instantiate-door-seeds.ts`) y este método las recoge como a cualquier
   * otra.
   *
   * Se llama cuando cambia el blueprint (instalar/desmontar) y no por tick:
   * recorrer todas las instalaciones cada tick para redescubrir umbrales sería
   * trabajo repetido sobre datos que casi nunca cambian.
   */
  syncInstalledDoors(instances: readonly PlacedComponentInstance[]): void {
    const seen = new Set<DoorId>();

    for (const instance of instances) {
      const definition = this.options.resolveDefinition?.(instance.componentDefinitionId);
      if (!isDoorCapable(definition)) {
        continue;
      }
      const boundary = this.resolveBoundary(instance.placement.position);
      if (!boundary) {
        continue;
      }
      const id = `instance:${instance.instanceId}` as DoorId;
      seen.add(id);

      const actuator = doorActuator(definition);
      const resistance = effectiveResistance(
        definition?.data.material?.RE,
        instance.wear,
        instance.structuralResistanceOverride,
      );
      // Una hoja en "fallo" ya no aguanta nada: se trata como la más frágil, no
      // se la excluye — una puerta reventada sigue siendo una puerta.
      const level: StructuralResistanceLevel = resistance && resistance !== "fallo" ? resistance : "B";

      this.transitionSecondsById.set(id, doorTransitionSeconds(actuator));
      this.motorPowerById.set(id, actuator?.power ?? 0);
      this.resistanceById.set(id, level);

      if (!this.doorsById.has(id)) {
        const maxHp = DOOR_PARAMETERS.maxHpByResistance[level];
        const snapshot = this.pendingSnapshots.get(id);
        this.doorsById.set(id, {
          id,
          a: boundary.a,
          b: boundary.b,
          cells: occupiedCells(instance.placement),
          instanceId: instance.instanceId,
          mode: snapshot?.mode ?? "auto",
          // El save manda sobre la autoría: una partida cargada conserva el
          // estado en que quedó la puerta. `initialOpen` solo decide cómo NACE
          // (ronda 3 de playtest de 13g — hasta entonces el campo del mapa no
          // lo leía nadie y todas las puertas nacían cerradas).
          state: snapshot?.state ?? (boundary.initialOpen ? "open" : "closed"),
          transitionElapsedSeconds: 0,
          hp: snapshot?.hp ?? maxHp,
          maxHp,
        });
        this.pendingSnapshots.delete(id);
      }
    }

    // Baja de las que ya no están instaladas: desmontar una puerta —incluida
    // una del casco— quita esa frontera de la compartimentación.
    for (const [id] of this.doorsById) {
      if (!seen.has(id)) {
        this.doorsById.delete(id);
        this.transitionSecondsById.delete(id);
        this.motorPowerById.delete(id);
        this.resistanceById.delete(id);
        this.taskOverrides.delete(id);
      }
    }

    this.recomputeBlockedCells();
  }

  tick(ctx: TickContext): void {
    for (const door of this.doorsById.values()) {
      this.governDoor(door, ctx);
      this.advanceTransition(door, ctx);
    }
    this.recomputeBlockedCells();
  }

  private governDoor(door: DoorRuntime, ctx: TickContext): void {
    const queries = this.options.queries;
    const governanceContext: DoorGovernanceContext = {
      door,
      actorNearby: this.hasActorNearby(door),
      signalOutput: queries?.signalOutput?.(door),
      taskOverrideOpen: this.taskOverrides.get(door.id),
      powered: queries?.powered?.(door) ?? true,
      magneticFieldIntensity: this.strongestFieldAt(door),
      resistance: this.resistanceById.get(door.id) ?? "A",
    };

    const outcome = resolveDoorGovernance(this.rules, governanceContext);

    if (outcome.mode !== door.mode || outcome.overrideSource !== door.overrideSource) {
      door.mode = outcome.mode;
      door.overrideSource = outcome.overrideSource;
      this.emit({
        kind: "door-override-changed",
        doorId: door.id,
        sectionId: door.a,
        elapsedSeconds: ctx.elapsedSeconds,
        ...(outcome.overrideSource ? { source: outcome.overrideSource } : {}),
      });
    }

    if (outcome.forcedState) {
      // Trabada o rota: la hoja deja de moverse donde esté. No se emite
      // `door-settled` porque no llegó a destino — se quedó.
      door.state = outcome.forcedState;
      door.transitionElapsedSeconds = 0;
      return;
    }
    if (outcome.targetOpen === undefined) {
      // Sin motor: congelar. Distinto de cerrar — una puerta que se quedó sin
      // luz abierta sigue abierta, y esa sección sigue desangrándose.
      if (door.state === "opening" || door.state === "closing") {
        door.state = door.state === "opening" ? "closed" : "open";
        door.transitionElapsedSeconds = 0;
      }
      return;
    }

    this.startTransitionIfNeeded(door, outcome.targetOpen, ctx);
  }

  private startTransitionIfNeeded(door: DoorRuntime, targetOpen: boolean, ctx: TickContext): void {
    const alreadyThere =
      (targetOpen && (door.state === "open" || door.state === "opening")) ||
      (!targetOpen && (door.state === "closed" || door.state === "closing"));
    if (alreadyThere) {
      return;
    }
    // Una puerta a mitad de camino que cambia de idea NO reinicia el reloj:
    // conserva el avance invertido, así que interrumpir un cierre a la mitad
    // tarda medio ciclo en volver a abrir, no uno entero.
    const transitionSeconds = this.transitionSecondsFor(door.id);
    const inverted =
      door.state === "opening" || door.state === "closing"
        ? Math.max(0, transitionSeconds - door.transitionElapsedSeconds)
        : 0;

    door.state = targetOpen ? "opening" : "closing";
    door.transitionElapsedSeconds = inverted;

    if (!targetOpen) {
      this.crushOccupants(door, ctx);
    }

    this.emit({
      kind: "door-transition",
      doorId: door.id,
      sectionId: door.a,
      elapsedSeconds: ctx.elapsedSeconds,
      to: door.state,
      durationSeconds: transitionSeconds,
    });
  }

  private advanceTransition(door: DoorRuntime, ctx: TickContext): void {
    if (door.state !== "opening" && door.state !== "closing") {
      return;
    }
    door.transitionElapsedSeconds += ctx.dtSeconds;
    if (door.transitionElapsedSeconds < this.transitionSecondsFor(door.id)) {
      return;
    }
    const settled: Extract<DoorState, "open" | "closed"> = door.state === "opening" ? "open" : "closed";
    door.state = settled;
    door.transitionElapsedSeconds = 0;
    this.emit({
      kind: "door-settled",
      doorId: door.id,
      sectionId: door.a,
      elapsedSeconds: ctx.elapsedSeconds,
      to: settled,
    });
  }

  /**
   * La puerta se cierra sobre quien esté en el umbral. Es la consecuencia
   * directa de que `ACT.power` signifique algo, y lo que hace peligroso cablear
   * una puerta a una señal sin mirar quién está cruzando.
   *
   * El daño se reporta como evento; quién lo aplica al `CrewActor` es el
   * suscriptor, igual que con `CombustionEvent` — `/engine` emite el fenómeno,
   * no resuelve la reacción del tripulante.
   */
  private crushOccupants(door: DoorRuntime, ctx: TickContext): void {
    const crewAt = this.options.queries?.crewAt;
    if (!crewAt) {
      return;
    }
    for (const cell of door.cells) {
      const actorId = crewAt(cell);
      if (actorId) {
        this.emit({
          kind: "door-crushed-actor",
          doorId: door.id,
          sectionId: door.a,
          elapsedSeconds: ctx.elapsedSeconds,
          actorId,
        });
      }
    }
  }

  /** Daño a la hoja (hoy: enemigos que golpean una puerta que les bloquea el paso). */
  applyDamage(doorId: DoorId, amount: number, elapsedSeconds: number): void {
    const door = this.doorsById.get(doorId);
    if (!door || door.state === "destroyed" || amount <= 0) {
      return;
    }
    door.hp = Math.max(0, door.hp - amount);
    if (door.hp > 0) {
      this.emit({
        kind: "door-damaged",
        doorId: door.id,
        sectionId: door.a,
        elapsedSeconds,
        remainingHp: door.hp,
        maxHp: door.maxHp,
      });
      return;
    }
    door.state = "destroyed";
    door.transitionElapsedSeconds = 0;
    this.recomputeBlockedCells();
    this.emit({ kind: "door-destroyed", doorId: door.id, sectionId: door.a, elapsedSeconds });
  }

  /** Devuelve una puerta rota al servicio (tarea `repair-door`). */
  repair(doorId: DoorId, elapsedSeconds: number): void {
    const door = this.doorsById.get(doorId);
    if (!door) {
      return;
    }
    door.hp = door.maxHp;
    door.state = "closed";
    door.transitionElapsedSeconds = 0;
    this.recomputeBlockedCells();
    this.emit({ kind: "door-repaired", doorId: door.id, sectionId: door.a, elapsedSeconds });
  }

  /**
   * Override del jugador. `undefined` lo levanta y devuelve la puerta a `auto`.
   * `force-door` lo usa para dejar abierta una puerta sin energía: el override
   * sobrevive al corte porque la hoja quedó físicamente trabada en esa posición.
   */
  setTaskOverride(doorId: DoorId, open: boolean | undefined): void {
    if (open === undefined) {
      this.taskOverrides.delete(doorId);
      return;
    }
    this.taskOverrides.set(doorId, open);
  }

  /**
   * Abre a mano una puerta sin motor (`force-door`). Escribe el estado directo
   * en vez de pasar por el gobierno: la regla de "sin energía" congela la hoja,
   * así que sin este empujón el override de tarea nunca llegaría a aplicarse.
   */
  forceOpen(doorId: DoorId, elapsedSeconds: number): void {
    const door = this.doorsById.get(doorId);
    if (!door || door.state === "destroyed") {
      return;
    }
    door.state = "open";
    door.transitionElapsedSeconds = 0;
    this.setTaskOverride(doorId, true);
    this.recomputeBlockedCells();
    this.emit({
      kind: "door-settled",
      doorId: door.id,
      sectionId: door.a,
      elapsedSeconds,
      to: "open",
    });
  }

  /** Segundos que cuesta forzar una puerta a mano: cuanta más fuerza tiene el motor, más cuesta. */
  forceDurationSeconds(doorId: DoorId): number {
    const power = this.motorPowerById.get(doorId) ?? 0;
    return (
      DOOR_PARAMETERS.forceBaseSeconds + power * DOOR_PARAMETERS.forceSecondsPerPowerPoint
    );
  }

  /**
   * Segundos que tarda la hoja en completar su recorrido. Lo consume la capa
   * visual para interpolar la barra de la puerta con el MISMO número que usa la
   * simulación — si la UI usara una constante propia, la animación y la
   * apertura atmosférica se desincronizarían.
   */
  transitionSecondsOf(doorId: DoorId): number {
    return this.transitionSecondsFor(doorId);
  }

  /** `ACT.power` de la puerta — lo consume el cálculo de severidad del aplastamiento. */
  motorPowerOf(doorId: DoorId): number {
    return this.motorPowerById.get(doorId) ?? 0;
  }

  doorAt(cell: GridPosition): DoorRuntime | undefined {
    for (const door of this.doorsById.values()) {
      if (door.cells.some((candidate) => candidate.x === cell.x && candidate.y === cell.y)) {
        return door;
      }
    }
    return undefined;
  }

  doorById(doorId: DoorId): DoorRuntime | undefined {
    return this.doorsById.get(doorId);
  }

  allDoors(): readonly DoorRuntime[] {
    return [...this.doorsById.values()];
  }

  /**
   * Estado FÍSICO ahora mismo: ¿esta celda está tapada por una hoja? La
   * consumen la línea de visión del sensor óptico y los proyectiles de 13f —
   * para una bala, una puerta cerrada aunque sea funcional es una pared.
   */
  blocksCell(cell: GridPosition): boolean {
    return this.blockedCellKeys.has(`${cell.x},${cell.y}`);
  }

  /**
   * ¿Esta celda es un obstáculo para PLANIFICAR una ruta? Distinta pregunta que
   * `blocksCell` (ver `blocksPathing` en `door.types.ts`): una puerta que se va
   * a abrir sola cuando el tripulante llegue es una demora, no un muro.
   */
  blocksPathingAt(cell: GridPosition): boolean {
    const door = this.doorAt(cell);
    return door !== undefined && blocksPathing(door);
  }

  /**
   * Aristas atmosféricas que aportan las puertas — la mitad "puertas" de la
   * `SectionApertureSource`. Se SUMAN a las de los conductos en vez de
   * reemplazarlas: cerrar la puerta no cierra el ducto.
   */
  apertureSource(): SectionApertureSource {
    return () =>
      [...this.doorsById.values()].map(
        (door): VentilationConnection => ({
          a: door.a,
          b: door.b,
          valveAperture: doorAperture(door, this.transitionSecondsFor(door.id)),
        }),
      );
  }

  toSnapshots(): readonly DoorSnapshot[] {
    return [...this.doorsById.values()].map(toDoorSnapshot);
  }

  /**
   * Las dos secciones que separa la puerta de esta celda, en dos pasos (ronda 3
   * de playtest de 13g).
   *
   * 1. **Autorada**: si la capa Tiled `puertas` declara una puerta en esta
   *    celda, sus `a`/`b` MANDAN — el mapa ya dijo qué separa. Solo se verifica
   *    que la celda toque de verdad ambas secciones (`cellSeparates`), para que
   *    un mapa mal editado no invente una frontera que no existe.
   * 2. **Improvisada por el jugador**: no hay dato, así que se infiere de la
   *    geometría con `thresholdSectionsAt`, que sigue descartando las esquinas
   *    de tres salas porque ahí no hay nada que desempate.
   *
   * Por qué importa: hasta esta ronda solo existía el paso 2, así que el `a`/`b`
   * autorado se tiraba y se re-infería peor. Una puerta en la boca de un pasillo
   * toca TRES secciones —la sala, el pasillo y la sala de al lado— y quedaba
   * descartada en silencio: sin bloquear el paso, sin abrir, sin compartimentar,
   * pero dibujada y consumiendo energía. Es el bug que el operador reportó como
   * "los tripulantes le pasan por arriba y no se abre ni cierra".
   */
  private resolveBoundary(
    cell: GridPosition,
  ): { readonly a: SectionId; readonly b: SectionId; readonly initialOpen: boolean } | undefined {
    const authored = this.options.floorplan.doors.find(
      (seed) => seed.position.x === cell.x && seed.position.y === cell.y,
    );
    if (authored) {
      return cellSeparates(this.options.floorplan, cell, authored.a, authored.b)
        ? { a: authored.a, b: authored.b, initialOpen: authored.initialOpen }
        : undefined;
    }
    const threshold = thresholdSectionsAt(this.options.floorplan, cell);
    return threshold
      ? { a: threshold[0].id, b: threshold[1].id, initialOpen: false }
      : undefined;
  }

  private recomputeBlockedCells(): void {
    this.blockedCellKeys.clear();
    for (const door of this.doorsById.values()) {
      if (!blocksPassage(door)) {
        continue;
      }
      for (const cell of door.cells) {
        this.blockedCellKeys.add(`${cell.x},${cell.y}`);
      }
    }
  }

  private hasActorNearby(door: DoorRuntime): boolean {
    const occupied = this.options.queries?.occupiedCells?.();
    if (!occupied || occupied.length === 0) {
      return false;
    }
    return occupied.some((cell) =>
      door.cells.some(
        (doorCell) =>
          Math.abs(doorCell.x - cell.x) + Math.abs(doorCell.y - cell.y) <=
          DOOR_PARAMETERS.autoOpenRadiusCells,
      ),
    );
  }

  private strongestFieldAt(door: DoorRuntime): MagneticFieldIntensity {
    const query = this.options.queries?.magneticFieldAt;
    if (!query) {
      return "N";
    }
    const order: readonly MagneticFieldIntensity[] = ["N", "B", "M", "A"];
    let strongest: MagneticFieldIntensity = "N";
    for (const cell of door.cells) {
      const intensity = query(cell);
      if (order.indexOf(intensity) > order.indexOf(strongest)) {
        strongest = intensity;
      }
    }
    return strongest;
  }

  private transitionSecondsFor(doorId: DoorId): number {
    return this.transitionSecondsById.get(doorId) ?? DOOR_PARAMETERS.defaultTransitionSeconds;
  }

  private emit(event: DoorDomainEvent): void {
    this.options.emitter?.(event);
  }
}
