import type { SalvageDomainEvent, DismantleHazardKind } from "./salvage-hazard.types.js";
import type { DismantleHazardContext, DismantleHazardRule } from "./dismantle-hazard-rules.js";
import { createDefaultDismantleHazardRules } from "./dismantle-hazard-rules.js";

/**
 * Evalúa TODAS las condiciones de peligro de un desmontaje (Subfase 13d).
 * Función pura: no emite, no muta, no daña — eso es del handler. Así la UI
 * puede llamarla en pausa para pintar el badge de riesgo sin efectos
 * secundarios, y el efecto de tarea puede llamarla para disparar el hazard,
 * con la garantía de que ambos ven exactamente lo mismo.
 *
 * Las condiciones son ORTOGONALES, no excluyentes: desmontar un reservorio
 * energizado en una sección contaminada dispara los tres eventos.
 */
export function assessDismantleHazards(
  ctx: DismantleHazardContext,
  rules: ReadonlyArray<DismantleHazardRule> = createDefaultDismantleHazardRules(),
): ReadonlyArray<SalvageDomainEvent> {
  return rules.filter((rule) => rule.appliesTo(ctx)).map((rule) => rule.build(ctx));
}

/** Solo los `kind`, para la UI (que no necesita el evento completo). */
export function dismantleHazardKinds(
  ctx: DismantleHazardContext,
  rules?: ReadonlyArray<DismantleHazardRule>,
): ReadonlyArray<DismantleHazardKind> {
  return assessDismantleHazards(ctx, rules).map((event) => event.kind);
}
