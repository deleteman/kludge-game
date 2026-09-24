import type { SectionId } from "../atmosphere/section.types.js";
import type { SectionAtmosphere } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import { chemicalSensorReading } from "./chemical-emitter-input-source.js";
import { resolveWiredSensorSource, type SensorReadingRegistries } from "./wired-sensor-source.js";

/**
 * Valor legible que una Pantalla LCD puede mostrar (Subfase 11h; temperatura y
 * concentración química en 14b-3). Union discriminada, no un `number` suelto:
 * cada variante se agrega cuando exista una fuente real que resolver (nivel de
 * reservorio, estado de un latch: ver puntos 9/10 de PENDIENTES_OBSERVACIONES.md).
 */
export type LcdDisplayValue =
  | { readonly kind: "pressure"; readonly sectionId: SectionId; readonly pressureKpa: number }
  | { readonly kind: "temperature"; readonly sectionId: SectionId; readonly temperatureCelsius: number }
  /** Fracción del aire ocupada por el peor contaminante TOX/CORR — la misma lectura que dispara al escáner. */
  | { readonly kind: "chemical"; readonly sectionId: SectionId; readonly concentration: number };

/**
 * Resuelve qué valor real debe mostrar una Pantalla LCD instalada, siguiendo
 * el cableado del grafo de señales hasta su fuente — NO lee el booleano
 * `SignalEvaluator` (ese solo sabe ON/OFF), lee directo el runtime de dominio
 * correspondiente (canal de lectura directa, decisión confirmada con el
 * operador en la planificación de 11h). Resolución por TAG del componente
 * fuente (`EM`/`triggerType`), no por identidad — principio 1 de CLAUDE.md.
 *
 * Devuelve `null` si el LCD no está cableado, o si está cableado a una fuente
 * sin variante de `LcdDisplayValue` conocida todavía (extensión futura).
 */
export function resolveLcdDisplayValue(
  blueprint: Blueprint,
  shipFloorplan: ShipFloorplan,
  lcdInstanceId: PlacedComponentInstanceId,
  atmosphereOf: (sectionId: SectionId) => SectionAtmosphere | undefined,
  registries: SensorReadingRegistries,
): LcdDisplayValue | null {
  const source = resolveWiredSensorSource(
    blueprint,
    shipFloorplan,
    lcdInstanceId,
    atmosphereOf,
    registries.componentRegistry,
  );
  if (!source) return null;
  switch (source.sensorKind) {
    case "pressure":
      return { kind: "pressure", sectionId: source.sectionId, pressureKpa: source.atmosphere.pressureKpa };
    case "thermal":
      return { kind: "temperature", sectionId: source.sectionId, temperatureCelsius: source.atmosphere.temperatureCelsius };
    case "chemical":
      return {
        kind: "chemical",
        sectionId: source.sectionId,
        concentration: chemicalSensorReading(source.atmosphere, registries.chemicalRegistry),
      };
  }
}
