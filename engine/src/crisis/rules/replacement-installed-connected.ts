import type { CrisisEvalContext, CrisisResolutionRule } from "../crisis-rule.js";
import type {
  CrisisResolutionSpec,
  ReplacementInstalledConnectedResolutionSpec,
} from "../crisis-definition.types.js";

/**
 * Resolución del capítulo 1: verdadero cuando existe una instancia en
 * `spec.anchorPosition` (misma celda que ocupaba el actuador atascado), con
 * `condition === "ok"` y `componentDefinitionId` entre los aceptables. La
 * posición es la identidad que importa, no el `instanceId` — cubre tanto
 * "reparar" (misma instancia, solo cambia `condition`) como "sustituir"
 * (desmontar + instalar una instancia nueva) con la misma regla.
 */
export class ReplacementInstalledConnectedRule implements CrisisResolutionRule {
  readonly kind = "replacement-installed-connected" as const;

  isResolved(spec: CrisisResolutionSpec, ctx: CrisisEvalContext): boolean {
    const typedSpec = spec as ReplacementInstalledConnectedResolutionSpec;
    return ctx.ship.placedComponents.some(
      (entry) =>
        entry.condition === "ok" &&
        entry.placement.position.x === typedSpec.anchorPosition.x &&
        entry.placement.position.y === typedSpec.anchorPosition.y &&
        typedSpec.acceptableComponentDefinitionIds.includes(entry.componentDefinitionId),
    );
  }
}
