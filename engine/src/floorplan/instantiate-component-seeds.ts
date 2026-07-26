import { isCompositeEntity } from "../composition/composable-entity.types.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { ComponentCondition, PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentSeedPoint } from "./floorplan.types.js";

export class ComponentSeedError extends Error {}

const VALID_CONDITIONS: ReadonlySet<string> = new Set<ComponentCondition>(["ok", "jammed", "destroyed"]);

function resolveCondition(seed: ComponentSeedPoint): ComponentCondition {
  const raw = seed.condition ?? "ok";
  if (!VALID_CONDITIONS.has(raw)) {
    throw new ComponentSeedError(
      `Component seed '${seed.id}' has invalid condition '${raw}' (expected 'ok'/'jammed'/'destroyed')`,
    );
  }
  return raw as ComponentCondition;
}

/**
 * Resuelve los objetos semilla autorados en la capa Tiled `semillas`
 * (`floorplan-parser.ts::parseComponentSeeds`) contra el catálogo real de la
 * misión, para producir las instancias a anexar al `Blueprint` inicial —
 * mismo rol que `CHAPTER_01_SEEDED_COMPONENTS_BY_ARCHETYPE` cumplía a mano
 * en TS, pero data-driven desde el mapa. Solo COMPUESTOS (GDD 7.1-7.2): una
 * semilla que referencia una pieza atómica es un error de autoría, no un caso
 * silencioso — igual que una referencia de receta colgante en
 * `CompositionFactory`.
 */
export function instantiateComponentSeeds(
  seeds: ReadonlyArray<ComponentSeedPoint>,
  registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): PlacedComponentInstance[] {
  return seeds.map((seed) => {
    const componentId = seed.componentId as ComponentId;
    const definition = registry.get(componentId);
    if (!definition) {
      throw new ComponentSeedError(
        `Component seed '${seed.id}' references unknown componentId '${seed.componentId}'`,
      );
    }
    if (!isCompositeEntity(definition)) {
      throw new ComponentSeedError(
        `Component seed '${seed.id}' references atomic componentId '${seed.componentId}' — only compound components can be seeded (GDD 7.1-7.2)`,
      );
    }
    const footprint = definition.data.footprint;
    if (!footprint) {
      throw new ComponentSeedError(
        `Component seed '${seed.id}' resolves to '${seed.componentId}', which has no catalog footprint — add one to its CompositeComponentSpec before seeding it`,
      );
    }
    return {
      instanceId: (seed.instanceId ?? `semilla-${seed.id}`) as PlacedComponentInstanceId,
      componentDefinitionId: componentId,
      placement: { position: seed.position, footprint, rotation: 0 },
      condition: resolveCondition(seed),
    };
  });
}

/** Semillas de attrezzo ambiental: sin `chapterId`, presentes desde el arranque de la partida. */
export function baseComponentSeeds(
  seeds: ReadonlyArray<ComponentSeedPoint>,
): ReadonlyArray<ComponentSeedPoint> {
  return seeds.filter((seed) => seed.chapterId === undefined);
}

/** Semillas específicas de un capítulo: se instancian recién cuando ese capítulo pasa a ser el activo. */
export function componentSeedsForChapter(
  seeds: ReadonlyArray<ComponentSeedPoint>,
  chapterId: string,
): ReadonlyArray<ComponentSeedPoint> {
  return seeds.filter((seed) => seed.chapterId === chapterId);
}
