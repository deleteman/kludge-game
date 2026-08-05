import type { CompositionFactory } from "../composition/composition-factory.js";
import type { MapEntityRegistry } from "../composition/entity-registry.js";
import type {
  AtomicComponentData,
  ComponentId,
  CreationPart,
  CompositeComponentData,
  PhysicalComponentDefinition,
} from "../components/physical-component.types.js";
import { calculateFootprint, calculateFootprintOrigin } from "./footprint-calculator.js";
import { buildRecipeFromPieces } from "./creation-recipe-builder.js";
import { aggregateCreationMaterial } from "./creation-material-aggregation.js";
import { WorkbenchError, type WorkbenchPiece } from "./workbench-state.types.js";

export interface NameCreationParams {
  /** Id asignado por el llamador (game/save-system) para el nuevo compuesto. */
  readonly id: ComponentId;
  readonly name: string;
}

/**
 * "Nombrar" (GDD 10.1): al terminar de componer en la mesa, el jugador
 * asigna un nombre y la disposición se guarda como compuesto nuevo,
 * reutilizable y exportable en blueprints. Reutiliza la `CompositionFactory`
 * genérica ya usada por el catálogo de Fase 4 (`buildComponentCatalog`) — no
 * duplica su lógica de validación de receta, y sigue el mismo patrón de
 * registrar manualmente en el `EntityRegistry` tras construir.
 */
export function nameAndRegisterCreation(
  factory: CompositionFactory<ComponentId, AtomicComponentData, CompositeComponentData, ComponentId>,
  registry: MapEntityRegistry<ComponentId, PhysicalComponentDefinition>,
  pieces: ReadonlyArray<WorkbenchPiece>,
  params: NameCreationParams,
): PhysicalComponentDefinition {
  if (params.name.trim().length === 0) {
    throw new WorkbenchError("A creation must be named with a non-empty name before saving it");
  }

  const footprint = calculateFootprint(pieces);
  const recipe = buildRecipeFromPieces(pieces);

  // Disposición por-pieza (deuda #8, Fase 12c.5): offset relativo al origen del
  // footprint + rotación, para que `/game` dibuje la creación con los sprites
  // reales de sus partes. La receta deduplica y descarta posiciones, así que el
  // layout conserva CADA pieza colocada (una entrada por pieza, no por tipo).
  const origin = calculateFootprintOrigin(pieces);
  const layout: ReadonlyArray<CreationPart> = pieces.map((piece) => ({
    ref: piece.componentDefinitionId,
    offset: {
      x: piece.placement.position.x - origin.x,
      y: piece.placement.position.y - origin.y,
    },
    footprint: piece.placement.footprint,
    rotation: piece.placement.rotation,
  }));

  // Agrega las propiedades funcionales de las piezas al compuesto (11c.1): sin
  // esto, `data.functional` quedaba vacío y una creación instalada en misión no
  // derivaba ningún `SignalNode` (`deriveSignalNodes`), así que era incableable
  // pese a contener piezas EM/REC/COND. Los puertos externos de la creación
  // emergen de las propiedades de sus partes (principios 1 y 3), no se declaran
  // aparte. Una propiedad por ingrediente distinto (la receta ya deduplica
  // piezas repetidas en `quantity`): un solo puerto por tipo de pieza con rol.
  const ingredients = factory.resolveIngredients(recipe);
  const aggregatedFunctional = ingredients.flatMap(({ entity }) => entity.data.functional ?? []);

  // Agrega las propiedades de MATERIAL (deuda #6, prerrequisito de 13c): sin
  // esto la creación no tenía `data.material`, así que no se corroía
  // (`MissionStructuralRuntime` la saltaba) ni se detectaba ferromagnética.
  // La regla por propiedad vive en `creation-material-aggregation.ts`, no acá.
  const aggregatedMaterial = aggregateCreationMaterial(
    ingredients.map(({ entity }) => entity.data.material),
  );

  const composite = factory.buildComposite({
    id: params.id,
    name: params.name,
    data: {
      footprint,
      layout,
      ...(aggregatedFunctional.length > 0 ? { functional: aggregatedFunctional } : {}),
      ...(aggregatedMaterial ? { material: aggregatedMaterial } : {}),
    },
    recipe,
  });

  registry.register(composite.id, composite);
  return composite;
}
