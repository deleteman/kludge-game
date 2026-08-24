import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { GridPosition } from "../geometry/grid-position.types.js";
import type {
  KineticDamageSeverity,
  KineticImpactEvent,
  VelocityLevel,
} from "./kinetic-events.types.js";
import type { CellOccupant, ProjectileBody } from "./projectile.types.js";
import { virtualMass, type VirtualMassLevel } from "./virtual-mass.js";

/**
 * Resuelve el daño por impacto cinético cruzando velocidad acumulada
 * (documento §2) con masa virtual (`virtual-mass.ts`, ASA 1). Sigue siendo una
 * tabla cualitativa y no física real (no ½mv²), mismo criterio que el resto de
 * reglas de interacción del GDD 5.6.
 *
 * DEROGA el documento §3 (decisión del operador, Fase 11a.1 — anotada también
 * en `docs/Extension_aceleracion_magnetica.md` §3, no solo aquí). El doc fijaba
 * "Daño alto si la velocidad es alta" sin mirar el tamaño; ahora la masa modula
 * en AMBOS sentidos, así que un proyectil ligero a velocidad alta hace daño
 * medio, no alto. Sin esa degradación, el defecto que ASA 1 existe para
 * corregir sobrevivía justo en la fila que más importa: una carcasa de plástico
 * y una plancha reforzada lanzadas igual de rápido seguían matando igual.
 *
 * |       | masa B | masa M | masa A |
 * |-------|--------|--------|--------|
 * | vel B | bajo   | bajo   | medio  |
 * | vel M | bajo   | medio  | alto   |
 * | vel A | medio  | alto   | alto   |
 */
export function resolveKineticImpact(
  velocity: VelocityLevel,
  body: ProjectileBody,
  target: CellOccupant,
  position: GridPosition,
  tick: TickContext,
): KineticImpactEvent {
  return {
    kind: "kinetic-impact",
    targetRef: target.ref,
    targetKind: target.kind,
    position,
    velocity,
    severity: kineticDamageSeverity(velocity, virtualMass(body.footprint, body.re)),
    elapsedSeconds: tick.elapsedSeconds,
  };
}

const VELOCITY_SCORE: Record<Exclude<VelocityLevel, "N">, number> = { B: 1, M: 2, A: 3 };
const MASS_SCORE: Record<VirtualMassLevel, number> = { B: 1, M: 2, A: 3 };

function kineticDamageSeverity(
  velocity: VelocityLevel,
  mass: VirtualMassLevel,
): KineticDamageSeverity {
  // Un proyectil en reposo no impacta (el simulador solo resuelve impactos de
  // proyectiles en movimiento), pero la tabla no puede quedar indefinida.
  if (velocity === "N") {
    return "low";
  }
  const score = VELOCITY_SCORE[velocity] + MASS_SCORE[mass];
  if (score >= 5) {
    return "high";
  }
  if (score >= 4) {
    return "medium";
  }
  return "low";
}
