import type { CrisisEvalContext, CrisisResolutionRule } from "../crisis-rule.js";
import type {
  CrisisResolutionSpec,
  FunctionalTagInstalledResolutionSpec,
} from "../crisis-definition.types.js";

/**
 * Generaliza `ReplacementInstalledConnectedRule` a matching por tag funcional
 * (principio de diseño #1 de `CLAUDE.md`): verdadero cuando existe una
 * instancia en `spec.anchorPosition`, con `condition === "ok"`, cuya
 * definición resuelta (`ctx.componentRegistry`) declara al menos una
 * propiedad funcional con `tag === spec.requiredTag`. Sin `componentRegistry`
 * en el contexto no puede resolver nada — se considera no cumplida en vez de
 * lanzar, mismo criterio tolerante que el resto de las reglas ante datos
 * incompletos.
 */
export class FunctionalTagInstalledRule implements CrisisResolutionRule {
  readonly kind = "functional-tag-installed" as const;

  isResolved(spec: CrisisResolutionSpec, ctx: CrisisEvalContext): boolean {
    const typedSpec = spec as FunctionalTagInstalledResolutionSpec;
    if (!ctx.componentRegistry) {
      return false;
    }
    return ctx.ship.placedComponents.some((entry) => {
      if (
        entry.condition !== "ok" ||
        entry.placement.position.x !== typedSpec.anchorPosition.x ||
        entry.placement.position.y !== typedSpec.anchorPosition.y
      ) {
        return false;
      }
      const definition = ctx.componentRegistry!.get(entry.componentDefinitionId);
      return (definition?.data.functional ?? []).some((prop) => prop.tag === typedSpec.requiredTag);
    });
  }
}
