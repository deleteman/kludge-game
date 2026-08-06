/**
 * Contenido DE FÁBRICA de los reservorios al crear una campaña (Subfase 13e,
 * ronda 1 de fixes de playtest).
 *
 * Hasta este fix `Blueprint.reservoirContents` nacía SIEMPRE vacío
 * (`save/campaign-save-factory.ts`) y nada lo poblaba jamás: la sustancia de
 * cada reservorio del catálogo existía solo como comentario. Consecuencia
 * reportada en playtest: el reservorio de agua reciclada del Capítulo 1 decía
 * estar vacío, así que no se podía analizar ni extraer — y sin extracción no
 * hay elementos, sin elementos no hay síntesis, y todo el ciclo de 13e quedaba
 * sin arrancar.
 *
 * Los tanques nacen LLENOS a su `capacity` de catálogo (decisión del operador,
 * 2026-08-06): la nave salió de puerto cargada, y así no hay que inventar 21
 * cantidades iniciales a mano. La escasez no viene de que haya poco, sino de
 * que sacarlo cuesta tiempo — `extract-elements` saca un lote pequeño por
 * tarea (`EXTRACTION_BATCH_UNITS`, `reservoir-parameters.ts`), y cada lote es
 * un viaje del tripulante.
 *
 * Se lee del SPEC de catálogo y no del `PhysicalComponentDefinition` ya
 * construido porque `contains` es metadato de autoría: la factory solo copia
 * `data`, igual que pasa con el resto de campos del spec.
 */

import type { PlacedComponentInstance, ReservoirContent } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { CompositeComponentSpec } from "../components/catalog/composite/composite-component-spec.types.js";

/** Qué sustancia trae de fábrica cada componente, y cuánta cabe. */
export type FactoryReservoirContents = ReadonlyMap<
  ComponentId,
  { readonly substanceId: ChemicalSubstanceId; readonly capacity: number }
>;

/**
 * Indexa los specs de catálogo que declaran `contains` Y una capacidad de
 * sustancia. Filtra el `RES(E)` de las baterías (Fase 13b): esas almacenan
 * energía, no una sustancia química.
 */
export function indexFactoryReservoirContents(
  specs: ReadonlyArray<CompositeComponentSpec>,
): FactoryReservoirContents {
  const index = new Map<ComponentId, { substanceId: ChemicalSubstanceId; capacity: number }>();
  for (const spec of specs) {
    if (!spec.contains) {
      continue;
    }
    const reservoir = spec.data.functional?.find(
      (property) =>
        property.tag === "RES" &&
        (property.resourceType === "G" ||
          property.resourceType === "L" ||
          property.resourceType === "T"),
    );
    if (reservoir && reservoir.tag === "RES" && reservoir.capacity > 0) {
      index.set(spec.id, { substanceId: spec.contains, capacity: reservoir.capacity });
    }
  }
  return index;
}

/**
 * Entradas de `reservoirContents` para un conjunto de instancias recién
 * colocadas. Ignora en silencio lo que no corresponda — una pieza sin
 * `contains`, una que no sea reservorio de sustancia, o una `destroyed` (su
 * contenido se considera perdido, coherente con el derrame de 13d).
 */
export function deriveInitialReservoirContents(
  placedComponents: ReadonlyArray<PlacedComponentInstance>,
  factoryContents: FactoryReservoirContents,
): ReservoirContent[] {
  const contents: ReservoirContent[] = [];
  for (const instance of placedComponents) {
    if (instance.condition === "destroyed") {
      continue;
    }
    const factory = factoryContents.get(instance.componentDefinitionId);
    if (!factory) {
      continue;
    }
    contents.push({
      componentInstanceId: instance.instanceId,
      substanceId: factory.substanceId,
      amount: factory.capacity,
    });
  }
  return contents;
}
