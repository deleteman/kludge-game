import type { Footprint } from "../geometry/grid-position.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type {
  KineticDamageSeverity,
  KineticImpactEvent,
  VelocityLevel,
} from "./kinetic-events.types.js";

/**
 * Umbral de footprint "grande" (documento §3: "el tamaño/footprint de la
 * pieza, como proxy de masa"). Sin tabla numérica en ningún documento —
 * valor de referencia ajustable, mismo criterio de honestidad que
 * `THERMAL_CONDUCTIVITY_PARAMETERS` (caso de validación 2).
 */
export const KINETIC_IMPACT_PARAMETERS = {
  /** Área (width × height, unidades de grid) a partir de la cual una pieza cuenta como "grande". */
  largeFootprintArea: 4,
} as const;

/**
 * Resuelve el daño por impacto cinético (documento §3, tabla de resolución
 * literal): alto si la velocidad es alta; medio si la velocidad es media, o
 * si es baja pero el footprint es grande; bajo en el resto. Deliberadamente
 * no pondera "física real" (no ½mv²) — tabla cualitativa, mismo criterio que
 * el resto de reglas de interacción del GDD 5.6.
 */
export function resolveKineticImpact(
  velocity: VelocityLevel,
  footprint: Footprint,
  targetRef: string,
  tick: TickContext,
): KineticImpactEvent {
  const area = footprint.width * footprint.height;
  const severity = kineticDamageSeverity(velocity, area);
  return {
    kind: "kinetic-impact",
    targetRef,
    velocity,
    severity,
    elapsedSeconds: tick.elapsedSeconds,
  };
}

function kineticDamageSeverity(
  velocity: VelocityLevel,
  footprintArea: number,
): KineticDamageSeverity {
  if (velocity === "A") {
    return "high";
  }
  if (velocity === "M") {
    return "medium";
  }
  if (velocity === "B" && footprintArea >= KINETIC_IMPACT_PARAMETERS.largeFootprintArea) {
    return "medium";
  }
  return "low";
}
