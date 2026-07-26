import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { EventEmitter } from "../simulation/event-emitter.js";
import type { MagneticFieldIntensity } from "./magnetic-field.js";
import type {
  KineticDomainEvent,
  MagneticAccelerationEvent,
  VelocityLevel,
} from "./kinetic-events.types.js";

/**
 * Peso por pulso según la intensidad del campo que lo produjo, y umbral de
 * peso acumulado para alcanzar cada nivel de velocidad (documento §2: "sin
 * tabla numérica" — valores de referencia ajustables, mismo criterio que
 * `MAGNETIC_FIELD_PARAMETERS`).
 */
export const VELOCITY_ACCUMULATION_PARAMETERS = {
  pulseWeightByIntensity: { B: 1, M: 2, A: 3 } as Record<
    Exclude<MagneticFieldIntensity, "N">,
    number
  >,
  /** Peso acumulado mínimo para alcanzar cada nivel de velocidad. */
  velocityThresholdWeight: { B: 1, M: 3, A: 6 } as Record<Exclude<VelocityLevel, "N">, number>,
  /**
   * Celdas recorridas sin influencia de ninguna bobina activa antes de que la
   * velocidad decaiga un nivel (ASA 2, Fase 11a.2). Sin tabla numérica en
   * ningún documento — valor de referencia ajustable, mismo criterio de
   * honestidad que el resto de `..._PARAMETERS`.
   *
   * Elegido deliberadamente conservador (decisión del operador, Fase 11a.2):
   * el hueco más grande entre bobinas del riel BIEN calculado del caso 17 es
   * ~7 celdas, pero la restricción real es el 2° test de ese caso — una
   * bobina mal ubicada pierde su pulso y el proyectil deriva ~14-16 celdas
   * sin influencia antes de alcanzar la siguiente bobina bien puesta. Un
   * umbral por debajo de ese hueco frena el proyectil antes de llegar,
   * dejando la bobina 3 sin nada que pulsar y el caso sin impacto — el drag
   * tiene que dejar sobrevivir un pulso perdido y recuperable, y solo actuar
   * como red de seguridad en derivas mucho más largas (sala vacía sin más
   * bobinas en absoluto).
   */
  dragThresholdCells: 25,
} as const;

const VELOCITY_ORDER: ReadonlyArray<VelocityLevel> = ["N", "B", "M", "A"];

function velocityForAccumulatedWeight(weight: number): VelocityLevel {
  const { velocityThresholdWeight } = VELOCITY_ACCUMULATION_PARAMETERS;
  if (weight >= velocityThresholdWeight.A) return "A";
  if (weight >= velocityThresholdWeight.M) return "M";
  if (weight >= velocityThresholdWeight.B) return "B";
  return "N";
}

function degradeOneLevel(level: VelocityLevel): VelocityLevel {
  const index = VELOCITY_ORDER.indexOf(level);
  return VELOCITY_ORDER[Math.max(0, index - 1)] as VelocityLevel;
}

/** Peso acumulado consistente con haber decaído a `level` (0 en reposo). */
function weightForDecayedLevel(level: VelocityLevel): number {
  return level === "N" ? 0 : VELOCITY_ACCUMULATION_PARAMETERS.velocityThresholdWeight[level];
}

/**
 * Estado interno completo del acumulador, capturable/restaurable (Fase 11a.3,
 * ASA 3). Sin esto, "continuar prediciendo desde ahora" era imposible: los
 * cuatro campos son `private` y no había forma de clonar un acumulador a
 * mitad de una secuencia de pulsos. Un dry-run que arrancara siempre en
 * reposo mentiría sobre cualquier proyectil ya en movimiento.
 */
export interface AccumulatorSnapshot {
  readonly accumulatedWeight: number;
  readonly previousIntensity: MagneticFieldIntensity;
  readonly velocity: VelocityLevel;
  readonly dragStepsApplied: number;
}

/**
 * Aceleración magnética con inercia acumulada (documento §2, mismo patrón de
 * clase-con-estado-y-tick que `HazardAccumulator`/`StructuralIntegrity`).
 *
 * Un "pulso" es un flanco de subida del campo (de "N" a una intensidad
 * activa) — no cada tick que el campo se mantiene activo: una bobina real
 * dispara una vez al paso del proyectil, no indefinidamente. Este criterio
 * reutiliza la misma detección de flanco que `CounterRule` (signals/) en vez
 * de introducir una semántica de "pulso" nueva.
 *
 * Inercia (principio 5 CLAUDE.md — ninguna acción se revierte gratis): el
 * peso acumulado no decrece solo porque el campo salga de rango entre dos
 * pulsos cercanos — sigue expuesto como nivel de velocidad más alto o igual
 * mientras el proyectil se mantenga bajo la influencia de alguna bobina.
 *
 * **Enmienda (ASA 2, Fase 11a.2 — 2026-07-17)**: fuera de esa influencia, la
 * inercia SÍ decrece, a propósito: `applyDrag` degrada la velocidad (y el
 * peso acumulado que la sostiene) cada `dragThresholdCells` celdas recorridas
 * sin un pulso nuevo. Sin esto, un proyectil que sale del alcance de todas
 * las bobinas conserva su velocidad para siempre y rebota sin control por
 * salas vacías (`nuevo-orden.md`, ASA Flaw 2).
 */
export class MagneticAccelerationAccumulator {
  private accumulatedWeight: number;
  private previousIntensity: MagneticFieldIntensity;
  private velocity: VelocityLevel;
  private pulsedOnLastTickFlag = false;
  private dragStepsApplied: number;

  /**
   * `initial` (Fase 11a.3) siembra el acumulador desde un `snapshot()` previo
   * en vez de arrancar en reposo — lo usa `ProjectileSimulation.registerFrom`
   * para continuar un dry-run de predicción desde el estado vivo actual.
   * Omitido, el comportamiento es idéntico al de antes de ASA 3.
   */
  constructor(
    private readonly ref: string,
    initial?: AccumulatorSnapshot,
  ) {
    this.accumulatedWeight = initial?.accumulatedWeight ?? 0;
    this.previousIntensity = initial?.previousIntensity ?? "N";
    this.velocity = initial?.velocity ?? "N";
    this.dragStepsApplied = initial?.dragStepsApplied ?? 0;
  }

  /** Copia inmutable del estado actual, para clonar el acumulador (Fase 11a.3). */
  snapshot(): AccumulatorSnapshot {
    return {
      accumulatedWeight: this.accumulatedWeight,
      previousIntensity: this.previousIntensity,
      velocity: this.velocity,
      dragStepsApplied: this.dragStepsApplied,
    };
  }

  get currentVelocity(): VelocityLevel {
    return this.velocity;
  }

  /**
   * Si el último `tick` fue un flanco de subida (un pulso), independientemente
   * de si eso cambió el nivel de velocidad. `tick` solo devuelve evento en
   * transición de nivel, así que sin esto un llamador no puede distinguir
   * "no hubo pulso" de "hubo pulso pero el nivel no cambió". Lo necesita
   * `ProjectileSimulation` para orientar el proyectil hacia la bobina que lo
   * pulsó y para reiniciar el contador de celdas del drag (ASA 2). Se expone
   * aquí en vez de duplicar la detección de flanco en el simulador: qué cuenta
   * como "pulso" debe definirse en un solo lugar.
   */
  get pulsedOnLastTick(): boolean {
    return this.pulsedOnLastTickFlag;
  }

  tick(
    fieldIntensity: MagneticFieldIntensity,
    tick: TickContext,
    emitter?: EventEmitter<KineticDomainEvent>,
  ): MagneticAccelerationEvent | null {
    const risingEdge = fieldIntensity !== "N" && this.previousIntensity === "N";
    this.previousIntensity = fieldIntensity;
    this.pulsedOnLastTickFlag = risingEdge;
    if (!risingEdge) {
      return null;
    }

    this.dragStepsApplied = 0;
    this.accumulatedWeight +=
      VELOCITY_ACCUMULATION_PARAMETERS.pulseWeightByIntensity[fieldIntensity];
    const newVelocity = velocityForAccumulatedWeight(this.accumulatedWeight);
    if (newVelocity === this.velocity) {
      return null;
    }
    this.velocity = newVelocity;
    const event: MagneticAccelerationEvent = {
      kind: "magnetic-acceleration",
      ref: this.ref,
      velocity: newVelocity,
      elapsedSeconds: tick.elapsedSeconds,
    };
    emitter?.emit(event);
    return event;
  }

  /**
   * Decae la velocidad un nivel por cada `dragThresholdCells` celdas
   * recorridas sin un pulso nuevo (ASA 2, Fase 11a.2). El llamador
   * (`ProjectileSimulation`) es responsable de invocar esto SOLO cuando el
   * proyectil no está bajo la influencia de ninguna bobina activa en el tick
   * actual — esta clase no conoce el campo en curso, solo cuenta celdas.
   *
   * `cellsSinceLastPulse` es monótono entre pulsos (lo resetea el llamador en
   * cada flanco de subida, que también resetea `dragStepsApplied` arriba), así
   * que dividir por el umbral da directamente cuántos escalones de drag
   * deberían estar aplicados a esta altura; solo se aplican los que faltan
   * desde la última llamada, para no repetir el mismo escalón cada tick.
   *
   * El peso acumulado se ajusta al umbral del nivel resultante (no solo la
   * velocidad expuesta): un pulso posterior tiene que volver a ganarse el
   * nivel perdido, no restaurarlo de un pico histórico que nunca bajó.
   */
  applyDrag(
    cellsSinceLastPulse: number,
    tick: TickContext,
    emitter?: EventEmitter<KineticDomainEvent>,
  ): MagneticAccelerationEvent | null {
    if (this.velocity === "N") {
      return null;
    }
    const steps = Math.floor(
      cellsSinceLastPulse / VELOCITY_ACCUMULATION_PARAMETERS.dragThresholdCells,
    );
    if (steps <= this.dragStepsApplied) {
      return null;
    }
    const newSteps = steps - this.dragStepsApplied;
    this.dragStepsApplied = steps;
    for (let i = 0; i < newSteps && this.velocity !== "N"; i += 1) {
      this.velocity = degradeOneLevel(this.velocity);
    }
    this.accumulatedWeight = weightForDecayedLevel(this.velocity);

    const event: MagneticAccelerationEvent = {
      kind: "magnetic-acceleration",
      ref: this.ref,
      velocity: this.velocity,
      elapsedSeconds: tick.elapsedSeconds,
    };
    emitter?.emit(event);
    return event;
  }
}
