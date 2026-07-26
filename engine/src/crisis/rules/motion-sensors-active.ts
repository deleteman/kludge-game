import type { CrisisEvalContext, CrisisTriggerRule } from "../crisis-rule.js";
import type { CrisisTriggerSpec, MotionSensorsActiveTriggerSpec } from "../crisis-definition.types.js";

/**
 * Trigger del capítulo 2 ("Ecos en el Pasillo"): verdadero mientras TODOS los
 * sensores de movimiento referenciados por `spec.sensorInstanceIds` sigan
 * presentes en el plano. Mismo patrón de "presencia de componente" que
 * `JammedActuatorBlocksSectionRule` — no mira `condition`, solo existencia: los
 * sensores no están rotos, el problema es que su señal aún no está bien
 * combinada (eso lo resuelve `SignalOutputMatchesRule`).
 */
export class MotionSensorsActiveRule implements CrisisTriggerRule {
  readonly kind = "motion-sensors-active" as const;

  isTriggered(spec: CrisisTriggerSpec, ctx: CrisisEvalContext): boolean {
    const typedSpec = spec as MotionSensorsActiveTriggerSpec;
    if (typedSpec.sensorInstanceIds.length === 0) {
      return false;
    }
    return typedSpec.sensorInstanceIds.every((instanceId) =>
      ctx.ship.placedComponents.some((entry) => entry.instanceId === instanceId),
    );
  }
}
