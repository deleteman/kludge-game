import type { Section } from "../atmosphere/section.types.js";
import type { VentilationConnection } from "../atmosphere/ventilation.types.js";
import { sectionArea } from "./floorplan.types.js";
import type { ShipFloorplan } from "./floorplan.types.js";

/**
 * Proyección del plano físico al modelo de atmósfera de Fase 2. Resuelve la
 * nota PROVISIONAL de `atmosphere/section.types.ts`: la `Section` no cambia
 * de forma — pasa a derivarse del plano autorado en Tiled.
 *
 * Volumen = área en celdas (1 celda = 1 unidad; decisión del operador, Fase
 * 5). La difusión (Espec. §4) solo usa el volumen como peso relativo del
 * equilibrio, así que la magnitud derivada de la geometría es suficiente y no
 * puede desincronizarse del dibujo de la sección.
 */
export interface FloorplanAtmosphereModel {
  readonly sections: readonly Section[];
  readonly connections: readonly VentilationConnection[];
}

export function deriveAtmosphereModel(floorplan: ShipFloorplan): FloorplanAtmosphereModel {
  return {
    sections: floorplan.sections.map((section) => ({
      id: section.id,
      volume: sectionArea(section),
    })),
    connections: floorplan.conduits
      .filter((conduit) => conduit.kind === "ventilacion")
      .map((conduit) => ({
        a: conduit.a,
        b: conduit.b,
        valveAperture: conduit.initialAperture,
      })),
  };
}
