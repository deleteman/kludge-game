import type { SectionId } from "../atmosphere/section.types.js";
import type { SectionPressureSinkSource } from "./mission-atmosphere-runtime.js";

/**
 * Compone varias fuentes de drenaje/recuperación de presión en una sola
 * (Subfase 13d). `MissionAtmosphereRuntime` acepta UN solo
 * `SectionPressureSinkSource` (`mission-atmosphere-runtime.ts`), hoy ocupado
 * por la junta rota del Capítulo 1 (`sealBreachPressureSink`); las fugas por
 * desmontaje necesitan sumarse a ese mismo canal en vez de reemplazarlo.
 *
 * Suma por sección respetando el signo (positivo drena, negativo recupera):
 * una sección que a la vez recupera por junta sellada y pierde por un hueco
 * recién abierto tiene el neto que su física indica, no el de la última fuente
 * que la escribió. La Subfase 13f necesita esta misma composición (hueco #5 de
 * su relevamiento) — se paga una vez.
 */
export function composePressureSinks(
  ...sources: ReadonlyArray<SectionPressureSinkSource | undefined>
): SectionPressureSinkSource {
  const present = sources.filter((source): source is SectionPressureSinkSource => source !== undefined);
  return () => {
    const totals = new Map<SectionId, number>();
    for (const source of present) {
      for (const [sectionId, rate] of source()) {
        totals.set(sectionId, (totals.get(sectionId) ?? 0) + rate);
      }
    }
    return totals;
  };
}
