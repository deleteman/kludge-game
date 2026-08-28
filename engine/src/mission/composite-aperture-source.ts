import type { VentilationConnection } from "../atmosphere/ventilation.types.js";
import type { SectionApertureSource } from "./mission-atmosphere-runtime.js";

/**
 * Compone varias fuentes de apertura en una sola (Subfase 13h). Molde de
 * `composePressureSinks`: `MissionAtmosphereRuntime` acepta UNA sola
 * `SectionApertureSource` y hay dos productores independientes —las válvulas de
 * conducto y las puertas— que necesitan sumarse a ese mismo canal en vez de
 * reemplazarse.
 *
 * A diferencia del sumidero de presión, acá NO se suma por clave: se
 * CONCATENAN las aristas. Es la traducción directa de la decisión del operador
 * de que la puerta sea independiente del conducto — entre dos secciones puede
 * haber a la vez un ducto de ventilación abierto y una puerta cerrada, y son
 * dos caminos distintos para el aire, no dos opiniones sobre el mismo camino.
 * `diffuse()` ya tolera aristas repetidas entre el mismo par: cada una aplica su
 * propio paso de equilibrado.
 */
export function composeApertureSources(
  ...sources: ReadonlyArray<SectionApertureSource | undefined>
): SectionApertureSource {
  const present = sources.filter((source): source is SectionApertureSource => source !== undefined);
  return () => {
    const connections: VentilationConnection[] = [];
    for (const source of present) {
      connections.push(...source());
    }
    return connections;
  };
}
