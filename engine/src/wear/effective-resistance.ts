import type { StructuralResistanceLevel } from "../properties/material.types.js";
import { RE_ORDER } from "../properties/material-order.js";
import { type ComponentWear, DEFAULT_WEAR, wearSteps } from "./wear.types.js";

/**
 * Resultado de la resistencia efectiva. `"fallo"` no es un nivel de RE del GDD
 * (que solo tiene A/M/B) sino el estado que sigue a B — la Espec. §1 lo escribe
 * literalmente así: "A→M→B→fallo". Modelarlo como valor evita que el llamador
 * tenga que consultar aparte un booleano `hasFailed`.
 */
export type EffectiveResistance = StructuralResistanceLevel | "fallo";

/**
 * Resistencia estructural EFECTIVA de una instancia = su RE de catálogo bajada
 * tantos escalones como desgaste acumulado (Subfase 13c).
 *
 *   catálogo A:  nuevo=A  usado=M  degradado=B  critico=fallo
 *   catálogo M:  nuevo=M  usado=B  degradado=fallo
 *   catálogo B:  nuevo=B  usado=fallo
 *
 * El mapeo 1:1 (un escalón de desgaste = un escalón de RE) es una decisión
 * cerrada con el operador (2026-08-05) y tiene dos consecuencias buscadas:
 *
 *  1. Preserva EXACTO el ritmo de degradación por corrosión de la Espec. §1
 *    (~15s por nivel a corrosivo medio): desde 13c `MissionStructuralRuntime`
 *    escribe `wear` en vez de `structuralResistanceOverride`, y como cada nivel
 *    de desgaste vale un nivel de RE, el timing observable no cambió. Sin este
 *    mapeo, corrosión y desgaste serían dos ejes contando el MISMO daño dos
 *    veces sobre la misma pieza.
 *  2. Una pieza de catálogo frágil (RE-B) llega a fallo con un solo escalón.
 *     Eso es exactamente lo que "frágil" significa — no es un caso a suavizar.
 *
 * Antes de 13c esta fórmula (`override ?? catálogo`) estaba REPLICADA en tres
 * sitios (`MissionStructuralRuntime`, `ship-status-aggregation`,
 * `LooseFerromagneticPromoter`); ahora es el único punto donde el desgaste
 * entra en el cálculo estructural.
 *
 * Devuelve `null` si la definición no declara RE (pieza sin dato de material):
 * el llamador decide si eso significa "no aplica" o "ignorar".
 */
export function effectiveResistance(
  catalogRE: StructuralResistanceLevel | undefined,
  wear: ComponentWear = DEFAULT_WEAR,
  legacyOverride?: StructuralResistanceLevel,
): EffectiveResistance | null {
  if (!catalogRE) {
    return null;
  }
  const fromWear = RE_ORDER.indexOf(catalogRE) + wearSteps(wear);
  // Retrocompatibilidad de saves ≤ v6 (Fase 11b): la cicatriz de corrosión se
  // guardaba como nivel de RE absoluto, y el deserializador no puede
  // convertirla a escalones de desgaste porque no conoce el catálogo (no
  // recibe el `EntityRegistry`). Se resuelve acá, que sí tiene el RE de
  // catálogo: gana el PEOR de los dos ejes, así una cicatriz vieja nunca se
  // pierde ni se suma dos veces al desgaste nuevo.
  const fromLegacy = legacyOverride ? RE_ORDER.indexOf(legacyOverride) : -1;
  return RE_ORDER[Math.max(fromWear, fromLegacy)] ?? "fallo";
}

/**
 * Nivel de RE efectivo como valor comparable: 0 = A … 3 = fallo. Para los
 * llamadores que necesitan ordenar/comparar dos resistencias efectivas sin
 * volver a razonar sobre el enum.
 */
export function effectiveResistanceSteps(resistance: EffectiveResistance): number {
  return resistance === "fallo" ? RE_ORDER.length : RE_ORDER.indexOf(resistance);
}
