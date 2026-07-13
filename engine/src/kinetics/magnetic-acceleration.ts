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
} as const;

function velocityForAccumulatedWeight(weight: number): VelocityLevel {
  const { velocityThresholdWeight } = VELOCITY_ACCUMULATION_PARAMETERS;
  if (weight >= velocityThresholdWeight.A) return "A";
  if (weight >= velocityThresholdWeight.M) return "M";
  if (weight >= velocityThresholdWeight.B) return "B";
  return "N";
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
 * peso acumulado NUNCA decrece solo porque el campo salga de rango; solo se
 * expone como nivel de velocidad más alto o igual, nunca más bajo, entre
 * pulsos.
 */
export class MagneticAccelerationAccumulator {
  private accumulatedWeight = 0;
  private previousIntensity: MagneticFieldIntensity = "N";
  private velocity: VelocityLevel = "N";

  constructor(private readonly ref: string) {}

  get currentVelocity(): VelocityLevel {
    return this.velocity;
  }

  tick(
    fieldIntensity: MagneticFieldIntensity,
    tick: TickContext,
    emitter?: EventEmitter<KineticDomainEvent>,
  ): MagneticAccelerationEvent | null {
    const risingEdge = fieldIntensity !== "N" && this.previousIntensity === "N";
    this.previousIntensity = fieldIntensity;
    if (!risingEdge) {
      return null;
    }

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
}
