import type { GridPosition } from "../geometry/grid-position.types.js";
import { manhattanDistance } from "../geometry/grid-distance.js";
import type { EventEmitter } from "../simulation/event-emitter.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { Tickable } from "../tasks/core-loop-mode.js";
import type { CurrentLevel } from "./current-level.types.js";
import type { KineticDomainEvent, VelocityLevel } from "./kinetic-events.types.js";
import { resolveKineticImpact } from "./kinetic-impact.js";
import { MagneticAccelerationAccumulator, type AccumulatorSnapshot } from "./magnetic-acceleration.js";
import { activeCoilFieldIntensity, intensityAtDistance } from "./magnetic-field.js";
import type { MagneticFieldIntensity } from "./magnetic-field.js";
import {
  DIRECTION_AT_REST,
  type ActiveCoil,
  type GridDirection,
  type ProjectileBody,
  type ProjectileState,
  type ProjectileWorld,
} from "./projectile.types.js";

/**
 * Velocidad de avance en celdas por segundo para cada nivel cualitativo.
 * Sin tabla numérica en ningún documento (el doc §2 solo fija la escala
 * bajo/medio/alto) — valores de referencia ajustables, mismo criterio de
 * honestidad que `KINETIC_IMPACT_PARAMETERS` y `MAGNETIC_FIELD_PARAMETERS`.
 */
export const PROJECTILE_PARAMETERS = {
  cellsPerSecondByVelocity: { N: 0, B: 2, M: 5, A: 10 } as Record<VelocityLevel, number>,
} as const;

/**
 * Simulación de proyectiles ferromagnéticos sueltos sobre el plano
 * (documento §2 y §3). Es el primer llamador real de `kinetics/`: hasta la
 * Fase 11a el dominio existía completo pero desconectado, y el caso 17
 * simulaba el avance del proyectil a mano con un contador de bobinas.
 *
 * Responsabilidad única: mover el proyectil por celdas y decidir CUÁNDO
 * ocurre un pulso o un impacto. NO decide cuánta velocidad da un pulso
 * (`MagneticAccelerationAccumulator`), ni qué intensidad tiene un campo
 * (`magnetic-field.ts`), ni cuánto daño hace un impacto
 * (`kinetic-impact.ts`) — los compone.
 *
 * No conoce el plano: el mundo entra por el puerto `ProjectileWorld`, que
 * implementa el llamador (`/game`). Así `kinetics/` no importa `floorplan/`
 * ni `blueprint/` y estos tests corren con un fake.
 */
export class ProjectileSimulation implements Tickable {
  private readonly projectiles = new Map<string, ProjectileState>();
  private readonly bodies = new Map<string, ProjectileBody>();
  private readonly accumulators = new Map<string, MagneticAccelerationAccumulator>();

  constructor(
    private readonly world: ProjectileWorld,
    private readonly emitter?: EventEmitter<KineticDomainEvent>,
  ) {}

  /** Coloca una pieza ferromagnética suelta en el plano, en reposo. */
  register(body: ProjectileBody, position: GridPosition): ProjectileState {
    const state: ProjectileState = {
      ref: body.ref,
      position,
      direction: DIRECTION_AT_REST,
      velocity: "N",
      cellsSinceLastPulse: 0,
      cellProgress: 0,
    };
    this.projectiles.set(body.ref, state);
    this.bodies.set(body.ref, body);
    this.accumulators.set(body.ref, new MagneticAccelerationAccumulator(body.ref));
    return state;
  }

  /**
   * Coloca una pieza ferromagnética CONTINUANDO un estado ya en movimiento
   * (Fase 11a.3, ASA 3): a diferencia de `register`, que siempre arranca en
   * reposo, esto siembra el proyectil y su acumulador desde un snapshot vivo
   * — lo que permite predecir "desde ahora" en vez de "desde cero". `state`
   * se clona (no se referencia), así que mutarlo después no afecta a esta
   * simulación ni viceversa.
   */
  registerFrom(
    body: ProjectileBody,
    state: ProjectileState,
    accumulatorSnapshot: AccumulatorSnapshot,
  ): ProjectileState {
    const cloned: ProjectileState = { ...state, position: { ...state.position } };
    this.projectiles.set(body.ref, cloned);
    this.bodies.set(body.ref, body);
    this.accumulators.set(body.ref, new MagneticAccelerationAccumulator(body.ref, accumulatorSnapshot));
    return cloned;
  }

  get all(): ReadonlyArray<ProjectileState> {
    return [...this.projectiles.values()];
  }

  stateOf(ref: string): ProjectileState | undefined {
    return this.projectiles.get(ref);
  }

  /** `ProjectileBody` (footprint/RE) con el que se registró — lo necesita `previewTrajectory` para sembrar un dry-run (Fase 11a.3). */
  bodyOf(ref: string): ProjectileBody | undefined {
    return this.bodies.get(ref);
  }

  /** Snapshot del acumulador vivo de un proyectil ya registrado (Fase 11a.3). */
  accumulatorSnapshotOf(ref: string): AccumulatorSnapshot | undefined {
    return this.accumulators.get(ref)?.snapshot();
  }

  tick(ctx: TickContext): void {
    const coils = this.world.activeCoils();
    for (const projectile of this.projectiles.values()) {
      this.accelerate(projectile, coils, ctx);
      this.advance(projectile, ctx);
    }
  }

  /**
   * Resuelve el campo en la celda del proyectil y deja que el acumulador
   * decida la velocidad. Fuera de un pulso, si la celda del proyectil no
   * tiene influencia de ninguna bobina activa ("N"), consume las celdas
   * recorridas desde el último pulso como drag (ASA 2, Fase 11a.2) — un
   * campo sostenido (intensidad != "N" sin flanco nuevo) sigue contando como
   * "bajo influencia" y no decae.
   */
  private accelerate(
    projectile: ProjectileState,
    coils: ReadonlyArray<ActiveCoil>,
    ctx: TickContext,
  ): void {
    const accumulator = this.accumulators.get(projectile.ref);
    if (!accumulator) {
      return;
    }
    const inRange = coilsInRangeOf(projectile.position, coils);
    const intensity = fieldIntensityAt(projectile.position, inRange);
    accumulator.tick(intensity, ctx, this.emitter);
    if (accumulator.pulsedOnLastTick) {
      projectile.cellsSinceLastPulse = 0;
      projectile.direction = directionToward(projectile, nearestCoil(projectile.position, inRange));
    } else if (intensity === "N") {
      accumulator.applyDrag(projectile.cellsSinceLastPulse, ctx, this.emitter);
      if (accumulator.currentVelocity === "N") {
        projectile.direction = DIRECTION_AT_REST;
      }
    }
    projectile.velocity = accumulator.currentVelocity;
  }

  /**
   * Avance fraccionario por tick, resuelto celda a celda: un proyectil rápido
   * puede cruzar varias celdas en un tick y NO debe atravesar un obstáculo
   * intermedio sin colisionar.
   */
  private advance(projectile: ProjectileState, ctx: TickContext): void {
    const cellsPerSecond = PROJECTILE_PARAMETERS.cellsPerSecondByVelocity[projectile.velocity];
    if (cellsPerSecond <= 0 || isAtRest(projectile.direction)) {
      return;
    }
    projectile.cellProgress += cellsPerSecond * ctx.dtSeconds;
    while (projectile.cellProgress >= 1) {
      projectile.cellProgress -= 1;
      const next: GridPosition = {
        x: projectile.position.x + projectile.direction.dx,
        y: projectile.position.y + projectile.direction.dy,
      };
      const occupant = this.world.occupantAt(next);
      if (occupant) {
        this.impact(projectile, occupant.ref, ctx);
        return;
      }
      projectile.position = next;
      projectile.cellsSinceLastPulse += 1;
    }
  }

  /**
   * Impacto: emite el daño y detiene el proyectil en la celda anterior (no
   * entra en la celda ocupada). La inercia acumulada se pierde en la colisión
   * — el acumulador se reemplaza, de modo que la pieza puede volver a
   * acelerarse desde cero si el jugador la vuelve a pulsar.
   */
  private impact(projectile: ProjectileState, targetRef: string, ctx: TickContext): void {
    const body = this.bodies.get(projectile.ref);
    if (body) {
      this.emitter?.emit(resolveKineticImpact(projectile.velocity, body, targetRef, ctx));
    }
    projectile.velocity = "N";
    projectile.direction = DIRECTION_AT_REST;
    projectile.cellProgress = 0;
    this.accumulators.set(projectile.ref, new MagneticAccelerationAccumulator(projectile.ref));
  }
}

function isAtRest(direction: GridDirection): boolean {
  return direction.dx === 0 && direction.dy === 0;
}

/** Bobinas cuyo campo llega a la celda con intensidad efectiva (no "N"). */
function coilsInRangeOf(
  cell: GridPosition,
  coils: ReadonlyArray<ActiveCoil>,
): ReadonlyArray<ActiveCoil> {
  return coils.filter(
    (coil) =>
      intensityAtDistance(
        activeCoilFieldIntensity(1, coil.current),
        manhattanDistance(cell, coil.position),
      ) !== "N",
  );
}

/**
 * Intensidad resultante en la celda: la tabla del doc §1 se evalúa con el
 * número de bobinas que alcanzan la celda y la corriente más alta entre
 * ellas, y luego se degrada por la distancia a la MÁS CERCANA (la que
 * domina la atracción). Extrapolación documentada: el doc §1 no dice cómo
 * componer varias bobinas a distancias distintas, solo cuántas activas hay.
 */
function fieldIntensityAt(
  cell: GridPosition,
  inRange: ReadonlyArray<ActiveCoil>,
): MagneticFieldIntensity {
  if (inRange.length === 0) {
    return "N";
  }
  const base = activeCoilFieldIntensity(inRange.length, strongestCurrent(inRange));
  const nearest = nearestCoil(cell, inRange);
  return nearest ? intensityAtDistance(base, manhattanDistance(cell, nearest.position)) : "N";
}

function strongestCurrent(coils: ReadonlyArray<ActiveCoil>): CurrentLevel {
  const order: ReadonlyArray<CurrentLevel> = ["B", "M", "A"];
  return coils.reduce<CurrentLevel>(
    (best, coil) => (order.indexOf(coil.current) > order.indexOf(best) ? coil.current : best),
    "B",
  );
}

function nearestCoil(
  cell: GridPosition,
  coils: ReadonlyArray<ActiveCoil>,
): ActiveCoil | undefined {
  return coils.reduce<ActiveCoil | undefined>((closest, coil) => {
    if (!closest) {
      return coil;
    }
    return manhattanDistance(cell, coil.position) < manhattanDistance(cell, closest.position)
      ? coil
      : closest;
  }, undefined);
}

/**
 * El proyectil se mueve HACIA la fuente que lo pulsa (doc §2), por el eje
 * dominante — sin diagonales. Si la bobina está en la misma celda, conserva
 * la dirección que traía (la inercia, doc §2).
 *
 * Consecuencia buscada: es el jugador quien dirige el proyectil colocando y
 * temporizando bobinas, no un campo `direction` autorado (principio 1 de
 * CLAUDE.md, emergencia sobre recetas). Si pulsa una bobina que el proyectil
 * ya pasó de largo, lo tira hacia atrás — mistiming legítimo y legible, no
 * un bug.
 */
function directionToward(
  projectile: ProjectileState,
  coil: ActiveCoil | undefined,
): GridDirection {
  if (!coil) {
    return projectile.direction;
  }
  const deltaX = coil.position.x - projectile.position.x;
  const deltaY = coil.position.y - projectile.position.y;
  if (deltaX === 0 && deltaY === 0) {
    return projectile.direction;
  }
  return Math.abs(deltaX) >= Math.abs(deltaY)
    ? { dx: Math.sign(deltaX) as -1 | 0 | 1, dy: 0 }
    : { dx: 0, dy: Math.sign(deltaY) as -1 | 0 | 1 };
}
