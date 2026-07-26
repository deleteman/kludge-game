import type { ChemicalProperties } from "../../properties/chemical-tag.types.js";
import type { CombustionAtmosphere } from "./reaction-context.types.js";
import type { CombustionRadius } from "./reaction-events.types.js";
import { COMBUSTION_RADIUS_BY_OXYGEN, REACTION_PARAMETERS } from "./reaction-parameters.js";

export interface MixtureHazardPreview {
  /** La mezcla participa de la regla de combustión (tiene COMB o VOLAT). */
  readonly combustible: boolean;
  /** Bucket de radio bajo el O2 efectivo — solo presente si `combustible` y el O2 efectivo no es `"none"`. */
  readonly combustionRadius?: CombustionRadius;
  /** La mezcla participa de la regla de degradación estructural (tiene CORR). */
  readonly corrosive: boolean;
  /** Segundos por nivel de RE perdido, a exposición media/alta — solo presente si `corrosive`. */
  readonly corrosionSecondsPerLevel?: { readonly medium: number; readonly high: number };
}

function hasTagName(tags: ChemicalProperties, name: string): boolean {
  return tags.some((tag) => tag.name === name);
}

/**
 * "Oxidante en sustancia equivale a atmósfera enriquecida" — mismo criterio
 * que `CombustionRule.effectiveOxygen` (rules/combustion.ts), reutilizado
 * acá para que el preview muestre el MISMO bucket que la regla real
 * terminaría aplicando, sin reimplementar ni divergir de esa lógica.
 */
function effectiveOxygen(
  tags: ChemicalProperties,
  sectionOxygen: CombustionAtmosphere,
): CombustionAtmosphere {
  return hasTagName(tags, "OXI") ? "high" : sectionOxygen;
}

/**
 * Deriva la ficha de riesgo "post-análisis" (Fase 11e, "Analizar Sustancia")
 * a partir de los tags de una mezcla y el O2 ACTUAL de su sección — pura, sin
 * estado, sin mutar nada. Se recalcula en cada consulta porque el radio de
 * combustión depende de dónde esté la mezcla en ese momento (si se mueve de
 * sección, el número visible cambia), fiel a lo que `CombustionRule`
 * realmente aplicaría si reaccionara ahí y ahora.
 *
 * NO inventa física nueva: expone las mismas constantes/buckets que ya
 * gobiernan combustión (`reaction-parameters.ts`) y corrosión (Espec. §1),
 * simplemente legibles antes de que la reacción ocurra — coherente con
 * CLAUDE.md ("no simular química real, el sistema de tags simplificado es
 * intencional").
 */
export function deriveMixtureHazardPreview(
  tags: ChemicalProperties,
  sectionOxygen: CombustionAtmosphere,
): MixtureHazardPreview {
  const combustible = hasTagName(tags, "COMB") || hasTagName(tags, "VOLAT");
  const oxygen = effectiveOxygen(tags, sectionOxygen);
  const corrosive = hasTagName(tags, "CORR");
  return {
    combustible,
    combustionRadius: combustible && oxygen !== "none" ? COMBUSTION_RADIUS_BY_OXYGEN[oxygen] : undefined,
    corrosive,
    corrosionSecondsPerLevel: corrosive
      ? {
          medium: REACTION_PARAMETERS.corrosion.structuralLevelSecondsMedium,
          high: REACTION_PARAMETERS.corrosion.structuralLevelSecondsHigh,
        }
      : undefined,
  };
}
