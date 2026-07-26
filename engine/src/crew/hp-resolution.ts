import type { CrewDamageSeverity, CombustionEvent } from "../chemistry/reaction/reaction-events.types.js";
import type { KineticDamageSeverity, KineticImpactEvent } from "../kinetics/kinetic-events.types.js";
import type { CrewActor } from "./crew-actor.types.js";
import type { CrewDamageCause, CrewDomainEvent } from "./crew-events.types.js";

/**
 * Pérdida de HP como fracción del `maxHp`, por nivel de severidad cualitativa
 * (GDD 6.1: los tripulantes están sujetos a las mismas reglas físicas/químicas
 * que el jugador manipula). Sin tabla numérica de HP en el GDD — valores de
 * referencia data-driven, mismo criterio que `KINETIC_IMPACT_PARAMETERS`.
 */
export const HP_LOSS_FRACTION = {
  none: 0,
  low: 0.25,
  medium: 0.5,
  high: 1, // letal por sí sola, salvo que ya se hubiera curado HP de más (no modelado aquí).
} as const;

/** Resultado de aplicar daño a un `CrewActor`: el actor actualizado + el evento de dominio a emitir. */
export interface CrewHpResolution {
  readonly actor: CrewActor;
  readonly event: CrewDomainEvent;
}

/**
 * Aplica una pérdida de HP genérica y decide `crew-damaged` vs `crew-death`
 * (GDD 6.1: permadeath individual cuando `hp` llega a 0). Punto único de
 * resolución para que las dos fuentes de daño a tripulante (combustión,
 * impacto cinético) terminen en el mismo criterio de permadeath.
 */
function applyHpLoss(
  actor: CrewActor,
  fraction: number,
  cause: CrewDamageCause,
  elapsedSeconds: number,
  minHp = 0,
): CrewHpResolution {
  const rawLoss = Math.round(actor.maxHp * fraction);
  // `minHp` > 0 hace el daño NO letal (hiere pero nunca baja de ese piso).
  const remainingHp = Math.max(minHp, actor.hp - rawLoss);
  const hpLost = actor.hp - remainingHp;
  const updated: CrewActor = { ...actor, hp: remainingHp };
  const event: CrewDomainEvent =
    remainingHp <= 0
      ? { kind: "crew-death", actorId: actor.id, cause, elapsedSeconds }
      : { kind: "crew-damaged", actorId: actor.id, cause, hpLost, remainingHp, elapsedSeconds };
  return { actor: updated, event };
}

/**
 * Aplica una pérdida de HP arbitraria por una `fraction` de `maxHp` con una
 * causa explícita (10f, capítulo 2). Punto de entrada PÚBLICO sobre el mismo
 * `applyHpLoss` interno que usan combustión/cinética, para que una consecuencia
 * de crisis (`crew-damage`, sistema automatizado que electrocuta) llegue al
 * mismo criterio de permadeath sin duplicar la lógica. `CrisisRuntime` mapea la
 * `severity` de la consecuencia a la `fraction` (`HP_LOSS_FRACTION`).
 *
 * `options.minHp` > 0 hace el daño NO letal: el HP se pisa en ese mínimo y el
 * evento es siempre `crew-damaged` (nunca `crew-death`) — para capítulos donde
 * el permadeath aún no aplica (cap. 2 de la demo).
 */
export function applyCrewDamage(
  actor: CrewActor,
  fraction: number,
  cause: CrewDamageCause,
  elapsedSeconds: number,
  options?: { readonly minHp?: number },
): CrewHpResolution {
  return applyHpLoss(actor, fraction, cause, elapsedSeconds, options?.minHp ?? 0);
}

/**
 * Traduce un `CombustionEvent` (GDD 5.5, caso 11) a daño real sobre un
 * tripulante dentro del radio de la explosión. `intensity === "violent"` se
 * clasifica como causa "explosion" (gore/desmembramiento, GDD 6.8); el resto
 * de combustiones dañinas como "fire" (carbonización) — el motor de reacciones
 * no distingue explícitamente "incendio" de "explosión" más allá de la
 * intensidad, decisión data-driven equivalente a la ya tomada para severidad
 * cinética en `kinetic-impact.ts`.
 */
export function applyCombustionDamage(actor: CrewActor, event: CombustionEvent): CrewHpResolution {
  const severity: CrewDamageSeverity = event.crewDamage;
  const fraction = severity === "none" ? 0 : severity === "medium" ? HP_LOSS_FRACTION.medium : HP_LOSS_FRACTION.high;
  const cause: CrewDamageCause = event.intensity === "violent" ? "explosion" : "fire";
  return applyHpLoss(actor, fraction, cause, event.elapsedSeconds);
}

/**
 * Traduce un `KineticImpactEvent` (extensión GDD 5.2/5.6, documento §3, caso
 * de validación 17) a daño real sobre un tripulante/enemigo en la trayectoria.
 */
export function applyKineticDamage(actor: CrewActor, event: KineticImpactEvent): CrewHpResolution {
  const severity: KineticDamageSeverity = event.severity;
  return applyHpLoss(actor, HP_LOSS_FRACTION[severity], "kinetic-impact", event.elapsedSeconds);
}
