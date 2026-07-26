import type { CrisisEvalContext, CrisisTriggerRule } from "../crisis-rule.js";
import type { CrisisTriggerSpec, JammedActuatorBlocksSectionTriggerSpec } from "../crisis-definition.types.js";

/**
 * Trigger del capítulo 1 ("Primer Aviso"): verdadero cuando la instancia
 * referenciada por `spec.instanceId` está presente en el plano con
 * `condition === "jammed"`. Si la instancia fue desmontada por completo
 * (reemplazo total antes de que la crisis se dispare, caso límite), no hay
 * instancia que verificar y el trigger no aplica.
 */
export class JammedActuatorBlocksSectionRule implements CrisisTriggerRule {
  readonly kind = "jammed-actuator-blocks-section" as const;

  isTriggered(spec: CrisisTriggerSpec, ctx: CrisisEvalContext): boolean {
    const typedSpec = spec as JammedActuatorBlocksSectionTriggerSpec;
    const instance = ctx.ship.placedComponents.find((entry) => entry.instanceId === typedSpec.instanceId);
    return instance !== undefined && instance.condition === "jammed";
  }
}
